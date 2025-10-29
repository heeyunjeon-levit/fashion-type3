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
    .apt_install("git")
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "python-dotenv==1.0.0",
        "boto3>=1.28.0",
        "opencv-python-headless==4.9.0.80",
        "numpy==1.26.4",
        "Pillow==10.3.0",
        "pandas==2.2.2",
        "PyYAML==6.0.1",
        "requests==2.31.0",
        "supabase==2.10.0",
        "openai>=1.0.0",
        "torch==2.2.0",
        "torchvision==0.17.0",
        "transformers==4.41.0",
        "timm==0.9.12",
        "ultralytics==8.2.0",
        "segment-anything==1.0",
        "git+https://github.com/IDEA-Research/GroundingDINO.git",
    )
    # Add all necessary Python modules into the image
    .add_local_dir(backend_dir / "api", "/root/api")
    .add_local_dir(backend_dir / "src", "/root/src")
    .add_local_dir(backend_dir / "configs", "/root/configs")
    .add_local_file(backend_dir / "crop_api.py", "/root/crop_api.py")
    .add_local_file(backend_dir / "custom_item_cropper.py", "/root/custom_item_cropper.py")
)

# Create volumes for model weights
weights_volume = modal.Volume.from_name("grounding-dino-weights", create_if_missing=True)

# Deploy the FastAPI app
@app.function(
    image=image,
    cpu=2,
    memory=8192,
    timeout=600,
    secrets=[modal.Secret.from_name("fashion-api-keys")],
    volumes={"/root/data/weights": weights_volume},
)
@modal.asgi_app()
def fastapi_app():
    """
    Load and return the FastAPI app
    Files are already in the image at /root/
    """
    import sys
    sys.path.insert(0, "/root")
    
    from api.server import app
    return app

