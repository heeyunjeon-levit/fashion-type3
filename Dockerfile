# Hugging Face Spaces Dockerfile for Fashion Crop API
# This uses GPU (A10G) which should work better with PyTorch than Modal

FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    wget \
    curl \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install PyTorch with CUDA first (GPU-enabled)
# Hugging Face Spaces uses CUDA 11.8 or 12.1
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cu121 \
    torch>=2.5.1 \
    torchvision>=0.20.1

# Copy requirements first for better caching
COPY requirements-gpu.txt .

# Install remaining Python dependencies
RUN pip install --no-cache-dir -r requirements-gpu.txt

# Install GroundingDINO from GitHub
RUN cd /tmp && \
    git clone https://github.com/IDEA-Research/GroundingDINO.git && \
    cd GroundingDINO && \
    pip install -e . && \
    cd /app && \
    rm -rf /tmp/GroundingDINO

# Install SAM-2 from GitHub
RUN cd /tmp && \
    git clone https://github.com/facebookresearch/segment-anything-2.git && \
    cd segment-anything-2 && \
    pip install -e . --no-deps && \
    pip install hydra-core>=1.3.2 iopath>=0.1.10 tqdm>=4.66.1 && \
    cd /app && \
    rm -rf /tmp/segment-anything-2

# Copy application code
# Note: Files should be copied to Space root before building
COPY api /app/api
COPY src /app/src
COPY configs /app/configs
COPY data/weights /app/data/weights
COPY crop_api.py /app/
COPY custom_item_cropper.py /app/

# Set environment variables
ENV PYTHONPATH=/app
ENV USE_SAM2=false
ENV PORT=7860

# Expose port (Hugging Face Spaces uses 7860)
EXPOSE 7860

# Run FastAPI server
CMD ["python", "-m", "uvicorn", "api.server:app", "--host", "0.0.0.0", "--port", "7860"]

