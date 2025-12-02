"""
Simple Modal deployment for Fashion API with DINO-X
DINO-X is an API service - no GPU/CUDA compilation needed!
"""

import modal
from pathlib import Path

# Create Modal app
app = modal.App("fashion-crop-api-gpu")

# Get the backend directory
backend_dir = Path(__file__).parent

# Simple image with just FastAPI and our dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        # Web framework
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        # API clients
        "requests==2.31.0",
        "httpx",
        # Image processing
        "opencv-python-headless==4.9.0.80",
        "Pillow==10.3.0",
        # AI/ML
        "openai>=1.0.0",
        # Storage & utils
        "supabase==2.10.0",
        "python-dotenv==1.0.0",
        "beautifulsoup4==4.12.3",
        "sse-starlette",  # For streaming
    )
    # Add all backend code
    .add_local_dir(backend_dir / "api", "/root/api")
    .add_local_dir(backend_dir / "src", "/root/src")
    .add_local_dir(backend_dir / "configs", "/root/configs")  # Add configs for pipeline
    .add_local_file(backend_dir / "ocr_search_pipeline.py", "/root/ocr_search_pipeline.py")
    .add_local_file(backend_dir / "crop_api.py", "/root/crop_api.py")
    .add_local_file(backend_dir / "custom_item_cropper.py", "/root/custom_item_cropper.py")
)

@app.function(
    image=image,
    cpu=2.0,
    memory=8192,  # 8GB is plenty for API calls
    timeout=600,
    secrets=[modal.Secret.from_name("fashion-api-keys")],
    allow_concurrent_inputs=10,  # Handle multiple requests
)
@modal.asgi_app()
def fastapi_app_v2():
    """
    Load and return the FastAPI app
    DINO-X detection via API - no GPU needed!
    """
    import sys
    import os
    
    # Set Python path and working directory
    os.chdir("/root")
    sys.path.insert(0, "/root")
    
    print("\n🚀 Starting Fashion Crop API with DINO-X...")
    print("✅ DINO-X uses external API - no local GPU needed")
    print("✅ Fashion Crop API ready!\n")
    
    from api.server import app
    return app

