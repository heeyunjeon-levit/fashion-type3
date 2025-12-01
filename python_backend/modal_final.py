"""
Complete Modal deployment for Fashion Crop API with all dependencies
"""
import modal
import os
from pathlib import Path

# Create Modal app
app = modal.App("fashion-crop-api")

# Get the backend directory
backend_dir = Path(__file__).parent

# Define the image with ALL backend files baked in
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "git", 
        "wget", 
        "build-essential",
        "libgl1-mesa-glx",  # OpenGL library for OpenCV
        "libglib2.0-0",     # GLib library
    )
    # Install basic Python dependencies first
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "python-dotenv==1.0.0",
        "requests==2.31.0",
        "beautifulsoup4==4.12.3",
    )
    # Install PyTorch
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
    # Install SAM-2 from GitHub
    .run_commands(
        "cd /tmp && git clone https://github.com/facebookresearch/segment-anything-2.git",
        "cd /tmp/segment-anything-2 && pip install -e .",
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
    .add_local_dir(backend_dir / "data/weights", "/root/data/weights")
    .add_local_file(backend_dir / "crop_api.py", "/root/crop_api.py")
    .add_local_file(backend_dir / "custom_item_cropper.py", "/root/custom_item_cropper.py")
    .add_local_file(backend_dir / "ocr_search_pipeline.py", "/root/ocr_search_pipeline.py")
)

# Deploy the FastAPI app
@app.function(
    image=image,
    cpu=2,
    memory=16384,  # Increased to 16GB for ML models
    timeout=600,
    secrets=[modal.Secret.from_name("fashion-api-keys")],
)
@modal.asgi_app()
def fastapi_app():
    """
    Load and return the FastAPI app
    Files are already in the image at /root/
    """
    import sys
    import os
    
    # Set working directory and Python path
    os.chdir("/root")
    sys.path.insert(0, "/root")
    
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
    
    from api.server import app
    return app

