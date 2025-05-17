# Detection Methods Comparison
# This script demonstrates how to use all three detection methods in AutoLabel

import requests
import base64
import json
import os
import sys
from PIL import Image
import io
import argparse

# API endpoints
API_URL = "http://localhost:5001/api/detection/detect"
COMPARE_URL = "http://localhost:5001/api/detection/compare"

def read_image_as_base64(image_path):
    """Read an image file and convert it to base64"""
    with open(image_path, 'rb') as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode('utf-8')
    return encoded_string

def test_yolo_detection(image_path):
    """Test YOLO detection"""
    print("\n=== YOLO Detection Test ===")
    base64_image = read_image_as_base64(image_path)
    
    payload = {
        "screenshot": base64_image,
        "detectionMethod": "yolo"
    }
    
    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            result = response.json()
            detections = result.get("Detections", [])
            print(f"Success! Detected {len(detections)} objects")
            
            # Print top 5 detections
            for i, det in enumerate(detections[:5]):
                print(f"{i+1}. {det['Label']} (Confidence: {det['Confidence']:.2f}): "
                      f"pos=({det['X']}, {det['Y']}), "
                      f"size={det['Width']}x{det['Height']}")
            
            if len(detections) > 5:
                print(f"... and {len(detections) - 5} more")
            
            return detections
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"Exception: {e}")
        return []

def test_opencv_detection(image_path, sensitivity=0.5, min_area=100):
    """Test OpenCV contour detection"""
    print("\n=== OpenCV Contour Detection Test ===")
    print(f"Parameters: sensitivity={sensitivity}, min_area={min_area}")
    
    base64_image = read_image_as_base64(image_path)
    
    payload = {
        "screenshot": base64_image,
        "detectionMethod": "opencv",
        "detectionParams": {
            "sensitivity": sensitivity,
            "minArea": min_area
        }
    }
    
    try:
        response = requests.post(API_URL, json=payload)
        if response.status_code == 200:
            result = response.json()
            detections = result.get("Detections", [])
            print(f"Success! Detected {len(detections)} objects")
            
            # Print top 5 detections
            for i, det in enumerate(detections[:5]):
                print(f"{i+1}. {det['Label']} (Confidence: {det['Confidence']:.2f}): "
                      f"pos=({det['X']}, {det['Y']}), "
                      f"size={det['Width']}x{det['Height']}")
            
            if len(detections) > 5:
                print(f"... and {len(detections) - 5} more")
            
            return detections
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"Exception: {e}")
        return []

def test_ssim_comparison(image_path1, image_path2):
    """Test SSIM comparison"""
    print("\n=== SSIM Comparison Test ===")
    
    base64_image1 = read_image_as_base64(image_path1)
    base64_image2 = read_image_as_base64(image_path2)
    
    payload = {
        "screenshot1": base64_image1,
        "screenshot2": base64_image2
    }
    
    try:
        response = requests.post(COMPARE_URL, json=payload)
        if response.status_code == 200:
            result = response.json()
            comparison = result.get("ComparisonResult", {})
            similarity = comparison.get("similarity_score", 0)
            changes = comparison.get("changes", [])
            
            print(f"Success! Similarity score: {similarity:.4f}")
            print(f"Found {len(changes)} differences")
            
            # Print top 5 changes
            for i, change in enumerate(changes[:5]):
                print(f"{i+1}. Change at ({change['x']}, {change['y']}): "
                      f"size={change['width']}x{change['height']}, "
                      f"area={change['area']}")
            
            if len(changes) > 5:
                print(f"... and {len(changes) - 5} more")
            
            return changes
        else:
            print(f"Error: {response.status_code} - {response.text}")
            return []
    except Exception as e:
        print(f"Exception: {e}")
        return []

def main():
    parser = argparse.ArgumentParser(description="Test all detection methods in AutoLabel")
    parser.add_argument('image_path', help='Path to the test image')
    parser.add_argument('--compare-with', help='Path to the second image for SSIM comparison')
    parser.add_argument('--sensitivity', type=float, default=0.5, help='OpenCV sensitivity (0.1-0.9)')
    parser.add_argument('--min-area', type=int, default=100, help='OpenCV minimum contour area')
    parser.add_argument('--all', action='store_true', help='Run all tests')
    parser.add_argument('--yolo', action='store_true', help='Run YOLO test')
    parser.add_argument('--opencv', action='store_true', help='Run OpenCV test')
    parser.add_argument('--ssim', action='store_true', help='Run SSIM test')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.image_path):
        print(f"Error: Image file not found: {args.image_path}")
        sys.exit(1)
    
    # If no specific tests are selected, run all
    run_all = args.all or not (args.yolo or args.opencv or args.ssim)
    
    if run_all or args.yolo:
        test_yolo_detection(args.image_path)
    
    if run_all or args.opencv:
        test_opencv_detection(args.image_path, args.sensitivity, args.min_area)
    
    if (run_all or args.ssim) and args.compare_with:
        if not os.path.exists(args.compare_with):
            print(f"Error: Second image file not found: {args.compare_with}")
        else:
            test_ssim_comparison(args.image_path, args.compare_with)
    elif run_all or args.ssim:
        print("\n=== SSIM Comparison Test ===")
        print("Error: Missing second image for comparison. Use --compare-with parameter.")

if __name__ == "__main__":
    main()
