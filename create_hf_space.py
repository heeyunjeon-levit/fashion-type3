#!/usr/bin/env python3
"""
Create and deploy Hugging Face Space for Fashion Crop API
"""
import os
import subprocess
import shutil
from pathlib import Path

def run_cmd(cmd, check=True):
    """Run a command and return output"""
    print(f"▶️  Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return None
    return result.stdout.strip()

def main():
    import sys
    
    print("🚀 Creating Hugging Face Space for Fashion Crop API\n")
    
    # Step 1: Check authentication or login
    print("Step 1: Checking Hugging Face authentication...")
    
    # Check if token provided as argument
    token = None
    if len(sys.argv) > 1:
        token = sys.argv[1]
        print(f"✅ Token provided as argument")
        os.environ['HF_TOKEN'] = token
    
    # Check environment variable
    if not token and os.environ.get('HF_TOKEN'):
        token = os.environ['HF_TOKEN']
        print(f"✅ Token found in environment")
    
    # Try to login if token provided
    if token:
        print("Logging in with provided token...")
        try:
            from huggingface_hub import login
            login(token=token)
            print("✅ Logged in successfully\n")
        except Exception as e:
            print(f"❌ Login failed: {e}")
            return
    
    # Check if authenticated
    try:
        from huggingface_hub import whoami
        user_info = whoami()
        username = user_info.get('name', 'unknown')
        print(f"✅ Authenticated as: {username}\n")
    except Exception as e:
        print("❌ Not authenticated. Please provide a token:")
        print("   1. Get your token from: https://huggingface.co/settings/tokens")
        print("   2. Run: python3 create_hf_space.py YOUR_TOKEN")
        print("   3. Or: export HF_TOKEN=YOUR_TOKEN && python3 create_hf_space.py")
        return
    
    # Step 2: Create Space
    space_name = "fashion-crop-api"
    space_repo = f"{username}/{space_name}"
    
    print(f"Step 2: Creating Space '{space_name}'...")
    print("⚠️  Note: Starting with CPU (cpu-basic) since Docker requires paid GPU.")
    print("   You can upgrade to GPU later in Space settings after adding payment method.\n")
    
    try:
        from huggingface_hub import create_repo
        repo_url = create_repo(
            repo_id=space_name,
            repo_type="space",
            space_sdk="docker",
            space_hardware="cpu-basic",  # Start with CPU, upgrade to GPU later
            private=False,
        )
        print(f"✅ Space created: {repo_url}\n")
        print("💡 To upgrade to GPU:")
        print("   1. Go to Space settings → Hardware")
        print("   2. Select 'a10g-small' or 't4-small'")
        print("   3. Add payment method if needed\n")
    except Exception as e:
        if "already exists" in str(e).lower():
            print(f"⚠️  Space already exists, will reuse: {space_repo}\n")
        else:
            print(f"❌ Error creating space: {e}")
            return
    
    # Step 3: Clone Space
    print("Step 3: Cloning Space repository...")
    clone_dir = Path.home() / "fashion-crop-api-space"
    if clone_dir.exists():
        print(f"⚠️  Directory exists: {clone_dir}")
        response = input("Delete and re-clone? (y/n): ")
        if response.lower() == 'y':
            shutil.rmtree(clone_dir)
        else:
            print("Using existing directory...")
            os.chdir(clone_dir)
            run_cmd("git pull", check=False)
            print(f"✅ Using existing directory: {clone_dir}\n")
    else:
        clone_url = f"https://huggingface.co/spaces/{space_repo}"
        output = run_cmd(f"git clone {clone_url} {clone_dir}")
        if output is None:
            print("❌ Failed to clone repository")
            return
        print(f"✅ Cloned to: {clone_dir}\n")
    
    os.chdir(clone_dir)
    
    # Step 4: Copy files
    print("Step 4: Copying deployment files...")
    project_root = Path("/Users/levit/Desktop/mvp")
    
    files_to_copy = [
        ("Dockerfile", "Dockerfile"),
        ("requirements-gpu.txt", "requirements-gpu.txt"),
        ("README.md", "README.md"),
    ]
    
    dirs_to_copy = [
        ("python_backend/api", "api"),
        ("python_backend/src", "src"),
        ("python_backend/configs", "configs"),
        ("python_backend/data", "data"),
    ]
    
    single_files = [
        ("python_backend/crop_api.py", "crop_api.py"),
        ("python_backend/custom_item_cropper.py", "custom_item_cropper.py"),
    ]
    
    for src, dst in files_to_copy:
        src_path = project_root / src
        dst_path = clone_dir / dst
        if src_path.exists():
            shutil.copy2(src_path, dst_path)
            print(f"  ✅ Copied {src} → {dst}")
        else:
            print(f"  ⚠️  Missing: {src}")
    
    for src, dst in dirs_to_copy:
        src_path = project_root / src
        dst_path = clone_dir / dst
        if src_path.exists():
            if dst_path.exists():
                shutil.rmtree(dst_path)
            shutil.copytree(src_path, dst_path)
            print(f"  ✅ Copied {src}/ → {dst}/")
        else:
            print(f"  ⚠️  Missing: {src}")
    
    for src, dst in single_files:
        src_path = project_root / src
        dst_path = clone_dir / dst
        if src_path.exists():
            shutil.copy2(src_path, dst_path)
            print(f"  ✅ Copied {src} → {dst}")
        else:
            print(f"  ⚠️  Missing: {src}")
    
    print("✅ Files copied\n")
    
    # Step 5: Commit and push
    print("Step 5: Committing and pushing...")
    run_cmd("git add -A", check=False)
    run_cmd('git commit -m "Initial deployment: Fashion Crop API with GPU support"', check=False)
    output = run_cmd("git push")
    
    if output is not None:
        print("\n✅ Space deployed successfully!")
        print(f"\n🌐 Your Space URL: https://huggingface.co/spaces/{space_repo}")
        print("\n📋 Next steps:")
        print("   1. Go to Space settings and add environment variables:")
        print("      - OPENAI_API_KEY")
        print("      - SUPABASE_URL")
        print("      - SUPABASE_ANON_KEY")
        print("      - USE_SAM2=false")
        print("   2. Wait for build to complete (~5-10 minutes)")
        print("   3. Test the API at: https://huggingface.co/spaces/{space_repo}")
        print("   4. Update Vercel env var:")
        print(f"      NEXT_PUBLIC_PYTHON_CROPPER_URL=https://{username}-fashion-crop-api.hf.space")

if __name__ == "__main__":
    main()

