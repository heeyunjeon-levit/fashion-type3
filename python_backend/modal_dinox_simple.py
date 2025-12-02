"""
Simplified Modal deployment for DINO-X API backend
No GroundingDINO compilation needed - uses DINO-X API directly
"""

import modal
from pathlib import Path

# Create Modal app
app = modal.App("fashion-crop-api-gpu")

# Create volume for model weights (for future use)
model_volume = modal.Volume.from_name("fashion-models-gpu-cache", create_if_missing=True)

# Get the backend directory
backend_dir = Path(__file__).parent

# Simple image without GroundingDINO compilation
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "fastapi",
        "pydantic",
        "python-multipart",
        "openai",
        "python-dotenv",
        "supabase",
        "requests",
        "httpx",
        "pillow",
        "opencv-python-headless",
        "sse-starlette",
    )
    # Add the backend code
    .add_local_dir(backend_dir, "/opt/python_backend")
)

@app.function(
    image=image,
    gpu="t4",  # Keep T4 for future GPU use
    cpu=2.0,
    memory=8192,  # 8GB is enough for API calls
    timeout=600,
    volumes={"/cache": model_volume},
    secrets=[
        modal.Secret.from_name("fashion-api-keys"),  # OPENAI_API_KEY, SUPABASE keys
        modal.Secret.from_name("dinox-api-key"),     # DINOX_API_TOKEN
    ],
    scaledown_window=60,  # Keep warm for 1 min
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app_v2():
    """
    Load and return the FastAPI app with DINO-X API detection
    """
    import sys
    import os
    
    # Set Python path
    sys.path.insert(0, "/opt/python_backend")
    
    # Set working directory
    os.chdir("/opt/python_backend")
    
    print("\n🚀 Starting Fashion Crop API (DINO-X API mode)...")
    print("✅ Using DINO-X API for detection (no local model)")
    print("✅ GPT-4o-mini for descriptions")
    print("✅ Supabase for storage")
    
    from api.server import app
    return app

