"""
Modal GPU deployment using HuggingFace Transformers GroundingDINO
Clean, simple, and GPU-accelerated
"""
import modal
import os
from pathlib import Path

# Create Modal app - GPU mode with transformers
app = modal.App("fashion-crop-api-gpu")

# Get the backend directory
backend_dir = Path(__file__).parent

# Create a persistent volume for model weights
model_volume = modal.Volume.from_name("fashion-model-weights-gpu", create_if_missing=True)

# Following Modal's CUDA guide: https://modal.com/docs/guide/cuda
# Using GPU-enabled PyTorch with transformers' GroundingDINO
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git",
        "wget", 
        "curl",
        "ffmpeg",
        "libgl1",
        "libglib2.0-0",
    )
    # Install GPU-enabled PyTorch (Modal already has CUDA drivers)
    .pip_install(
        "torch==2.4.1",
        "torchvision==0.19.1",
        extra_options="--index-url https://download.pytorch.org/whl/cu121"  # CUDA 12.1
    )
    .pip_install("numpy>=1.26,<2")
    # Install FastAPI and basic dependencies
    .pip_install(
        "fastapi==0.104.1",
        "uvicorn==0.24.0",
        "python-multipart==0.0.6",
        "pydantic==2.5.0",
        "python-dotenv==1.0.0",
        "requests==2.31.0",
    )
    # Install ML/Vision dependencies
    .pip_install(
        "opencv-python-headless==4.9.0.80",
        "pandas==2.2.2",
        "PyYAML==6.0.1",
        "Pillow>=9.0.0",
    )
    # Install HuggingFace transformers with GroundingDINO support
    .pip_install(
        "transformers>=4.41.0",
        "timm>=0.9.12",
        "accelerate>=0.20.0",  # For efficient model loading
    )
    # Install other dependencies
    .pip_install(
        "supabase==2.10.0",
        "openai>=1.0.0",
        "boto3>=1.28.0",
        "dds-cloudapi-sdk>=0.2.4",  # For DINO-X detection
    )
    # Add all necessary Python modules into the image
    .add_local_dir(backend_dir / "api", "/root/api")
    .add_local_dir(backend_dir / "src", "/root/src")
    # Note: No need for GroundingDINO configs - transformers handles it
    .add_local_file(backend_dir / "crop_api_gpu.py", "/root/crop_api.py")
    .add_local_file(backend_dir / "custom_item_cropper_gpu.py", "/root/custom_item_cropper.py")
)

# Helper function to ensure models are in the volume
def ensure_models_in_volume():
    """
    Download models to volume if they don't exist yet.
    This runs once on first deployment, then models are cached.
    """
    import os
    from pathlib import Path
    
    volume_cache_dir = "/cache/models"
    os.makedirs(volume_cache_dir, exist_ok=True)
    
    # Set Hugging Face cache to volume
    os.environ["HF_HOME"] = volume_cache_dir
    os.environ["TRANSFORMERS_CACHE"] = volume_cache_dir
    
    print(f"📦 HuggingFace cache: {volume_cache_dir}")
    
    # Download GroundingDINO model from HuggingFace
    grounding_dino_path = f"{volume_cache_dir}/grounding-dino-tiny"
    
    if not os.path.exists(grounding_dino_path):
        print("📥 Downloading GroundingDINO model from HuggingFace...")
        from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
        
        model_id = "IDEA-Research/grounding-dino-tiny"
        processor = AutoProcessor.from_pretrained(model_id, cache_dir=volume_cache_dir)
        model = AutoModelForZeroShotObjectDetection.from_pretrained(
            model_id, 
            cache_dir=volume_cache_dir
        )
        
        print(f"✅ GroundingDINO model downloaded to {grounding_dino_path}")
    else:
        print(f"✅ GroundingDINO model found in cache")
    
    return volume_cache_dir

# Test function to verify PyTorch/GPU works
@app.function(image=image, gpu="any", cpu=2.0)
def test_gpu():
    import torch
    import subprocess
    
    print("🔍 Testing GPU setup...")
    
    # Check nvidia-smi
    try:
        output = subprocess.check_output(["nvidia-smi"], text=True)
        print("✅ nvidia-smi output:")
        print(output)
    except Exception as e:
        print(f"❌ nvidia-smi failed: {e}")
    
    # Check PyTorch CUDA
    print(f"\n✅ PyTorch version: {torch.__version__}")
    print(f"✅ CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        print(f"✅ CUDA device: {torch.cuda.get_device_name(0)}")
        print(f"✅ CUDA version: {torch.version.cuda}")
    
    return {
        "cuda_available": torch.cuda.is_available(),
        "torch_version": torch.__version__,
        "cuda_version": torch.version.cuda if torch.cuda.is_available() else None
    }

# Test GroundingDINO inference
@app.function(
    image=image,
    gpu="any",
    cpu=2.0,
    memory=16384,
    timeout=600,
    volumes={"/cache": model_volume},
    secrets=[modal.Secret.from_name("fashion-api-keys")],
)
def test_grounding_dino():
    import torch
    from transformers import AutoProcessor, AutoModelForZeroShotObjectDetection
    from PIL import Image
    import requests
    
    print("🔍 Testing GroundingDINO...")
    
    # Set cache directory
    cache_dir = ensure_models_in_volume()
    
    # Load model
    model_id = "IDEA-Research/grounding-dino-tiny"
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"📍 Using device: {device}")
    
    processor = AutoProcessor.from_pretrained(model_id, cache_dir=cache_dir)
    model = AutoModelForZeroShotObjectDetection.from_pretrained(
        model_id, 
        cache_dir=cache_dir
    ).to(device)
    
    # Test with a sample image
    image_url = "http://images.cocodataset.org/val2017/000000039769.jpg"
    image = Image.open(requests.get(image_url, stream=True).raw)
    text_labels = [["a cat", "a remote control"]]
    
    inputs = processor(images=image, text=text_labels, return_tensors="pt").to(device)
    
    with torch.no_grad():
        outputs = model(**inputs)
    
    results = processor.post_process_grounded_object_detection(
        outputs,
        threshold=0.4,
        text_threshold=0.3,
        target_sizes=[(image.height, image.width)]
    )
    
    result = results[0]
    detections = []
    for box, score, text_label in zip(result["boxes"], result["scores"], result["text_labels"]):
        box = [round(x, 2) for x in box.tolist()]
        detection = f"Detected {text_label} with confidence {round(score.item(), 3)} at location {box}"
        print(detection)
        detections.append(detection)
    
    return {
        "device": device,
        "detections": detections,
        "success": len(detections) > 0
    }

# Deploy the FastAPI app with GPU support
@app.function(
    image=image,
    gpu="any",  # Start with any GPU, can specify later
    cpu=2.0,
    memory=16384,  # 16GB for ML models
    timeout=600,
    volumes={"/cache": model_volume},
    secrets=[
        modal.Secret.from_name("fashion-api-keys"),  # OPENAI_API_KEY, SUPABASE keys
        modal.Secret.from_name("dinox-api-key"),     # DDS_API_TOKEN for DINO-X
    ],
    scaledown_window=600,  # Keep container warm for 10 minutes
)
@modal.concurrent(max_inputs=10)  # Allow up to 10 concurrent requests
@modal.asgi_app()
def fastapi_app_v2():
    """
    Load and return the FastAPI app with GPU-accelerated GroundingDINO
    
    Features:
    - GPT-4o Vision detection (default)
    - DINO-X detection (set USE_DINOX=true in request)
    - Hybrid: DINO-X + GPT-4o-mini descriptions (best speed/cost)
    
    Deployed at: https://heeyunjeon-levit--fashion-crop-api-gpu-fastapi-app-v2.modal.run/
    """
    import sys
    sys.path.append("/root")
    
    # Set environment variables for model caching
    cache_dir = ensure_models_in_volume()
    os.environ["HF_HOME"] = cache_dir
    os.environ["TRANSFORMERS_CACHE"] = cache_dir
    
    # DINO-X is controlled per-request via use_dinox parameter
    # No need to set USE_DINOX here - it's handled dynamically
    
    from api.server import app as fastapi_app
    return fastapi_app

# Local testing entrypoint
@app.local_entrypoint()
def main():
    print("🧪 Running GPU tests...")
    
    # Test 1: GPU availability
    print("\n" + "="*80)
    print("TEST 1: GPU Availability")
    print("="*80)
    result = test_gpu.remote()
    print(f"Result: {result}")
    
    # Test 2: GroundingDINO inference
    print("\n" + "="*80)
    print("TEST 2: GroundingDINO Inference")
    print("="*80)
    result = test_grounding_dino.remote()
    print(f"Result: {result}")
    
    print("\n✅ All tests completed!")

# Force rebuild
