"""
Modal deployment for Fashion Crop API
This runs your heavy ML backend on Modal's infrastructure
"""
import modal

# Create Modal app
stub = modal.App("fashion-crop-api")

# Define the image with all dependencies
image = (
    modal.Image.debian_slim(python_version="3.10")
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "python-dotenv==1.0.0",
        "boto3>=1.28.0",
        "torch==2.2.0",
        "torchvision==0.17.0",
        "opencv-python-headless==4.9.0.80",
        "numpy==1.26.4",
        "Pillow==10.3.0",
        "pandas==2.2.2",
        "PyYAML==6.0.1",
        "requests==2.31.0",
        "transformers==4.41.0",
        "segment-anything==1.0",
        "ultralytics==8.2.0",
        "groundingdino-pytorch==0.1.2",
        "timm==0.9.12",
    )
)

# Mount your code
@stub.function(
    image=image,
    gpu=None,  # CPU only to save costs, can add GPU if needed
    memory=8192,  # 8GB RAM for models
    timeout=600,  # 10 minute timeout
    secrets=[
        modal.Secret.from_name("openai-api-key"),
        modal.Secret.from_name("supabase-credentials"),
    ],
)
@modal.asgi_app()
def fastapi_app():
    from api.server import app
    return app

