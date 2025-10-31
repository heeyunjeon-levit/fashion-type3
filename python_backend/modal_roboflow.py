"""
Modal deployment with Roboflow Inference API for GPU-accelerated GroundingDINO
No local ML models needed - uses Roboflow's hosted GPU inference
"""
import modal
import os
from pathlib import Path

# Create Modal app
app = modal.App("fashion-crop-roboflow")

# Get the backend directory
backend_dir = Path(__file__).parent

# Lightweight image - no ML models needed!
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "python-dotenv==1.0.0",
        "requests==2.31.0",
        "Pillow>=10.0.0",
        "supabase==2.10.0",
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
    cpu=1.0,  # Lightweight - just API calls
    memory=512,  # Minimal memory needed
    secrets=[
        modal.Secret.from_name("fashion-api-keys"),  # OpenAI, Supabase
        modal.Secret.from_name("fashion-roboflow-keys"),  # Roboflow API key
    ],
    keep_warm=1,  # Keep 1 container warm to avoid cold starts
)
@modal.asgi_app()
def fastapi_app():
    """FastAPI app using Roboflow for inference"""
    import sys
    sys.path.insert(0, "/root")
    
    # Set environment variables
    os.environ["USE_ROBOFLOW"] = "true"  # Enable Roboflow mode
    os.environ["USE_SAM2"] = "false"  # Not needed with Roboflow (bounding boxes only)
    
    from api.server import app as fastapi_app
    
    print("🚀 Fashion Crop API (Roboflow Mode) is ready!")
    print("📡 Using Roboflow Inference API for GPU-accelerated detection")
    
    return fastapi_app


if __name__ == "__main__":
    print("Deploying Fashion Crop API with Roboflow...")
    print("Make sure you've created the 'fashion-roboflow-keys' secret with ROBOFLOW_API_KEY")

