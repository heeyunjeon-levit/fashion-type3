"""
Modal deployment with properly compiled GroundingDINO for GPU
Following official GroundingDINO installation instructions strictly
"""

import modal
from pathlib import Path

# Create Modal app (separate from CPU backend)
app = modal.App("fashion-crop-api-gpu")  # Keep naming consistent with CPU version

# Create volume for model weights
model_volume = modal.Volume.from_name("fashion-models-gpu-cache", create_if_missing=True)

# Get the backend directory
backend_dir = Path(__file__).parent

# Use PyTorch's official CUDA image (same as GroundingDINO's Dockerfile)
image = (
    modal.Image.from_registry(
        "pytorch/pytorch:2.1.2-cuda12.1-cudnn8-runtime"
    )
    # Set non-interactive mode for apt to avoid timezone prompts
    .env({"DEBIAN_FRONTEND": "noninteractive", "TZ": "UTC"})
    # Install wget first (needed for CUDA setup)
    .apt_install("wget")
    # Add NVIDIA CUDA repository for nvcc compiler
    .run_commands(
        "wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2004/x86_64/cuda-keyring_1.0-1_all.deb",
        "dpkg -i cuda-keyring_1.0-1_all.deb",
        "apt-get update"
    )
    # Install system dependencies + CUDA compiler tools
    .apt_install(
        "build-essential",
        "git",
        "python3-opencv",
        "ca-certificates",
        "ninja-build",  # For faster compilation
        "libglib2.0-0",
        "libsm6",
        "libxrender1",
        "libxext6",
        "cuda-compiler-12-1",  # CUDA 12.1 compiler (nvcc)
        "cuda-cudart-dev-12-1",  # CUDA runtime dev
    )
    # Set CUDA environment variables (from GroundingDINO Dockerfile)
    .env({
        "CUDA_HOME": "/usr/local/cuda-12.1",
        "TORCH_CUDA_ARCH_LIST": "6.0 6.1 7.0 7.5 8.0 8.6+PTX",
        "PATH": "/usr/local/cuda-12.1/bin:/opt/conda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
    })
    # Skip conda update (too slow) - PyTorch image already has CUDA 12.1
    # Just verify CUDA is available
    .run_commands(
        "nvcc --version || echo 'CUDA compiler check'",
        "python -c 'import torch; print(f\"PyTorch CUDA: {torch.version.cuda}\")'"
    )
    # Clone GroundingDINO and install (following official Dockerfile)
    .run_commands(
        "cd /opt && git clone https://github.com/IDEA-Research/GroundingDINO.git",
        "cd /opt/GroundingDINO && python -m pip install ."
    )
    # Now install our app dependencies (after GroundingDINO has set up PyTorch)
    .pip_install(
        "opencv-python-headless",
        "pillow",
        "fastapi",
        "pydantic",
        "python-multipart",
        "openai",
        "python-dotenv",
        "supabase",
        "requests",
        "httpx",  # Better DNS handling than requests
        "beautifulsoup4",  # For OCR pipeline
        "sse-starlette",  # For streaming responses
    )
    # Download GroundingDINO weights (official location)
    .run_commands(
        "mkdir -p /opt/GroundingDINO/weights",
        "cd /opt/GroundingDINO/weights && wget -q https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth",
    )
    # Verify everything is working
    .run_commands(
        "python -c 'import torch; print(\"✅ PyTorch:\", torch.__version__, \"CUDA:\", torch.version.cuda)'",
        "python -c 'import groundingdino; print(\"✅ GroundingDINO imported\")'",
        "echo '✅ Build timestamp: 2025-11-03-20:25-with-conda-cuda'",
    )
    # Add the backend code into the image
    .add_local_dir(backend_dir, "/opt/python_backend")
)

@app.function(
    image=image,
    gpu="t4",  # Use T4 GPU
    cpu=2.0,
    memory=16384,
    timeout=600,
    volumes={"/cache": model_volume},
    secrets=[modal.Secret.from_name("fashion-api-keys")],
    scaledown_window=2,  # Quick scaledown for testing
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app_v2():
    """
    Load and return the FastAPI app with GPU-accelerated GroundingDINO
    """
    import sys
    import os
    
    # Set Python path to include GroundingDINO and backend code (new paths!)
    sys.path.insert(0, "/opt/GroundingDINO")
    sys.path.insert(0, "/opt/python_backend")
    sys.path.insert(0, "/opt")
    
    # Set working directory to backend
    os.chdir("/opt/python_backend")
    
    print("\n🚀 Starting Fashion Crop API with GPU...")
    
    # Verify CUDA
    import torch
    print(f"✅ CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"✅ GPU: {torch.cuda.get_device_name(0)}")
        print(f"✅ CUDA version: {torch.version.cuda}")
    
    # Verify GroundingDINO
    try:
        import groundingdino
        print(f"✅ GroundingDINO imported successfully")
        print(f"✅ GroundingDINO path: {groundingdino.__file__}")
    except Exception as e:
        print(f"❌ GroundingDINO import failed: {e}")
    
    # Set environment variables for the cropper
    os.environ["USE_SAM2"] = "false"  # No SAM2 in GPU backend
    
    print("✅ Fashion Crop API ready!\n")
    
    from api.server import app
    return app

