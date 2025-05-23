#!/usr/bin/env python
"""
Test script for the LLM annotation naming feature
This script tests the OpenAI API key and basic LLM annotations functionality
"""

import os
import sys
import json
import argparse
from dotenv import load_dotenv

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import the name_annotations function from the main script
from llm_vision_detector import name_annotations, process_url_image

def test_api_key():
    """Test if the OpenAI API key is properly set up and working"""
    # Load environment variables
    load_dotenv()
    
    # Check if OpenAI API key is available
    api_key = os.environ.get('OPENAI_API_KEY')
    
    if not api_key:
        print("[ERROR] OpenAI API key not found in environment variables")
        print("Please add your OpenAI API key to the .env file (OPENAI_API_KEY=your_key_here)")
        return False
        
    print(f"[OK] OpenAI API key found in environment variables (starts with {api_key[:5]}...)")
    return True

def test_image_loading(image_url):
    """Test if we can load an image from the given URL"""
    try:
        print(f"Testing image loading from URL: {image_url}")
        image = process_url_image(image_url)
        print(f"[OK] Successfully loaded image, size: {image.size[0]}x{image.size[1]}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to load image: {e}")
        return False

def test_name_annotation(image_url, annotation):
    """Test the name_annotations function with a single annotation"""
    print(f"Testing LLM annotation naming with a single annotation")
    
    # Create a simple annotation
    test_annotation = {
        "x": annotation[0],
        "y": annotation[1],
        "width": annotation[2],
        "height": annotation[3],
        "label": "unnamed"
    }
    
    try:
        result = name_annotations(image_url, [test_annotation])
        if "error" in result:
            print(f"[ERROR] Naming failed: {result['error']}")
            return False
            
        if "annotations" in result and len(result["annotations"]) > 0:
            new_label = result["annotations"][0].get("label", "")
            print(f"[OK] Successfully named annotation: '{new_label}'")
            return True
        else:
            print("[ERROR] No annotations in result")
            return False
    except Exception as e:
        print(f"[ERROR] Exception during naming: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Test LLM annotation naming functionality')
    parser.add_argument('--image_url', default='https://raw.githubusercontent.com/openai/openai-python/main/examples/images/image.png',
                        help='URL of the image to use for testing (default: OpenAI sample image)')
    parser.add_argument('--annotation', nargs=4, type=int, default=[10, 10, 100, 100],
                        help='Annotation to name in format: x y width height (default: 10 10 100 100)')
    
    args = parser.parse_args()
    
    print("Starting LLM annotation naming tests...")
    
    # Test API key
    if not test_api_key():
        print("API key test failed, aborting further tests")
        return 1
    
    # Test image loading
    if not test_image_loading(args.image_url):
        print("Image loading test failed, aborting further tests")
        return 1
    
    # Test annotation naming
    if not test_name_annotation(args.image_url, args.annotation):
        print("Annotation naming test failed")
        return 1
    
    print("All tests completed successfully!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
