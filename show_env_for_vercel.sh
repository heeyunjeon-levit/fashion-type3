#!/bin/bash
# Script to display environment variables for copying to Vercel

echo "=========================================="
echo "Environment Variables for Vercel"
echo "=========================================="
echo ""
echo "Copy each of these to Vercel Dashboard:"
echo "Settings → Environment Variables"
echo ""
echo "For each variable:"
echo "  1. Click 'Add New'"
echo "  2. Copy the Name and Value below"
echo "  3. Select: Production, Preview, Development"
echo "  4. Click Save"
echo ""
echo "=========================================="
echo ""

if [ -f .env ]; then
  echo "1. NEXT_PUBLIC_PYTHON_CROPPER_URL"
  echo "   Value: https://heeyunjeon-levit--fashion-crop-api-fastapi-app.modal.run"
  echo ""
  
  echo "2. NEXT_PUBLIC_SUPABASE_URL"
  echo "   Value: $(grep NEXT_PUBLIC_SUPABASE_URL .env | cut -d= -f2-)"
  echo ""
  
  echo "3. NEXT_PUBLIC_SUPABASE_ANON_KEY"
  echo "   Value: $(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env | cut -d= -f2-)"
  echo ""
  
  echo "4. OPENAI_API_KEY"
  echo "   Value: $(grep OPENAI_API_KEY .env | cut -d= -f2-)"
  echo ""
  
  echo "5. SERPER_API_KEY"
  echo "   Value: $(grep SERPER_API_KEY .env | cut -d= -f2-)"
  echo ""
else
  echo "❌ .env file not found!"
  echo "Please run this from the project root: /Users/levit/Desktop/mvp"
fi

echo "=========================================="
echo "After adding all variables, Vercel will"
echo "automatically redeploy your app."
echo "=========================================="

