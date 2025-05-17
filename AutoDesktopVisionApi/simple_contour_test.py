#!/usr/bin/env python
"""
Simple test for OpenCV contour detection directly on an image file
"""
import cv2
import os
import sys
import numpy as np
import argparse

def detect_contours(image_path, sensitivity=0.5, min_area=100, max_area=None, show_results=False):
    """Detect UI elements using contour detection"""
    # Load image
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not read image file {image_path}")
        return []
    
    height, width = img.shape[:2]
    print(f"Image dimensions: {width}x{height}")
    
    # Set max area if not provided
    if max_area is None:
        max_area = width * height * 0.9  # Default to 90% of image area
    
    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply Gaussian blur to reduce noise
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    
    # Use Canny edge detection with sensitivity parameter
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
    result_img = img.copy() if show_results else None
    
    for contour in contours:
        area = cv2.contourArea(contour)
        if min_area <= area <= max_area:
            # Get bounding box
            x, y, w, h = cv2.boundingRect(contour)
            
            # Create a simple confidence score
            confidence = min(0.95, (area / max_area) * 2)
            
            # Classify element (simplified here)
            label = "ui_element"
            if w/h > 4 or h/w > 4:
                label = "sidebar" if h > w else "menubar"
            elif w/h > 0.8 and w/h < 1.2 and w < width * 0.1:
                label = "icon"
            elif w > width * 0.8 and h > height * 0.8:
                label = "window"
            
            ui_elements.append({
                "label": label,
                "confidence": round(confidence, 2),
                "x": x,
                "y": y,
                "width": w,
                "height": h
            })
            
            # Draw rectangle on result image if showing results
            if show_results:
                color = (0, 255, 0)  # Green
                cv2.rectangle(result_img, (x, y), (x + w, y + h), color, 2)
                cv2.putText(result_img, f"{label} ({confidence:.2f})", 
                            (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    
    # Show results if requested
    if show_results:
        # Also show the edge detection and dilated results
        cv2.imshow("Original", img)
        cv2.imshow("Edges", edges)
        cv2.imshow("Dilated", dilated)
        cv2.imshow("Detected UI Elements", result_img)
        cv2.waitKey(0)
        cv2.destroyAllWindows()
    
    return ui_elements

def main():
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Test OpenCV contour detection on an image")
    parser.add_argument('image_path', help='Path to the image file')
    parser.add_argument('--sensitivity', type=float, default=0.5, 
                        help='Edge detection sensitivity (0.1-0.9)')
    parser.add_argument('--min-area', type=int, default=100, 
                        help='Minimum contour area to consider')
    parser.add_argument('--max-area', type=int, 
                        help='Maximum contour area to consider')
    parser.add_argument('--show', action='store_true', 
                        help='Show visual results (requires GUI)')
    args = parser.parse_args()
    
    # Check if file exists
    if not os.path.exists(args.image_path):
        print(f"Error: Image file not found: {args.image_path}")
        sys.exit(1)
    
    # Run detection
    print(f"Testing contour detection with sensitivity={args.sensitivity}")
    ui_elements = detect_contours(
        args.image_path, 
        sensitivity=args.sensitivity,
        min_area=args.min_area,
        max_area=args.max_area,
        show_results=args.show
    )
    
    # Print results
    print(f"Found {len(ui_elements)} UI elements")
    for i, element in enumerate(ui_elements[:10]):  # Show first 10
        print(f"{i+1}. {element['label']} ({element['confidence']:.2f}): "
              f"pos=({element['x']}, {element['y']}), "
              f"size={element['width']}x{element['height']}")
    
    if len(ui_elements) > 10:
        print(f"... and {len(ui_elements) - 10} more elements")

if __name__ == "__main__":
    main()
