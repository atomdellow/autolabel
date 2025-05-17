import cv2
import numpy as np
import base64
import io
from PIL import Image
from skimage.metrics import structural_similarity as ssim
import json
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
    """Decode a base64 string to a numpy array image"""
    if ',' in base64_string:
        base64_string = base64_string.split(',')[1]
    
    try:
        # Decode base64 string to image
        img_data = base64.b64decode(base64_string)
        img = Image.open(io.BytesIO(img_data))
        
        # Convert to numpy array for OpenCV
        img_np = np.array(img)
        if img_np.ndim == 2:  # Grayscale
            img_np = cv2.cvtColor(img_np, cv2.COLOR_GRAY2BGR)
        elif img_np.shape[2] == 4:  # RGBA
            img_np = cv2.cvtColor(img_np, cv2.COLOR_RGBA2BGR)
        
        return img_np, img.size
    except Exception as e:
        logger.error(f"Error decoding image: {e}")
        return None, None

def detect_contours(image_np, sensitivity=0.5, min_area=100, max_area=None):
    """
    Detect UI elements using contour detection
    
    Args:
        image_np: Numpy array of the image
        sensitivity: Lower values detect fewer edges, higher values detect more (0.0-1.0)
        min_area: Minimum contour area to consider
        max_area: Maximum contour area to consider
    
    Returns:
        List of detected UI elements with bounding boxes
    """
    if image_np is None:
        return []
    
    height, width = image_np.shape[:2]
    if max_area is None:
        max_area = width * height * 0.9  # Default to 90% of image area
    
    # Convert to grayscale
    gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
    
    # Apply Gaussian blur to reduce noise
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Use Canny edge detection
    # Map sensitivity 0-1 to Canny thresholds
    low_threshold = int(100 * (1 - sensitivity))
    high_threshold = int(200 * sensitivity + 100)
    edges = cv2.Canny(blur, low_threshold, high_threshold)
    
    # Dilate to connect edges
    kernel = np.ones((3, 3), np.uint8)
    dilated = cv2.dilate(edges, kernel, iterations=2)
    
    # Find contours
    contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Process and filter contours
    ui_elements = []
    for i, contour in enumerate(contours):
        area = cv2.contourArea(contour)
        if min_area <= area <= max_area:
            # Get bounding box
            x, y, w, h = cv2.boundingRect(contour)
            
            # Calculate confidence based on area and shape regularity
            # More rectangular and larger elements get higher confidence
            rect_area = w * h
            area_ratio = area / rect_area if rect_area > 0 else 0
            confidence = min(0.95, max(0.5, area_ratio * (area / max_area) * 2))
            
            # Try to classify the element based on shape and size
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

def classify_ui_element(width, height, img_width, img_height, rectangularity):
    """Classify UI element based on shape, size, and position"""
    # Calculate aspect ratio
    aspect_ratio = width / height if height > 0 else 0
    
    # Calculate relative size
    rel_width = width / img_width
    rel_height = height / img_height
    
    # Very wide elements at bottom likely taskbar
    if rel_width > 0.8 and rel_height < 0.1:
        return "taskbar"
    
    # Very wide elements at top likely title bar
    if rel_width > 0.7 and rel_height < 0.05:
        return "titlebar"
    
    # Large rectangular elements likely windows
    if rel_width > 0.3 and rel_height > 0.3 and rectangularity > 0.8:
        return "window"
    
    # Small square-ish elements likely icons
    if max(rel_width, rel_height) < 0.1 and 0.7 < aspect_ratio < 1.3:
        return "icon"
    
    # Small rectangular elements likely buttons
    if max(rel_width, rel_height) < 0.15 and 1.5 < aspect_ratio < 5:
        return "button"
    
    # Default
    return "ui_element"

def compare_images(img1, img2):
    """
    Compare two images using structural similarity index (SSIM)
    and detect changes between them
    
    Args:
        img1: First image as numpy array
        img2: Second image as numpy array
    
    Returns:
        Dictionary with similarity score and regions of change
    """
    # Ensure images are the same size
    h1, w1 = img1.shape[:2]
    h2, w2 = img2.shape[:2]
    
    if h1 != h2 or w1 != w2:
        # Resize the second image to match the first
        img2 = cv2.resize(img2, (w1, h1))
    
    # Convert images to grayscale
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    # Compute SSIM between the two images
    (score, diff) = ssim(gray1, gray2, full=True)
    
    # The diff image contains the actual image differences
    # Convert the difference image to uint8 for further processing
    diff = (diff * 255).astype("uint8")
    
    # Threshold the difference image to find regions of change
    thresh = cv2.threshold(diff, 127, 255, cv2.THRESH_BINARY_INV)[1]
    
    # Find contours in the thresholded difference image
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # Process contours to find significant changes
    changes = []
    min_area = 50  # Minimum area to consider as significant change
    
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
    """
    Process an image using OpenCV contour detection
    
    Args:
        base64_image: Base64-encoded image string
        detection_params: Dictionary of detection parameters
        
    Returns:
        Dictionary with detection results
    """
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
        # Decode the image
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
    """
    Compare two screenshots and detect changes
    
    Args:
        base64_image1: Base64-encoded string of first screenshot
        base64_image2: Base64-encoded string of second screenshot
        
    Returns:
        Dictionary with comparison results
    """
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

if __name__ == "__main__":
    # This section is for testing the module directly
    import sys
    import argparse
    
    # Create argument parser
    parser = argparse.ArgumentParser(description="OpenCV-based UI element detection")
    
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
    
    # Parse arguments
    args = parser.parse_args()
    
    # Process based on mode
    if args.compare and args.base64_file1 and args.base64_file2:
        # Compare mode
        with open(args.base64_file1, 'r') as f:
            base64_img1 = f.read()
        with open(args.base64_file2, 'r') as f:
            base64_img2 = f.read()
        
        result = compare_screenshot_pair(base64_img1, base64_img2)
        print(json.dumps(result, indent=2))
        
    elif args.image:
        # Direct image mode
        import cv2
        
        # Check if it's a URL
        if args.image.startswith('http'):
            temp_path = download_image_from_url(args.image)
            if temp_path:
                img = cv2.imread(temp_path)
                # Clean up temp file after reading
                os.unlink(temp_path)
            else:
                print(f"Error: Could not download image from URL {args.image}")
                sys.exit(1)
        else:
            img = cv2.imread(args.image)
            
        if img is None:
            print(f"Error: Could not read image file {args.image}")
            sys.exit(1)
            
        detections = detect_contours(
            img, 
            sensitivity=args.sensitivity,
            min_area=args.min_area,
            max_area=args.max_area
        )
        
        print(json.dumps(detections, indent=2))
        
    elif args.base64:
        # Base64 image mode
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
        parser.print_help()
        sys.exit(1)
