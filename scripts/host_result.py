"""
Host the single user result so it's accessible from any device.
"""

import os
import subprocess
import shutil
from pathlib import Path

def copy_to_vercel_public():
    """Copy HTML to Vercel public folder and deploy"""
    print("\n" + "="*60)
    print("Option 1: Deploy to Vercel")
    print("="*60)
    
    # Find the HTML file
    test_dir = Path('./single_user_test')
    html_files = list(test_dir.glob('*_result.html'))
    
    if not html_files:
        print("❌ No HTML file found in single_user_test/")
        return False
    
    html_file = html_files[0]
    phone = html_file.stem.replace('_result', '')
    
    # Create public/results directory
    public_dir = Path('./public/results')
    public_dir.mkdir(parents=True, exist_ok=True)
    
    # Copy file
    dest = public_dir / f"{phone}.html"
    shutil.copy(html_file, dest)
    print(f"✅ Copied to: {dest}")
    
    # Check if we're in a Vercel project
    if Path('./vercel.json').exists():
        print(f"\n📤 Deploying to Vercel...")
        print(f"   Run this command:")
        print(f"   vercel --prod")
        print(f"\n   Then access at:")
        print(f"   https://your-app.vercel.app/results/{phone}.html")
        return True
    else:
        print(f"\n⚠️  Not in a Vercel project")
        print(f"   You can still deploy manually:")
        print(f"   1. Run: vercel --prod")
        print(f"   2. Access: https://your-app.vercel.app/results/{phone}.html")
        return True

def use_local_server():
    """Start a local server with the HTML"""
    print("\n" + "="*60)
    print("Option 2: Local Server (Terminal Access)")
    print("="*60)
    
    test_dir = Path('./single_user_test')
    html_files = list(test_dir.glob('*_result.html'))
    
    if not html_files:
        print("❌ No HTML file found")
        return False
    
    phone = html_files[0].stem.replace('_result', '')
    
    print(f"\n📡 Starting local server on port 8000...")
    print(f"\n   Local access:")
    print(f"   http://localhost:8000/{phone}_result.html")
    print(f"\n   From other devices on same network:")
    print(f"   http://YOUR_IP:8000/{phone}_result.html")
    print(f"\n   (Replace YOUR_IP with your computer's IP address)")
    print(f"\n   Press Ctrl+C to stop the server")
    print(f"\n{'='*60}\n")
    
    try:
        os.chdir('single_user_test')
        subprocess.run(['python3', '-m', 'http.server', '8000'])
    except KeyboardInterrupt:
        print("\n\n✅ Server stopped")
    
    return True

def use_ngrok():
    """Use ngrok to create a public URL"""
    print("\n" + "="*60)
    print("Option 3: Public URL with ngrok")
    print("="*60)
    
    # Check if ngrok is installed
    try:
        subprocess.run(['ngrok', 'version'], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ ngrok is not installed")
        print("\nInstall it:")
        print("  brew install ngrok")
        print("or download from: https://ngrok.com/download")
        return False
    
    test_dir = Path('./single_user_test')
    html_files = list(test_dir.glob('*_result.html'))
    
    if not html_files:
        print("❌ No HTML file found")
        return False
    
    phone = html_files[0].stem.replace('_result', '')
    
    print(f"\n🚀 Starting ngrok tunnel...")
    print(f"\nThis will create a public URL accessible from any device!")
    print(f"The URL will be something like: https://xxxx-xxx-xxx.ngrok.io/{phone}_result.html")
    print(f"\n{'='*60}\n")
    
    # Start HTTP server in background
    import threading
    import time
    
    def run_server():
        os.chdir('single_user_test')
        subprocess.run(['python3', '-m', 'http.server', '8000'], 
                      stdout=subprocess.DEVNULL, 
                      stderr=subprocess.DEVNULL)
    
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()
    time.sleep(2)
    
    print("Starting ngrok...")
    print(f"\nLook for the 'Forwarding' URL in the output below:")
    print(f"Then add: /{phone}_result.html to the end")
    print(f"\n{'='*60}\n")
    
    try:
        subprocess.run(['ngrok', 'http', '8000'])
    except KeyboardInterrupt:
        print("\n\n✅ Tunnel stopped")
    
    return True

def main():
    print("="*60)
    print("Host Result - Make It Accessible from Any Device")
    print("="*60)
    
    print("\nChoose hosting method:")
    print("\n1. Deploy to Vercel (Permanent, Professional)")
    print("   ✅ Permanent URL")
    print("   ✅ Fast and reliable")
    print("   ✅ HTTPS")
    print("   ⚠️  Requires Vercel account")
    print("\n2. Local Server (Same Network Only)")
    print("   ✅ Quick and easy")
    print("   ✅ No setup needed")
    print("   ⚠️  Only works on same WiFi network")
    print("\n3. ngrok (Public URL, Temporary)")
    print("   ✅ Works from anywhere")
    print("   ✅ Instant public URL")
    print("   ⚠️  Requires ngrok installed")
    print("   ⚠️  URL changes each time")
    
    choice = input("\nEnter choice (1, 2, or 3): ").strip()
    
    if choice == '1':
        copy_to_vercel_public()
    elif choice == '2':
        use_local_server()
    elif choice == '3':
        use_ngrok()
    else:
        print("Invalid choice")

if __name__ == '__main__':
    main()

