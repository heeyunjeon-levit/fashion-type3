#!/bin/bash
# Start the Python FastAPI server

echo "🚀 Starting Python Cropper Server..."
echo "📍 Server will be available at http://localhost:8000"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️ Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if not already installed
if [ ! -f "venv/.installed" ]; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
    touch venv/.installed
fi

# Start the server
echo "✅ Starting FastAPI server..."
uvicorn api.server:app --reload --host 0.0.0.0 --port 8000

