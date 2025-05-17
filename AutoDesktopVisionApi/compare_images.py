#!/usr/bin/env python
"""
Simple image comparison using structural similarity index (SSIM)
"""
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
import base64
import io
from PIL import Image
import json
import sys
import argparse

def decode_image(base64_string):
    """Decode a base64 string to an image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    # Decode base64 string
    img_data = base64.b64decode(base64_string)
    img = Image.open(io.BytesIO(img_data))
    
    # Convert to numpy array
    img_np = np.array(img)
    
    # Convert to BGR for OpenCV if needed
    if img_np.ndim == 2:  # Grayscale
        img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
    elif img_np.shape[2] == 4:  # RGBA
        img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
    
    return img_np, img.size

def compare_images(img1, img2):
    """Compare two images using SSIM"""
    # Get dimensions
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]
    
    # Resize if needed
    if h1 != h2 or w1 != w2:
        img2 = cv2.resize(img2, (w1, h1))
    
    # Convert to grayscale
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    # Compute SSIM
    (score, diff) = ssim(gray1, gray2, full=True)
    
    # Process difference image
    diff = (diff * 255).astype("uint8")
    thresh = cv2.threshold(diff, 127, 255, cv2.THRESH_BINARY_INV)[1]
    
    # Find contours in differences
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Process significant changes
    changes = []
    min_area = 50
    
    for contour in contours:
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
    
    return {
        "similarity_score": round(score, 4),
        "changes": changes
    }

def compare_screenshot_pair(base64_image1, base64_image2):
    """Compare two screenshots and detect changes"""
    # Decode both images
    img1, size1 = decode_image(base64_image1)
    img2, size2 = decode_image(base64_image2)
    
    if img1 is None or img2 is None:
        return {"error": "Failed to decode one or both images"}
    
    # Compare the images
    comparison = compare_images(img1, img2)
    
    # Return results with image dimensions
    if size1:
        width, height = size1
        return {
            "ComparisonResult": comparison,
            "ImageDimensions": {
                "Width": width,
                "Height": height
            }
        }
    else:
        return {"error": "Failed to get image dimensions"}

def main():
    parser = argparse.ArgumentParser(description="Compare two images using SSIM")
    
    parser.add_argument('--base64_file1', required=True, help='Path to file containing base64 image data for first image')
    parser.add_argument('--base64_file2', required=True, help='Path to file containing base64 image data for second image')
    
    args = parser.parse_args()
    
    try:
        with open(args.base64_file1, 'r') as f:
            base64_img1 = f.read()
            
        with open(args.base64_file2, 'r') as f:
            base64_img2 = f.read()
            
        result = compare_screenshot_pair(base64_img1, base64_img2)
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}, indent=2))
        sys.exit(1)

if __name__ == "__main__":
    main()
