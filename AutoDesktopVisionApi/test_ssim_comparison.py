#!/usr/bin/env python
"""
Simple test script for SSIM image comparison
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

# Import our comparison module
from compare_images import compare_screenshot_pair

def main():
    """Test SSIM comparison on sample images"""
    parser = argparse.ArgumentParser(description="Test SSIM comparison between two images")
    parser.add_argument('image1', help='Path to the first image')
    parser.add_argument('image2', help='Path to the second image')
    args = parser.parse_args()
    
    print("Testing SSIM Image Comparison...")
    
    # Load images as base64
    try:
        with open(args.image1, 'rb') as f:
            img1_data = f.read()
            img1_base64 = img1_data.encode('base64').decode('utf-8') if hasattr(img1_data, 'encode') else "image1"
            
        with open(args.image2, 'rb') as f:
            img2_data = f.read()
            img2_base64 = img2_data.encode('base64').decode('utf-8') if hasattr(img2_data, 'encode') else "image2"
            
        # Alternative approach for direct image comparison without base64
        img1 = cv2.imread(args.image1)
        img2 = cv2.imread(args.image2)
        
        if img1 is None or img2 is None:
            print(f"Error: Failed to load one or both images")
            return
        
        # Get image dimensions
        h1, w1 = img1.shape[:2]
        h2, w2 = img2.shape[:2]
        print(f"Image 1 dimensions: {w1}x{h1}")
        print(f"Image 2 dimensions: {w2}x{h2}")
        
        # Convert to grayscale for SSIM
        gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
        gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
        
        # Resize if needed
        if h1 != h2 or w1 != w2:
            print("Images have different dimensions, resizing second image")
            gray2 = cv2.resize(gray2, (gray1.shape[1], gray1.shape[0]))
        
        # Import SSIM
        from skimage.metrics import structural_similarity as ssim
        
        # Compute SSIM
        (score, diff) = ssim(gray1, gray2, full=True)
        print(f"Similarity score: {score:.4f} (1.0 = identical, 0.0 = completely different)")
        
        # Process difference image
        diff = (diff * 255).astype("uint8")
        thresh = cv2.threshold(diff, 127, 255, cv2.THRESH_BINARY_INV)[1]
        
        # Find contours in differences
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        # Process significant changes
        changes = []
        min_area = 50
        
        print(f"Found {len(contours)} differences/changes between images")
        print(f"Significant changes (area > {min_area} pixels):")
        
        for i, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if area > min_area:
                x, y, w, h = cv2.boundingRect(contour)
                changes.append({
                    "x": int(x),
                    "y": int(y),
                    "width": int(w),
                    "height": int(h),
                    "area": int(area)
                })
                print(f"  {i+1}. Area: {area:.0f} pixels, Position: ({x}, {y}), Size: {w}x{h}")
        
        # Save a difference visualization image
        diff_file = "difference_visualization.png"
        
        # Create a color visualization
        vis_img = img1.copy()
        
        # Draw rectangles around changes
        for change in changes:
            x, y, w, h = change['x'], change['y'], change['width'], change['height']
            cv2.rectangle(vis_img, (x, y), (x + w, y + h), (0, 0, 255), 2)
        
        cv2.imwrite(diff_file, vis_img)
        print(f"Saved difference visualization to {diff_file}")
        
    except Exception as e:
        print(f"Error: {e}")
        
    print("\nTest completed")

if __name__ == "__main__":
    main()
