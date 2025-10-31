"""
Modal deployment with Roboflow Inference API for GPU-accelerated GroundingDINO
No local ML models needed - uses Roboflow's hosted GPU inference
"""
import modal
import os
from pathlib import Path

# Create Modal app
app = modal.App("fashion-crop-roboflow-v2")

# Get the backend directory
backend_dir = Path(__file__).parent

# Create a volume to cache model weights
models_volume = modal.Volume.from_name("roboflow-models-cache", create_if_missing=True)

# Start with Modal's official GPU image (PyTorch pre-installed)
image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.1.0-cudnn8-runtime-ubuntu22.04",
        add_python="3.11"
    )
    .apt_install(
        "libgl1-mesa-glx",      # OpenGL for OpenCV
        "libglib2.0-0",         # GLib for OpenCV
        "libsm6",               # Session Management library
        "libxrender1",          # X Rendering Extension
        "libxext6",             # X11 miscellaneous extensions
        "libgomp1",             # GNU OpenMP library
    )
    # Install NumPy FIRST (critical for PyTorch C-API hooks)
    .pip_install("numpy==1.26.4")
    # Install PyTorch 2.4.1 with CUDA 12.1 support
    .pip_install(
        "torch==2.4.1",
        "torchvision==0.19.1",
        extra_options="--index-url https://download.pytorch.org/whl/cu121"
    )
    # Self-test: Verify NumPy <-> PyTorch bridge
    .run_commands(
        "python -c 'import numpy as np, torch, torchvision; "
        "print(\"numpy:\", np.__version__); "
        "print(\"torch:\", torch.__version__); "
        "print(\"torchvision:\", torchvision.__version__); "
        "x = torch.randn(2,3); "
        "print(\"✅ to numpy ok:\", isinstance(x.numpy(), np.ndarray))'"
    )
    # Install transformers (needed by GroundingDINO)
    .pip_install("transformers>=4.30.0")
    # Install inference with grounding-dino and its missing dependencies
    .pip_install(
        "structlog>=23.1.0",  # Required by inference.core.logger
        "inference[grounding-dino]>=0.59.0"
    )
    # Install application dependencies
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic>=2.8.0,<2.12.0",
        "python-dotenv==1.0.0",
        "requests>=2.32.0",
        "Pillow>=10.0.0",
        "openai>=1.0.0",
    )
    # Add application code
    .add_local_dir(backend_dir / "api", "/root/api")
    .add_local_file(backend_dir / "roboflow_cropper.py", "/root/roboflow_cropper.py")
    .add_local_file(backend_dir / "crop_api.py", "/root/crop_api.py")
    # Add analyzers directory for GPT-4o
    .add_local_dir(backend_dir / "src" / "analyzers", "/root/src/analyzers")
)

# Deploy FastAPI app with Roboflow
@app.function(
    image=image,
    gpu="t4",  # GPU required for local GroundingDINO inference
    cpu=2.0,
    memory=8192,  # 8GB for model weights
    secrets=[
        modal.Secret.from_name("fashion-api-keys"),  # OpenAI, ImgBB, Roboflow
    ],
    volumes={"/cache": models_volume},  # Mount volume for model caching
    min_containers=1,  # Keep 1 container warm to avoid cold starts
    timeout=300,  # 5 min timeout for inference
)
@modal.asgi_app()
def fastapi_app():
    """FastAPI app using Roboflow for inference"""
    import sys
    sys.path.insert(0, "/root")
    
    # CRITICAL FIX: Force NumPy 1.x reload before any torch imports
    print("🔧 Runtime NumPy/PyTorch compatibility fix...")
    try:
        # Force reimport of NumPy and PyTorch in clean state
        import subprocess
        import sys
        
        # Reinstall NumPy at runtime to ensure C-API is properly linked
        print("📦 Reinstalling NumPy 1.26.4 at runtime...")
        subprocess.check_call([
            sys.executable, "-m", "pip", "install", 
            "--force-reinstall", "--no-cache-dir", "--no-deps",
            "numpy==1.26.4"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
        # Now test
        import numpy as np
        import torch
        print(f"📦 NumPy version: {np.__version__}")
        print(f"📦 PyTorch version: {torch.__version__}")
        
        test_array = np.array([1, 2, 3])
        test_tensor = torch.from_numpy(test_array)
        print(f"✅ NumPy ↔ PyTorch compatibility verified at runtime")
    except Exception as e:
        print(f"⚠️  NumPy/PyTorch compatibility issue: {e}")
        print("⚠️  Proceeding anyway, but inference may fail")
    
    # Set environment variables
    os.environ["USE_ROBOFLOW"] = "true"  # Enable Roboflow mode
    os.environ["USE_SAM2"] = "false"  # Not needed with Roboflow (bounding boxes only)
    
    # Configure Roboflow to use the cache volume
    os.environ["ROBOFLOW_CACHE_DIR"] = "/cache/roboflow"
    os.environ["TORCH_HOME"] = "/cache/torch"
    os.environ["HF_HOME"] = "/cache/huggingface"
    
    # Create cache directories
    os.makedirs("/cache/roboflow", exist_ok=True)
    os.makedirs("/cache/torch", exist_ok=True)
    os.makedirs("/cache/huggingface", exist_ok=True)
    
    # Debug: Print environment
    print("="*60)
    print("🔍 DEBUG INFO:")
    print(f"   USE_ROBOFLOW: {os.environ.get('USE_ROBOFLOW')}")
    print(f"   ROBOFLOW_API_KEY present: {bool(os.environ.get('ROBOFLOW_API_KEY'))}")
    print(f"   OPENAI_API_KEY present: {bool(os.environ.get('OPENAI_API_KEY'))}")
    print(f"   sys.path: {sys.path[:3]}")
    
    # Check if files exist
    import os as os_check
    print(f"   /root/roboflow_cropper.py exists: {os_check.path.exists('/root/roboflow_cropper.py')}")
    print(f"   /root/src/analyzers exists: {os_check.path.exists('/root/src/analyzers')}")
    print("="*60)
    
    from api.server import app as fastapi_app
    
    print("🚀 Fashion Crop API (Roboflow Mode) is ready!")
    print("📡 Using Roboflow Inference API for GPU-accelerated detection")
    
    return fastapi_app


if __name__ == "__main__":
    print("Deploying Fashion Crop API with Roboflow...")
    print("Make sure you've created the 'fashion-roboflow-keys' secret with ROBOFLOW_API_KEY")

