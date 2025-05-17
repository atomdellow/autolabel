# Test Detection Methods
# This script tests all detection methods in AutoLabel

import requests
import base64
import json
import os
import sys
from PIL import Image
import io

# Set the API endpoint
API_URL = "http://localhost:5001/api/detection/detect"
COMPARE_URL = "http://localhost:5001/api/detection/compare"

def read_image_as_base64(image_path):
    """Read an image file and convert it to base64"""
    if not os.path.exists(image_path):
        print(f"Image not found: {image_path}")
        sys.exit(1)
    
    with open(image_path, 'rb') as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return encoded_string

def test_detection_method(image_path, method, params=None):
    """Test a specific detection method"""
    print(f"\nTesting {method.upper()} detection method...")
    
    base64_image = read_image_as_base64(image_path)
    
    # Create payload
    payload = {
        "screenshot": base64_image,
        "detectionMethod": method
    }
    
    if params:
        payload["detectionParams"] = params
    
    # Send request to API
    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            result = response.json()
            detection_count = len(result.get("Detections", []))
            print(f"✓ Success! Detected {detection_count} objects")
            # Print first 3 detections as sample
            if detection_count > 0:
                print("Sample detections:")
                for i, det in enumerate(result.get("Detections", [])[:3]):
                    print(f"  {i+1}. Label: {det['Label']}, Confidence: {det['Confidence']:.2f}")
            return True
        else:
            print(f"✗ Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Exception: {e}")
        return False

def test_compare_screenshots(image_path1, image_path2):
    """Test the comparison functionality"""
    print("\nTesting SSIM comparison method...")
    
    base64_image1 = read_image_as_base64(image_path1)
    base64_image2 = read_image_as_base64(image_path2)
    
    # Create payload
    payload = {
        "screenshot1": base64_image1,
        "screenshot2": base64_image2
    }
    
    # Send request to API
    try:
        response = requests.post(COMPARE_URL, json=payload)
        if response.status_code == 200:
            result = response.json()
            changes = result.get("ComparisonResult", {}).get("changes", [])
            print(f"✓ Success! Found {len(changes)} differences")
            if len(changes) > 0:
                print("Sample changes:")
                for i, change in enumerate(changes[:3]):
                    print(f"  {i+1}. Position: ({change['x']}, {change['y']}), Size: {change['width']}x{change['height']}")
            return True
        else:
            print(f"✗ Error: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"✗ Exception: {e}")
        return False

def main():
    """Main test function"""
    print("=== AutoLabel Detection Methods Test ===")
    
    # Check if images folder exists in the uploads directory
    uploads_dir = os.path.join("..", "backend", "uploads")
    if not os.path.exists(uploads_dir):
        print(f"Uploads directory not found: {uploads_dir}")
        sys.exit(1)
    
    # Find image files in the uploads directory
    image_files = [f for f in os.listdir(uploads_dir) if f.endswith(('.png', '.jpg', '.jpeg'))]
    if not image_files:
        print("No image files found in uploads directory")
        sys.exit(1)
    
    # Get first two images for testing
    test_image = os.path.join(uploads_dir, image_files[0])
    print(f"Using test image: {test_image}")
    
    # Test YOLO detection
    test_detection_method(test_image, "yolo")
    
    # Test OpenCV detection with different parameters
    test_detection_method(test_image, "opencv", {"sensitivity": 0.5, "minArea": 100})
    test_detection_method(test_image, "opencv", {"sensitivity": 0.8, "minArea": 50})
    
    # Test SSIM comparison if we have at least 2 images
    if len(image_files) >= 2:
        test_image2 = os.path.join(uploads_dir, image_files[1])
        print(f"Using second image for comparison: {test_image2}")
        test_compare_screenshots(test_image, test_image2)
    else:
        print("\nSkipping SSIM test: Need at least 2 images")
    
    print("\n=== Test Complete ===")

if __name__ == "__main__":
    main()
