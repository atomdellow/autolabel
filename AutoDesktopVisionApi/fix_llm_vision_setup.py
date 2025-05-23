#!/usr/bin/env python
"""
Helper script for fixing common issues with LLM Vision implementation
This script helps diagnose and fix common issues with the OpenAI API setup and configuration
"""

import os
import sys
import json
import requests
import subprocess
import platform
from dotenv import load_dotenv

def check_environment():
    """Check the Python environment and required packages"""
    print("Checking Python environment...")
    
    # Check Python version
    python_version = sys.version_info
    print(f"Python version: {python_version.major}.{python_version.minor}.{python_version.micro}")
    if python_version.major != 3 or python_version.minor < 8:
        print("[WARNING] Recommended Python version is 3.8 or later")
    
    # Check required packages
    required_packages = ["openai", "pillow", "requests", "python-dotenv"]
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package)
            print(f"[OK] Package {package} is installed")
        except ImportError:
            missing_packages.append(package)
            print(f"[MISSING] Package {package} is not installed")
    
    if missing_packages:
        print("\nInstall missing packages with:")
        print(f"pip install {' '.join(missing_packages)}")
        return False
    
    return True

def check_api_key():
    """Check if the OpenAI API key is properly configured"""
    print("\nChecking OpenAI API key configuration...")
    
    # Load environment variables
    load_dotenv()
    
    # Check .env file
    backend_env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env")
    local_env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    
    api_key = os.environ.get('OPENAI_API_KEY')
    env_file_found = False
    
    # Check if API key is in environment
    if api_key:
        print(f"[OK] OpenAI API key found in environment (starts with {api_key[:5]}...)")
    else:
        print("[MISSING] OpenAI API key not found in environment variables")
        
        # Check if .env file exists in backend folder
        if os.path.exists(backend_env_path):
            env_file_found = True
            print(f"[FOUND] .env file found in backend folder: {backend_env_path}")
            with open(backend_env_path, 'r') as f:
                env_content = f.read()
                if 'OPENAI_API_KEY' in env_content:
                    print("[INFO] OPENAI_API_KEY found in backend .env file but not loaded in environment")
                    print("[SOLUTION] Make sure to load environment variables using dotenv")
                else:
                    print("[MISSING] OPENAI_API_KEY not found in backend .env file")
                    print("[SOLUTION] Add OPENAI_API_KEY=your_key_here to the backend .env file")
        
        # Check if .env file exists in current folder
        if os.path.exists(local_env_path):
            env_file_found = True
            print(f"[FOUND] Local .env file found: {local_env_path}")
            with open(local_env_path, 'r') as f:
                env_content = f.read()
                if 'OPENAI_API_KEY' in env_content:
                    print("[INFO] OPENAI_API_KEY found in local .env file but not loaded in environment")
                    print("[SOLUTION] Make sure to load environment variables using dotenv")
                else:
                    print("[MISSING] OPENAI_API_KEY not found in local .env file")
                    print("[SOLUTION] Add OPENAI_API_KEY=your_key_here to the local .env file")
        
        if not env_file_found:
            print("[MISSING] No .env file found")
            print("[SOLUTION] Create a .env file with OPENAI_API_KEY=your_key_here")
            
        return False
    
    # Verify API key format
    if not api_key.startswith(('sk-', 'sk-proj-')):
        print("[WARNING] OpenAI API key has an unusual format (should start with 'sk-')")
    
    # Try to validate the API key with a simple request
    try:
        print("\nValidating OpenAI API key with a test request...")
        
        # Use requests to make a simple API call
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        response = requests.get("https://api.openai.com/v1/models", headers=headers)
        
        if response.status_code == 200:
            print("[OK] API key is valid. Successfully connected to OpenAI API")
            return True
        else:
            error_info = response.json()
            print(f"[ERROR] API key validation failed: {error_info.get('error', {}).get('message', 'Unknown error')}")
            return False
    except Exception as e:
        print(f"[ERROR] API key validation failed: {e}")
        return False

def check_model_access():
    """Check if we have access to the GPT-4 Vision model"""
    print("\nChecking access to GPT-4 Vision model...")
    
    # Load environment variables
    load_dotenv()
    api_key = os.environ.get('OPENAI_API_KEY')
    
    if not api_key:
        print("[ERROR] Cannot check model access: No API key found")
        return False
    
    try:
        # Use requests to check models
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        response = requests.get("https://api.openai.com/v1/models", headers=headers)
        
        if response.status_code != 200:
            print(f"[ERROR] Failed to fetch models: {response.status_code}")
            return False
            
        models = response.json()["data"]
        model_ids = [model["id"] for model in models]
        
        # Check for GPT-4 Vision model
        vision_model = "gpt-4-vision-preview"
        
        if vision_model in model_ids:
            print(f"[OK] Model '{vision_model}' is available")
            return True
        else:
            print(f"[ERROR] Model '{vision_model}' not found in available models")
            print("[SOLUTION] Make sure your OpenAI account has access to GPT-4 Vision")
            print("          Visit https://platform.openai.com/account/limits to check your access")
            return False
    except Exception as e:
        print(f"[ERROR] Failed to check model access: {e}")
        return False

def check_system_path():
    """Check system PATH for Python"""
    print("\nChecking system PATH configuration...")
    
    # Get the system platform
    current_platform = platform.system()
    path_env = os.environ.get('PATH', '')
    
    print(f"Operating system: {current_platform}")
    
    if current_platform == 'Windows':
        python_path = os.path.dirname(sys.executable)
        if python_path.lower() in path_env.lower():
            print(f"[OK] Python directory is in PATH: {python_path}")
        else:
            print(f"[WARNING] Python directory not found in PATH: {python_path}")
            print("[SOLUTION] Add the Python directory to your system PATH")
    elif current_platform in ['Linux', 'Darwin']:  # Darwin is macOS
        try:
            # Use 'which python' to find Python path
            which_python = subprocess.check_output(['which', 'python']).decode().strip()
            print(f"[OK] Python found at: {which_python}")
        except subprocess.SubprocessError:
            print("[WARNING] Could not determine Python path with 'which python'")
    
    return True

def fix_issues():
    """Attempt to fix common issues automatically"""
    print("\nAttempting to fix common issues...")
    
    # Create or update .env file
    env_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    backend_env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", ".env")
    
    api_key = input("Enter your OpenAI API key (press Enter to skip): ").strip()
    
    if api_key:
        try:
            # Check if .env file exists and contains OpenAI API key
            if os.path.exists(env_file):
                with open(env_file, 'r') as f:
                    env_content = f.read()
                
                # Update existing API key or add new one
                if 'OPENAI_API_KEY=' in env_content:
                    env_content = '\n'.join([
                        line if not line.startswith('OPENAI_API_KEY=') else f'OPENAI_API_KEY={api_key}'
                        for line in env_content.split('\n')
                    ])
                else:
                    env_content += f"\nOPENAI_API_KEY={api_key}\n"
                
                with open(env_file, 'w') as f:
                    f.write(env_content)
            else:
                # Create new .env file
                with open(env_file, 'w') as f:
                    f.write(f"OPENAI_API_KEY={api_key}\n")
            
            print(f"[FIXED] Updated OPENAI_API_KEY in {env_file}")
            
            # Also update backend .env if it exists
            if os.path.exists(backend_env_file):
                try:
                    with open(backend_env_file, 'r') as f:
                        backend_env_content = f.read()
                    
                    # Update existing API key or add new one
                    if 'OPENAI_API_KEY=' in backend_env_content:
                        backend_env_content = '\n'.join([
                            line if not line.startswith('OPENAI_API_KEY=') else f'OPENAI_API_KEY={api_key}'
                            for line in backend_env_content.split('\n')
                        ])
                    else:
                        backend_env_content += f"\nOPENAI_API_KEY={api_key}\n"
                    
                    with open(backend_env_file, 'w') as f:
                        f.write(backend_env_content)
                    
                    print(f"[FIXED] Updated OPENAI_API_KEY in {backend_env_file}")
                except Exception as e:
                    print(f"[ERROR] Failed to update backend .env file: {e}")
        except Exception as e:
            print(f"[ERROR] Failed to update .env file: {e}")
    
    # Install missing packages
    install_packages = input("Install missing packages? (y/n): ").strip().lower()
    if install_packages == 'y':
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "openai", "pillow", "requests", "python-dotenv"])
            print("[FIXED] Installed required packages")
        except subprocess.SubprocessError as e:
            print(f"[ERROR] Failed to install packages: {e}")
    
    print("\nFix attempts completed. Run the script again to verify fixes.")

def main():
    print("="*60)
    print(" LLM Vision Configuration Diagnostics Tool ")
    print("="*60)
    
    all_passed = True
    
    # Run all checks
    all_passed = check_environment() and all_passed
    all_passed = check_api_key() and all_passed
    all_passed = check_model_access() and all_passed
    all_passed = check_system_path() and all_passed
    
    print("\n" + "="*60)
    if all_passed:
        print("[SUCCESS] All checks passed! Your LLM Vision setup should work correctly.")
    else:
        print("[WARNING] Some checks failed. Review the issues above.")
        fix_prompt = input("Would you like to attempt automatic fixes? (y/n): ").strip().lower()
        if fix_prompt == 'y':
            fix_issues()
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
