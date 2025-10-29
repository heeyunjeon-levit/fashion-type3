"""
Modal deployment for Fashion Crop API
This runs your heavy ML backend on Modal's infrastructure
"""
import modal
import os

# Create Modal app
app = modal.App("fashion-crop-api")

# Get the directory of this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# Define the image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    # Install system dependencies
    .apt_install("git")
    # Install basic Python dependencies first
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
    )
    # Install PyTorch (large dependency)
    .pip_install(
        "torch==2.2.0",
        "torchvision==0.17.0",
    )
    # Install ML/Vision dependencies
    .pip_install(
        "transformers==4.41.0",
        "timm==0.9.12",
        "ultralytics==8.2.0",
    )
    # Install segment-anything
    .pip_install("segment-anything==1.0")
    # Install GroundingDINO from GitHub
    .pip_install("git+https://github.com/IDEA-Research/GroundingDINO.git")
)

# Deploy the FastAPI app
@app.function(
    image=image,
    cpu=2,  # 2 CPUs
    memory=8192,  # 8GB RAM for models
    timeout=600,  # 10 minute timeout
    secrets=[modal.Secret.from_name("fashion-api-keys")],
)
@modal.asgi_app()
def fastapi_app():
    # Import the FastAPI app from the api.server module
    # Modal will automatically sync the code from the current directory
    from api.server import app
    return app
