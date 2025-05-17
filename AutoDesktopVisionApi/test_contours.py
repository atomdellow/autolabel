#!/usr/bin/env python
"""
Simple test script for OpenCV contour detection
"""
import cv2
import numpy as np
import os
import sys
import json
import argparse
from PIL import Image

# Add the parent directory to Python path
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(parent_dir)

# Import our detection module
from detect_contours_fixed import detect_contours

def main():
    """Test contour detection on a sample image"""
    parser = argparse.ArgumentParser(description="Test OpenCV contour detection")
    parser.add_argument('image', nargs='?', help='Path to the image file (optional)')
    parser.add_argument('--sensitivity', type=float, default=0.5, help='Edge detection sensitivity (0.1-0.9)')
    parser.add_argument('--min-area', type=int, default=100, help='Minimum contour area')
    parser.add_argument('--max-area', type=int, help='Maximum contour area')
    args = parser.parse_args()
    
    print("Testing OpenCV contour detection...")
    
    # Use the provided image or find one in uploads
    if args.image:
        test_image_path = args.image
    else:
        # Look for images in the backend/uploads directory
        uploads_dir = os.path.join(parent_dir, "backend", "uploads")
        image_files = [f for f in os.listdir(uploads_dir) if f.endswith(('.png', '.jpg', '.jpeg'))]
        
        if not image_files:
            print("No test images found in backend/uploads")
            return
        
        # Use the first image for testing
        test_image_path = os.path.join(uploads_dir, image_files[0])
    
    print(f"Using test image: {test_image_path}")
    
    # Load image using OpenCV
    img = cv2.imread(test_image_path)
    if img is None:
        print(f"Failed to load image: {test_image_path}")
        return
    
    # Get image dimensions
    height, width = img.shape[:2]
    print(f"Image dimensions: {width}x{height}")
    
    # Run contour detection with different sensitivities
    test_sensitivities = [args.sensitivity] if args.sensitivity else [0.3, 0.5, 0.7]
    
    for sensitivity in test_sensitivities:
        print(f"\nTesting with sensitivity: {sensitivity}")
        detections = detect_contours(
            img, 
            sensitivity=sensitivity, 
            min_area=args.min_area, 
            max_area=args.max_area
        )
        
        print(f"Found {len(detections)} UI elements")
        if detections:
            print("Sample detections:")
            for i, det in enumerate(detections[:5]):  # Show first 5
                print(f"  {i+1}. {det['Label']}: conf={det['Confidence']:.2f}, pos=({det['X']}, {det['Y']}), size={det['Width']}x{det['Height']}")
            
            if len(detections) > 5:
                print(f"  ... and {len(detections) - 5} more elements")
    
    print("\nTest completed successfully")

if __name__ == "__main__":
    main()
