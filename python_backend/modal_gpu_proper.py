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

# Build image with CUDA support and proper GroundingDINO compilation
image = (
    modal.Image.from_registry(
        "nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04",  # Use -devel (not -runtime) for compilation
        add_python="3.10"
    )
    # Install system dependencies first
    .apt_install(
        "git",
        "wget",
        "build-essential",  # Required for compilation
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxrender1",
        "libxext6",
        "libgomp1",
    )
    # Set CUDA_HOME environment variable (CRITICAL!)
    .env({"CUDA_HOME": "/usr/local/cuda"})
    # Install build tools and NumPy FIRST
    .pip_install(
        "wheel",
        "setuptools",
        "numpy==1.24.3",  # NumPy 1.x for compatibility with older PyTorch/TorchVision
    )
    # Install PyTorch 2.0.1 with CUDA 11.8 (compatible with Transformers and GroundingDINO)
    .pip_install(
        "torch==2.0.1",
        "torchvision==0.15.2",
        extra_index_url="https://download.pytorch.org/whl/cu118"
    )
    # Install other dependencies
    .pip_install(
        "opencv-python-headless",
        "supervision==0.16.0",
        "pillow",
        "fastapi",
        "pydantic",
        "python-multipart",
        "openai",
        "python-dotenv",
        "supabase",
        "requests",
    )
    # Verify CUDA is available before compiling GroundingDINO (v2)
    .run_commands(
        "which nvcc && nvcc --version",  # Check nvcc and show CUDA version
    )
    # Clone GroundingDINO
    .run_commands(
        "cd /root && git clone https://github.com/IDEA-Research/GroundingDINO.git",
    )
    # Compile GroundingDINO from source (THE KEY STEP)
    # CRITICAL: Export CUDA_HOME before compilation so it builds with CUDA support
    .run_commands(
        "export CUDA_HOME=/usr/local/cuda && echo 'CUDA_HOME is set to:' $CUDA_HOME && cd /root/GroundingDINO && python -m pip install -e .",
    )
    # Fix NumPy version after GroundingDINO installation (it upgrades to 2.x)
    .pip_install("numpy==1.24.3")
    # Download GroundingDINO weights
    .run_commands(
        "mkdir -p /root/GroundingDINO/weights",
        "cd /root/GroundingDINO/weights && wget -q https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth",
    )
    # Verify CUDA, NumPy, PyTorch, and GroundingDINO are working
    .run_commands(
        "python -c 'import numpy; print(\"✅ NumPy version:\", numpy.__version__)'",
        "python -c 'import torch; print(\"✅ CUDA available:\", torch.cuda.is_available()); print(\"✅ CUDA version:\", torch.version.cuda); print(\"✅ PyTorch version:\", torch.__version__)'",
        "python -c 'import groundingdino; print(\"✅ GroundingDINO imported successfully\")'",
        "echo '✅ Build timestamp: 2025-11-03-17:05-verify-numpy'",  # Cache bust
    )
    # Add the backend code into the image (with updated GroundingDINO paths)
    .add_local_dir(backend_dir, "/root/python_backend")
)

@app.function(
    image=image,
    gpu="t4",  # Use T4 GPU
    cpu=2.0,
    memory=16384,
    timeout=600,
    volumes={"/cache": model_volume},
    secrets=[modal.Secret.from_name("fashion-api-keys")],
    scaledown_window=600,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app_v2():
    """
    Load and return the FastAPI app with GPU-accelerated GroundingDINO
    """
    import sys
    import os
    
    # Set Python path to include GroundingDINO and backend code
    sys.path.insert(0, "/root/GroundingDINO")
    sys.path.insert(0, "/root/python_backend")
    sys.path.insert(0, "/root")
    
    # Set working directory to backend
    os.chdir("/root/python_backend")
    
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

