#!/usr/bin/env python3
"""
Test all detection methods via the API

This script tests all three detection methods (YOLO, OpenCV, SSIM) to ensure
they are working correctly through the backend API.
"""

import os
import sys
import requests
import json
import base64
import argparse
import time
from PIL import Image
import io

# Default API endpoint
DEFAULT_API_URL = "http://localhost:5001/api/detection/detect"
COMPARE_API_URL = "http://localhost:5001/api/detection/compare"

def encode_image_to_base64(image_path):
    """Convert an image file to base64 string"""
    try:
        with open(image_path, 'rb') as f:
            image_data = f.read()
            base64_data = base64.b64encode(image_data).decode('utf-8')
            return base64_data
    except Exception as e:
        print(f"Error encoding image: {e}")
        return None

def test_detection_method(image_path, method='yolo', params=None, api_url=DEFAULT_API_URL):
    """
    Test a specific detection method via the API
    
    Args:
        image_path: Path to the test image
        method: Detection method ('yolo', 'opencv', or 'ssim')
        params: Additional parameters for the detection method
        api_url: The API endpoint URL
    """
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        return False
    
    # Encode the image
    base64_data = encode_image_to_base64(image_path)
    if not base64_data:
        return False
    
    # Prepare the request payload
    payload = {
        "screenshot": base64_data,
        "detectionMethod": method
    }
    
    # Add method-specific parameters
    if method == 'opencv' and params:
        payload["detectionParams"] = params
    
    # Make the request
    print(f"\n{'='*60}")
    print(f"Testing {method.upper()} detection via API")
    print(f"{'='*60}")
    print(f"Sending request to: {api_url}")
    print(f"Method: {method}")
    if method == 'opencv' and params:
        print(f"Parameters: {json.dumps(params, indent=2)}")
    
    try:
        start_time = time.time()
        response = requests.post(
            api_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30  # 30 seconds timeout
        )
        elapsed_time = time.time() - start_time
        
        print(f"\nResponse status: {response.status_code}")
        print(f"Response time: {elapsed_time:.2f} seconds")
        
        if response.status_code == 200:
            # Success
            data = response.json()
            
            # Extract and print detection info
            detections = data.get("Detections", [])
            if len(detections) > 0:
                print(f"\nDetected {len(detections)} objects:")
                for i, det in enumerate(detections[:5]):  # Show only first 5 detections
                    print(f"  {i+1}. {det['Label']} (Confidence: {det['Confidence']:.2f})")
                
                if len(detections) > 5:
                    print(f"  ... and {len(detections) - 5} more")
                
                print("\n✅ Test passed")
                return True
            else:
                print("\nNo objects detected")
                print("✅ Test passed (with no detections)")
                return True
        else:
            # Error
            print("\n❌ Test failed")
            print(f"Error: {response.status_code}")
            try:
                error_info = response.json()
                print(f"Error details: {json.dumps(error_info, indent=2)}")
            except:
                print(f"Response text: {response.text}")
            return False
    
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Test failed: {e}")
        return False

def test_compare_screenshots(image_path1, image_path2, api_url=COMPARE_API_URL):
    """Test the screenshot comparison API"""
    if not os.path.exists(image_path1) or not os.path.exists(image_path2):
        print(f"Error: One or both images not found")
        return False
    
    # Encode both images
    base64_data1 = encode_image_to_base64(image_path1)
    base64_data2 = encode_image_to_base64(image_path2)
    
    if not base64_data1 or not base64_data2:
        return False
    
    # Prepare the request payload
    payload = {
        "screenshot1": base64_data1,
        "screenshot2": base64_data2
    }
    
    # Make the request
    print(f"\n{'='*60}")
    print(f"Testing SSIM comparison via API")
    print(f"{'='*60}")
    print(f"Sending request to: {api_url}")
    print(f"Comparing: {os.path.basename(image_path1)} with {os.path.basename(image_path2)}")
    
    try:
        start_time = time.time()
        response = requests.post(
            api_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30  # 30 seconds timeout
        )
        elapsed_time = time.time() - start_time
        
        print(f"\nResponse status: {response.status_code}")
        print(f"Response time: {elapsed_time:.2f} seconds")
        
        if response.status_code == 200:
            # Success
            data = response.json()
            
            # Extract and print comparison info
            if "ComparisonResult" in data:
                similarity = data["ComparisonResult"]["similarity_score"]
                changes = data["ComparisonResult"]["changes"]
                
                print(f"\nSimilarity score: {similarity:.4f}")
                print(f"Detected {len(changes)} changes between images")
                
                if len(changes) > 0:
                    print("\nTop 5 changes by area:")
                    # Sort by area and show top 5
                    sorted_changes = sorted(changes, key=lambda x: x["area"], reverse=True)[:5]
                    for i, change in enumerate(sorted_changes):
                        print(f"  {i+1}. Area: {change['area']} pixels, Position: ({change['x']}, {change['y']}), Size: {change['width']}x{change['height']}")
                
                print("\n✅ Test passed")
                return True
            else:
                print("\nNo comparison results returned")
                print(f"Response: {json.dumps(data, indent=2)}")
                print("❌ Test failed")
                return False
        else:
            # Error
            print("\n❌ Test failed")
            print(f"Error: {response.status_code}")
            try:
                error_info = response.json()
                print(f"Error details: {json.dumps(error_info, indent=2)}")
            except:
                print(f"Response text: {response.text}")
            return False
    
    except requests.exceptions.RequestException as e:
        print(f"\n❌ Test failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Test all detection methods via API")
    parser.add_argument('image', help='Path to the test image')
    parser.add_argument('--compare-image', help='Second image for comparison testing')
    parser.add_argument('--method', choices=['yolo', 'opencv', 'ssim', 'all'], default='all', 
                       help='Detection method to test (default: all)')
    parser.add_argument('--api-url', default=DEFAULT_API_URL, 
                       help=f'API endpoint URL (default: {DEFAULT_API_URL})')
    parser.add_argument('--compare-api-url', default=COMPARE_API_URL,
                       help=f'Comparison API endpoint URL (default: {COMPARE_API_URL})')
    parser.add_argument('--sensitivity', type=float, default=0.5, 
                       help='OpenCV detection sensitivity (0.1-0.9)')
    parser.add_argument('--min-area', type=int, default=100, 
                       help='OpenCV minimum contour area')
    
    args = parser.parse_args()
    
    # Test the specified method(s)
    opencv_params = {
        "sensitivity": args.sensitivity,
        "minArea": args.min_area
    }
    
    results = {}
    
    if args.method in ['yolo', 'all']:
        results['yolo'] = test_detection_method(args.image, 'yolo', None, args.api_url)
    
    if args.method in ['opencv', 'all']:
        results['opencv'] = test_detection_method(args.image, 'opencv', opencv_params, args.api_url)
    
    # Test the comparison method if a second image is provided
    if args.compare_image and (args.method in ['ssim', 'all']):
        results['ssim_comparison'] = test_compare_screenshots(args.image, args.compare_image, args.compare_api_url)
    
    # Print summary
    print(f"\n{'='*60}")
    print("Test Summary:")
    for method, success in results.items():
        status = "✅ Passed" if success else "❌ Failed"
        print(f"{method.upper()}: {status}")
    print(f"{'='*60}")

if __name__ == "__main__":
    main()
