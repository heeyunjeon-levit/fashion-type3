"""
Modal deployment with properly compiled GroundingDINO for GPU
Following official GroundingDINO installation instructions strictly
"""

import modal

# Create Modal app
app = modal.App("fashion-crop-api-gpu-proper")

# Create volume for model weights
model_volume = modal.Volume.from_name("fashion-models-gpu-cache", create_if_missing=True)

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
    # Install PyTorch with CUDA 11.8 FIRST
    .pip_install(
        "torch==2.1.2",
        "torchvision==0.16.2",
        extra_index_url="https://download.pytorch.org/whl/cu118"
    )
    # Install other dependencies
    .pip_install(
        "numpy==1.26.4",
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
    # Clone and compile GroundingDINO from source (THE KEY STEP)
    .run_commands(
        "cd /root && git clone https://github.com/IDEA-Research/GroundingDINO.git",
        "cd /root/GroundingDINO && pip install -e .",  # -e installs in editable mode, compiling C++ extensions
    )
    # Download GroundingDINO weights
    .run_commands(
        "mkdir -p /root/GroundingDINO/weights",
        "cd /root/GroundingDINO/weights && wget -q https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth",
    )
    # Clone and install SAM-2 (optional, if you want segmentation)
    .run_commands(
        "cd /root && git clone https://github.com/facebookresearch/segment-anything-2.git sam2",
        "cd /root/sam2 && pip install -e .",
    )
    # Download SAM-2 weights
    .run_commands(
        "mkdir -p /root/sam2/checkpoints",
        "cd /root/sam2/checkpoints && wget -q https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2_hiera_large.pt",
    )
    # Verify CUDA is available
    .run_commands(
        "python -c 'import torch; print(\"CUDA available:\", torch.cuda.is_available()); print(\"CUDA version:\", torch.version.cuda)'",
        "python -c 'import groundingdino; print(\"GroundingDINO imported successfully\")'"
    )
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
def fastapi_app_gpu():
    """
    Load and return the FastAPI app with GPU-accelerated GroundingDINO
    """
    import sys
    import os
    
    # Set Python path to include GroundingDINO
    sys.path.insert(0, "/root/GroundingDINO")
    sys.path.insert(0, "/root")
    
    # Set working directory
    os.chdir("/root")
    
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
    os.environ["USE_SAM2"] = "false"  # Can set to "true" if you want segmentation
    
    print("✅ Fashion Crop API ready!\n")
    
    from api.server import app
    return app

