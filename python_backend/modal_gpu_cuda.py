"""
Modal deployment with CUDA-enabled PyTorch for true GPU acceleration
Simplified approach without conda complications
"""

import modal
from pathlib import Path

app = modal.App("fashion-crop-api-gpu")
model_volume = modal.Volume.from_name("fashion-models-gpu-cache", create_if_missing=True)
backend_dir = Path(__file__).parent

# Use official PyTorch CUDA image (EXACTLY as GroundingDINO Dockerfile)
image = (
    modal.Image.from_registry(
        "pytorch/pytorch:2.1.2-cuda12.1-cudnn8-runtime",
        add_python="3.11"
    )
    # Set environment variables BEFORE any compilation (critical for GroundingDINO)
    # TORCH_CUDA_ARCH_LIST tells setup.py to compile with CUDA even without GPU at build time
    .env({
        "DEBIAN_FRONTEND": "noninteractive",
        "TZ": "UTC",
        "CUDA_HOME": "/usr/local/cuda",
        "TORCH_CUDA_ARCH_LIST": "6.0 6.1 7.0 7.5 8.0 8.6+PTX",
        "SETUPTOOLS_USE_DISTUTILS": "stdlib",
        "PATH": "/usr/local/cuda/bin:/opt/conda/bin:$PATH"
    })
    .apt_install(
        "git", "wget", "build-essential", "ca-certificates",
        "ffmpeg", "libgl1", "libglib2.0-0", "libsm6", "libxrender1", "libxext6"
    )
    # Install NumPy 1.x FIRST
    .pip_install("numpy==1.26.4")
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "python-dotenv==1.0.0",
        "requests==2.31.0",
        "httpx",
    )
    .pip_install(
        "opencv-python-headless==4.9.0.80",
        "supervision==0.16.0",
        "pillow==10.1.0",
        "addict==2.4.0",
        "yapf==0.40.2",
        "timm==0.9.12",
        "transformers==4.35.2",
    )
    .pip_install(
        "openai==1.3.5",
        "supabase==2.0.3",
    )
    # Clone and install GroundingDINO (will compile with CUDA)
    .run_commands(
        "cd /root && git clone https://github.com/IDEA-Research/GroundingDINO.git && "
        "cd /root/GroundingDINO && pip install -e . && "
        "pip install 'numpy==1.26.4' --force-reinstall --no-deps"  # Force NumPy 1.x after GroundingDINO
    )
    # Download GroundingDINO weights
    .run_commands(
        "mkdir -p /root/GroundingDINO/weights",
        "cd /root/GroundingDINO/weights && wget -q https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth"
    )
    # Verify CUDA is available
    .run_commands(
        "python -c 'import torch; print(\"PyTorch version:\", torch.__version__); print(\"CUDA available:\", torch.cuda.is_available()); print(\"CUDA version:\", torch.version.cuda if torch.cuda.is_available() else \"N/A\")'"
    )
    # Add backend code
    .add_local_dir(backend_dir, "/root/python_backend")
)

@app.function(
    image=image,
    gpu="t4",  # T4 GPU
    cpu=2.0,
    memory=16384,
    timeout=600,
    volumes={"/cache": model_volume},
    secrets=[modal.Secret.from_name("fashion-api-keys")],
    container_idle_timeout=300,  # Keep warm for 5 minutes
)
@modal.asgi_app()
def fastapi_app():
    """
    Load and return the FastAPI app with CUDA-accelerated GroundingDINO
    """
    import sys
    import os
    
    # Set Python path
    sys.path.insert(0, "/root/GroundingDINO")
    sys.path.insert(0, "/root/python_backend")
    os.chdir("/root/python_backend")
    
    print("\n" + "="*60)
    print("🚀 Starting Fashion Crop API with GPU (CUDA)")
    print("="*60)
    
    # Verify CUDA at runtime
    import torch
    print(f"✅ PyTorch version: {torch.__version__}")
    print(f"✅ CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"✅ CUDA version: {torch.version.cuda}")
        print(f"✅ GPU device: {torch.cuda.get_device_name(0)}")
        print(f"✅ GPU memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
    else:
        print("⚠️  WARNING: CUDA not available! Will use CPU")
    
    # Verify GroundingDINO
    try:
        import groundingdino
        print(f"✅ GroundingDINO imported successfully")
    except Exception as e:
        print(f"❌ GroundingDINO import failed: {e}")
    
    # Set environment variables
    os.environ["USE_SAM2"] = "false"  # Skip SAM2 for speed
    
    print("="*60)
    print("✅ Fashion Crop API ready!")
    print("="*60 + "\n")
    
    from api.server import app
    return app

