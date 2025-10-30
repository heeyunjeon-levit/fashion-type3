"""
Modal deployment with Volume Caching for faster cold starts
This reduces cold start time from 60-90s to 10-20s
"""
import modal
import os
from pathlib import Path

# Create Modal app
app = modal.App("fashion-crop-api-gpu")

# Get the backend directory
backend_dir = Path(__file__).parent

# Create a persistent volume for model weights (survives container restarts)
model_volume = modal.Volume.from_name("fashion-model-weights", create_if_missing=True)

# Define the image WITHOUT model weights (much lighter and faster to build)
# Version: GPU-v2 (CUDA 11.8 + T4 GPU)
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "git", 
        "wget", 
        "build-essential",
        "libgl1-mesa-glx",  # OpenGL library for OpenCV
        "libglib2.0-0",     # GLib library
    )
    .run_commands("echo 'CPU build v4 - reverting GPU due to PyTorch issues'")  # Force rebuild
    # Install basic Python dependencies first
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "python-dotenv==1.0.0",
        "requests==2.31.0",
    )
    # Install CPU-only PyTorch (GPU was causing C++ extension issues)
    .pip_install(
        "torch==2.2.0",
        "torchvision==0.17.0",
    )
    # Install ML/Vision dependencies
    .pip_install(
        "opencv-python-headless==4.9.0.80",
        "numpy==1.26.4",
        "Pillow==10.3.0",
        "pandas==2.2.2",
        "PyYAML==6.0.1",
        "transformers==4.41.0",
        "timm==0.9.12",
        "ultralytics==8.2.0",
        "segment-anything==1.0",
        "supabase==2.10.0",
        "openai>=1.0.0",
        "boto3>=1.28.0",
    )
    # Install SAM-2 from GitHub (without upgrading PyTorch)
    .run_commands(
        "cd /tmp && git clone https://github.com/facebookresearch/segment-anything-2.git",
        "cd /tmp/segment-anything-2 && pip install -e . --no-deps",
        "pip install hydra-core>=1.3.2 iopath>=0.1.10 tqdm>=4.66.1",
    )
    # Install GroundingDINO from GitHub with all dependencies
    .run_commands(
        "cd /tmp && git clone https://github.com/IDEA-Research/GroundingDINO.git",
        "cd /tmp/GroundingDINO && pip install -e .",
    )
    # Add all necessary Python modules into the image
    .add_local_dir(backend_dir / "api", "/root/api")
    .add_local_dir(backend_dir / "src", "/root/src")
    .add_local_dir(backend_dir / "configs", "/root/configs")
    # Add weights to a temporary location (used to populate volume on first run)
    .add_local_dir(backend_dir / "data/weights", "/tmp/initial_weights")
    .add_local_file(backend_dir / "crop_api.py", "/root/crop_api.py")
    .add_local_file(backend_dir / "custom_item_cropper.py", "/root/custom_item_cropper.py")
)

# Helper function to ensure models are in the volume
def ensure_models_in_volume():
    """
    Download models to volume if they don't exist yet.
    This runs once on first deployment, then models are cached.
    """
    import os
    import shutil
    from pathlib import Path
    
    volume_weights_dir = "/cache/weights"
    local_weights_dir = "/root/data/weights"
    
    # Create directories
    os.makedirs(volume_weights_dir, exist_ok=True)
    os.makedirs(local_weights_dir, exist_ok=True)
    
    groundingdino_path = f"{volume_weights_dir}/groundingdino_swint_ogc.pth"
    sam2_path = f"{volume_weights_dir}/sam2_hiera_large.pt"
    
    # Check if models already exist in volume
    if os.path.exists(groundingdino_path) and os.path.exists(sam2_path):
        print(f"✅ Models found in volume cache at {volume_weights_dir}")
        print(f"   GroundingDINO: {os.path.getsize(groundingdino_path) / 1024 / 1024:.1f} MB")
        print(f"   SAM-2: {os.path.getsize(sam2_path) / 1024 / 1024:.1f} MB")
        
        # Create symlinks so the app can find them
        if not os.path.exists(f"{local_weights_dir}/groundingdino_swint_ogc.pth"):
            os.symlink(groundingdino_path, f"{local_weights_dir}/groundingdino_swint_ogc.pth")
        if not os.path.exists(f"{local_weights_dir}/sam2_hiera_large.pt"):
            os.symlink(sam2_path, f"{local_weights_dir}/sam2_hiera_large.pt")
        
        return
    
    # Models not in volume yet - need to download them
    print("📥 Models not found in volume cache. Downloading (first time only)...")
    print("   This will take 60-90 seconds but only happens once!")
    
    # Copy from the initial weights that were baked into the image
    initial_weights_dir = "/tmp/initial_weights"
    
    if os.path.exists(f"{initial_weights_dir}/groundingdino_swint_ogc.pth"):
        print("   Copying GroundingDINO weights to volume...")
        shutil.copy2(
            f"{initial_weights_dir}/groundingdino_swint_ogc.pth",
            groundingdino_path
        )
        print(f"   ✅ GroundingDINO cached ({os.path.getsize(groundingdino_path) / 1024 / 1024:.1f} MB)")
    else:
        raise FileNotFoundError("GroundingDINO weights not found in image")
    
    if os.path.exists(f"{initial_weights_dir}/sam2_hiera_large.pt"):
        print("   Copying SAM-2 weights to volume...")
        shutil.copy2(
            f"{initial_weights_dir}/sam2_hiera_large.pt",
            sam2_path
        )
        print(f"   ✅ SAM-2 cached ({os.path.getsize(sam2_path) / 1024 / 1024:.1f} MB)")
    else:
        raise FileNotFoundError("SAM-2 weights not found in image")
    
    # Create symlinks for the app
    os.symlink(groundingdino_path, f"{local_weights_dir}/groundingdino_swint_ogc.pth")
    os.symlink(sam2_path, f"{local_weights_dir}/sam2_hiera_large.pt")
    
    # Commit the volume so changes persist
    model_volume.commit()
    print("✅ Models cached to volume and will be reused on next cold start!")

# Deploy the FastAPI app with volume mounted
# Note: USE_SAM2 environment variable defaults to "false" in crop_api.py for speed
@app.function(
    image=image,
    cpu=2,  # Back to CPU - GPU causing PyTorch C++ extension issues
    memory=16384,  # 16GB for ML models
    timeout=600,
    volumes={"/cache": model_volume},  # Mount volume at /cache
    secrets=[modal.Secret.from_name("fashion-api-keys")],
)
@modal.asgi_app()
def fastapi_app_v2():
    """
    Load and return the FastAPI app
    Models are loaded from persistent volume for faster cold starts
    """
    import sys
    import os
    
    # Set working directory and Python path
    os.chdir("/root")
    sys.path.insert(0, "/root")
    
    print("\n🚀 Starting Fashion Crop API with Volume Caching...")
    
    # Ensure models are in volume (downloads on first run, then cached)
    ensure_models_in_volume()
    
    # Debug: Check if groundingdino is importable
    try:
        import groundingdino
        print(f"✅ groundingdino module found at: {groundingdino.__file__}")
        print(f"✅ groundingdino version: {groundingdino.__version__ if hasattr(groundingdino, '__version__') else 'unknown'}")
    except ImportError as e:
        print(f"❌ groundingdino import failed: {e}")
        
    try:
        from groundingdino.util import inference
        print(f"✅ groundingdino.util.inference module loaded successfully")
    except ImportError as e:
        print(f"❌ groundingdino.util.inference import failed: {e}")
    
    print("✅ Fashion Crop API ready!\n")
    
    from api.server import app
    return app

