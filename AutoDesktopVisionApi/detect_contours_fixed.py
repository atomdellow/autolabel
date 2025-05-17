# OpenCV Detection Script
# Fixed version for AutoLabel detection integration

import cv2
import numpy as np
import base64
import io
from PIL import Image
import json
import argparse
import sys
from skimage.metrics import structural_similarity as ssim
import logging
import requests
import tempfile
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def download_image_from_url(url):
    """Download image from URL and save to temporary file"""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Create temporary file
        fd, temp_path = tempfile.mkstemp(suffix='.png')
        os.close(fd)
        
        # Save image to temporary file
        with open(temp_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        
        return temp_path
    except Exception as e:
        logger.error(f"Error downloading image: {e}")
        return None

def decode_image(base64_string):
    """Decode a base64 string to an image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    try:
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
    except Exception as e:
        logger.error(f"Error decoding image: {e}")
        return None, None

def detect_contours(img_np, sensitivity=0.5, min_area=100, max_area=None):
    """Detect UI elements using contour detection"""
    if img_np is None:
        return []
    
    # Get image dimensions
    height, width = img_np.shape[:2]
    
    # Set default max area if not provided
    if max_area is None:
        max_area = width * height * 0.9  # 90% of image area
    
    # Convert to grayscale
    gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
    
    # Apply Gaussian blur
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Canny edge detection with sensitivity parameter
    low_threshold = int(100 * (1 - sensitivity))
    high_threshold = int(200 * sensitivity + 100)
    edges = cv2.Canny(blur, low_threshold, high_threshold)
    
    # Dilate edges
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Filter and process contours
    ui_elements = []
    for contour in contours:
        area = cv2.contourArea(contour)
        if min_area <= area <= max_area:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate confidence
            rect_area = w * h
            area_ratio = area / rect_area if rect_area > 0 else 0
            confidence = min(0.95, max(0.5, area_ratio * (area / max_area) * 2))
            
            # Classify UI element
            label = classify_ui_element(w, h, width, height, area_ratio)
            
            ui_elements.append({
                "Label": label,
                "Confidence": round(float(confidence), 2),
                "X": int(x),
                "Y": int(y),
                "Width": int(w),
                "Height": int(h)
            })
    
    return ui_elements

def classify_ui_element(width, height, img_width, img_height, area_ratio):
    """Classify a UI element based on shape and size"""
    # Calculate aspect ratio
    aspect_ratio = width / height if height > 0 else 0
    
    # Calculate relative size
    relative_width = width / img_width
    relative_height = height / img_height
    
    # Classification logic
    if relative_width > 0.8 and relative_height > 0.8:
        return "window"
    elif relative_width > 0.8 and relative_height < 0.1:
        return "menubar"
    elif relative_height > 0.8 and relative_width < 0.1:
        return "sidebar"
    elif aspect_ratio > 4:
        return "menubar"
    elif aspect_ratio < 0.25:
        return "sidebar"
    elif relative_width < 0.1 and relative_height < 0.1 and 0.8 < aspect_ratio < 1.2:
        return "icon"
    elif 2 < aspect_ratio < 4:
        return "button"
    elif aspect_ratio > 0.8 and aspect_ratio < 1.2:
        return "icon"
    else:
        return "ui_element"

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

def process_image(base64_image, detection_params=None):
    """Process an image with OpenCV detection"""
    # Default parameters
    params = {
        "sensitivity": 0.5,
        "min_area": 100,
        "max_area": None
    }
    
    # Update with provided parameters
    if detection_params:
        params.update(detection_params)
    
    try:
        # Decode image
        img, size = decode_image(base64_image)
        if img is None:
            return {"error": "Failed to decode image"}
        
        # Run contour detection
        detections = detect_contours(
            img, 
            sensitivity=params["sensitivity"],
            min_area=params["min_area"],
            max_area=params["max_area"]
        )
        
        # Return results with image dimensions
        if size:
            width, height = size
            return {
                "Detections": detections,
                "ImageDimensions": {
                    "Width": width,
                    "Height": height
                },
                "DetectionMethod": "opencv_contour"
            }
        else:
            return {"error": "Failed to get image dimensions"}
    
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return {"error": str(e)}

def compare_screenshot_pair(base64_image1, base64_image2):
    """Compare two screenshots and detect changes"""
    try:
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
    
    except Exception as e:
        logger.error(f"Error comparing images: {e}")
        return {"error": str(e)}

def main():
    """Main function for command-line use"""
    parser = argparse.ArgumentParser(description="OpenCV UI element detection")
    
    # Add arguments
    parser.add_argument('--image', help='Path to image file')
    parser.add_argument('--base64', help='Path to file containing base64 image data')
    parser.add_argument('--sensitivity', type=float, default=0.5, help='Edge detection sensitivity (0.1-0.9)')
    parser.add_argument('--min_area', type=int, default=100, help='Minimum contour area')
    parser.add_argument('--max_area', type=int, help='Maximum contour area')
    
    # Compare mode arguments
    parser.add_argument('--compare', action='store_true', help='Run in compare mode')
    parser.add_argument('--base64_file1', help='Path to file containing base64 image data for first image')
    parser.add_argument('--base64_file2', help='Path to file containing base64 image data for second image')
    
    args = parser.parse_args()
      # Process based on mode
    if args.compare and args.base64_file1 and args.base64_file2:
        with open(args.base64_file1, 'r') as f:
            base64_img1 = f.read()
        with open(args.base64_file2, 'r') as f:
            base64_img2 = f.read()
        
        result = compare_screenshot_pair(base64_img1, base64_img2)
        print(json.dumps(result, indent=2))
        
    elif args.image:
        # Check if it's a URL
        if args.image.startswith('http'):
            temp_path = download_image_from_url(args.image)
            if temp_path:
                img = cv2.imread(temp_path)
                # Clean up temp file after reading
                os.unlink(temp_path)
            else:
                print(json.dumps({"error": f"Could not download image from URL {args.image}"}, indent=2))
                sys.exit(1)
        else:
            img = cv2.imread(args.image)
            
        if img is None:
            print(json.dumps({"error": f"Could not read image file {args.image}"}, indent=2))
            sys.exit(1)
            
        detections = detect_contours(
            img, 
            sensitivity=args.sensitivity,
            min_area=args.min_area,
            max_area=args.max_area
        )
        
        print(json.dumps({
            "Detections": detections,
            "ImageDimensions": {
                "Width": img.shape[1],
                "Height": img.shape[0]
            },
            "DetectionMethod": "opencv_contour"
        }, indent=2))
        
    elif args.base64:
        with open(args.base64, 'r') as f:
            base64_data = f.read()
            
        result = process_image(
            base64_data, 
            {
                "sensitivity": args.sensitivity,
                "min_area": args.min_area,
                "max_area": args.max_area
            }
        )
        
        print(json.dumps(result, indent=2))
        
    else:
        print(json.dumps({"error": "Missing required arguments"}, indent=2))
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
