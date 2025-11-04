"""
Simplest possible GPU deployment - back to basics with working configuration
"""
import modal
from pathlib import Path

app = modal.App("fashion-crop-api-gpu")
model_volume = modal.Volume.from_name("fashion-models-gpu-cache", create_if_missing=True)
backend_dir = Path(__file__).parent

# SIMPLEST approach: Use the image that was working before (cropper_available: true)
# Just fix the paths to use /root consistently
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git", "wget", "curl", "ffmpeg", "libgl1", "libglib2.0-0",
        "build-essential", "python3-dev",
    )
    # Install PyTorch CPU (GPU had _C issues, let's try CPU cropping on GPU instance for now)
    .pip_install(
        "torch==2.4.1+cpu",
        "torchvision==0.19.1+cpu",
        extra_options="--index-url https://download.pytorch.org/whl/cpu"
    )
    .pip_install("numpy>=1.26,<2")
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
    .run_commands(
        "cd /root && git clone https://github.com/IDEA-Research/GroundingDINO.git && "
        "cd /root/GroundingDINO && pip install -e ."
    )
    .run_commands(
        "mkdir -p /root/GroundingDINO/weights",
        "cd /root/GroundingDINO/weights && wget -q https://github.com/IDEA-Research/GroundingDINO/releases/download/v0.1.0-alpha/groundingdino_swint_ogc.pth"
    )
    .add_local_dir(backend_dir, "/root/python_backend")
)

@app.function(
    image=image,
    gpu="t4",  # Use GPU instance for faster inference (even with CPU PyTorch for now)
    cpu=2.0,
    memory=16384,
    timeout=600,
    volumes={"/cache": model_volume},
    secrets=[modal.Secret.from_name("fashion-api-keys")],
    scaledown_window=600,
)
@modal.concurrent(max_inputs=10)
@modal.asgi_app()
def fastapi_app_v2():
    import sys
    import os
    sys.path.insert(0, "/root/GroundingDINO")
    sys.path.insert(0, "/root/python_backend")
    os.chdir("/root/python_backend")
    os.environ["USE_SAM2"] = "false"
    from api.server import app
    return app

