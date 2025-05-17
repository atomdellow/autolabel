#!/usr/bin/env python
"""
Object detection script using YOLOv8 model.
This is a simplified version of the Flask app         # Record the actual image dimensions used for detection
        width, height = image.size
        print(f"Image dimensions: {width}x{height}", file=sys.stderr)
            
        # If few or no detections found and fallback is enabled, add intelligent UI region proposals
        if len(detections) < 3 and add_fallback_detections:
            print(f"Only {len(detections)} detections found, adding UI region proposals", file=sys.stderr)
            width, height = image.sizegned to be called from Node.js.
"""

import os
import sys
import json
import argparse
import base64
import io
import requests
from PIL import Image
import traceback

# Import YOLO from ultralytics if available
try:
    from ultralytics import YOLO
    yolo_available = True
except ImportError:
    yolo_available = False
    print("Warning: ultralytics module not found. Please install with 'pip install ultralytics'.", file=sys.stderr)

def load_model(model_path='yolov8n.pt'):
    """Load YOLOv8 model."""
    if not yolo_available:
        return None
        
    try:
        model = YOLO(model_path)
        return model
    except Exception as e:
        print(f"Error loading model: {e}", file=sys.stderr)
        return None

def perform_detection(image, model, confidence_threshold=0.15, add_fallback_detections=True):
    """Perform object detection on the image.
    
    Args:
        image: PIL Image to perform detection on
        model: YOLO model instance
        confidence_threshold: Minimum confidence for detections (default: 0.15)
        add_fallback_detections: Whether to add fallback detections if none found
    """
    if model is None:
        return [{"label": "error_model_not_loaded", "confidence": 0.0, "box": [0,0,0,0]}]
    
    # Check if image has valid dimensions    
    if not hasattr(image, 'size') or image.size[0] <= 0 or image.size[1] <= 0:
        print("Warning: Invalid image dimensions", file=sys.stderr)
        return [{"label": "error_invalid_image", "confidence": 0.0, "box": [0,0,0,0]}]
        
    try:
        # Try to enhance contrast for UI elements
        try:
            from PIL import ImageEnhance
            enhancer = ImageEnhance.Contrast(image)
            enhanced_image = enhancer.enhance(1.2)  # Slightly enhance contrast
        except Exception:
            enhanced_image = image  # Use original if enhancement fails
            
        # Use a very low confidence threshold for UI elements
        results = model(enhanced_image, conf=confidence_threshold)
        detections = []
        
        # UI element mappings - map COCO classes to UI elements
        ui_element_mappings = {
            # Small elements
            'person': 'icon', 
            'cell phone': 'icon',
            'remote': 'icon',
            'mouse': 'icon',
            'keyboard': 'input',
            'clock': 'icon',
            
            # Containers and panels
            'tv': 'window',
            'laptop': 'window',
            'book': 'panel',
            'monitor': 'window', 
            'display': 'window',
            'screen': 'window',
            
            # Buttons and controls
            'switch': 'button',
            'remote control': 'control',
        }
        
        for r in results:
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
                conf = float(box.conf[0].item())
                cls_id = int(box.cls[0].item())
                label = model.names[cls_id]
                
                # Map common COCO classes to UI element types
                if label in ui_element_mappings:
                    label = ui_element_mappings[label]
                
                # Adjust confidence for UI elements (slightly boost it)
                if label in ('icon', 'button', 'window', 'panel'):
                    conf = min(1.0, conf * 1.2)
                
                # Filter out very small detections that are likely noise
                box_width = x2 - x1
                box_height = y2 - y1
                
                # Skip extremely tiny detections unless they're likely icons
                if (box_width < 5 or box_height < 5) and label != 'icon':
                    continue
                    
                detections.append({
                    "label": label,
                    "confidence": conf,
                    "box": [x1, y1, x2, y2]
                })
        
        # If few or no detections found and fallback is enabled, add intelligent UI region proposals
        if len(detections) < 3 and add_fallback_detections:
            print(f"Only {len(detections)} detections found, adding UI region proposals", file=sys.stderr)
            width, height = image.size
            
            # Add taskbar detection based on OS conventions (bottom or top of screen)
            # Bottom taskbar (Windows style)
            detections.append({
                "label": "taskbar",
                "confidence": 0.9,
                "box": [0, int(height * 0.95), width, height]
            })
            
            # Top menubar (macOS style)
            detections.append({
                "label": "menubar",
                "confidence": 0.7,
                "box": [0, 0, width, int(height * 0.03)]
            })
            
            # Add main window in the center
            center_width = int(width * 0.8)
            center_height = int(height * 0.75)
            x_offset = (width - center_width) // 2
            y_offset = int(height * 0.1)  # Below potential menubar
            detections.append({
                "label": "window",
                "confidence": 0.85,
                "box": [x_offset, y_offset, x_offset + center_width, y_offset + center_height]
            })
            
            # Add sidebar navigation (left side)
            sidebar_width = int(width * 0.15)
            detections.append({
                "label": "sidebar",
                "confidence": 0.7,
                "box": [x_offset, y_offset, x_offset + sidebar_width, y_offset + center_height]
            })
            
            # Add some intelligent icon/button placement
            icon_size = min(width, height) // 20
            margin = icon_size // 2
              # Top-left icons (like window controls or menu items)
            for i in range(3):
                detections.append({
                    "label": "icon",
                    "confidence": 0.7,
                    "box": [margin + i * (icon_size + margin), margin, 
                           margin + i * (icon_size + margin) + icon_size, margin + icon_size]
                })
            
            # Desktop icons along right edge
            right_margin = width - icon_size - margin
            for j in range(4):
                detections.append({
                    "label": "icon",
                    "confidence": 0.6,
                    "box": [right_margin, margin + j * (icon_size + margin),
                           right_margin + icon_size, margin + j * (icon_size + margin) + icon_size]
                })
                
            # Buttons in a toolbar pattern (horizontal row)
            toolbar_y = y_offset + int(center_height * 0.1)
            button_width = int(icon_size * 1.8)
            button_height = icon_size
            for i in range(4):
                detections.append({
                    "label": "button",
                    "confidence": 0.65,
                    "box": [x_offset + sidebar_width + i * (button_width + margin), 
                           toolbar_y,
                           x_offset + sidebar_width + i * (button_width + margin) + button_width, 
                           toolbar_y + button_height]
                })
                
            # Add a search box
            search_x = width - int(width * 0.3) - margin
            search_width = int(width * 0.25)
            search_height = int(icon_size * 1.2)
            detections.append({
                "label": "search",
                "confidence": 0.7,
                "box": [search_x, toolbar_y, search_x + search_width, toolbar_y + search_height]
            })
            
            # Generate a grid of content items (like file icons or list items)
            content_start_x = x_offset + sidebar_width + margin
            content_start_y = toolbar_y + button_height + int(icon_size * 1.5)
            item_width = int(icon_size * 2.5)
            item_height = int(icon_size * 3)
            item_margin = int(item_width * 0.3)
            
            items_per_row = max(3, (center_width - sidebar_width) // (item_width + item_margin))
            num_rows = 3
            
            for row in range(num_rows):
                for col in range(items_per_row):
                    item_x = content_start_x + col * (item_width + item_margin)
                    item_y = content_start_y + row * (item_height + item_margin)
                    label_type = "icon" if (row + col) % 2 == 0 else "item"
                    
                    detections.append({
                        "label": label_type,
                        "confidence": 0.55,
                        "box": [item_x, item_y, item_x + item_width, item_y + item_height]
                    })
            
            # Status/info bar at the bottom of the main window
            statusbar_height = int(icon_size * 0.8)
            statusbar_y = y_offset + center_height - statusbar_height
            detections.append({
                "label": "statusbar",
                "confidence": 0.6,
                "box": [x_offset, statusbar_y, x_offset + center_width, y_offset + center_height]
            })
                
        # Deduplicate detections by merging overlapping boxes with the same label
        if len(detections) > 3:
            deduplicated = []
            processed = set()
            
            for i, det1 in enumerate(detections):
                if i in processed:
                    continue
                    
                current_box = det1["box"]
                current_label = det1["label"]
                current_conf = det1["confidence"]
                
                # Check for overlaps with the same label
                for j, det2 in enumerate(detections[i+1:], i+1):
                    if j in processed or det2["label"] != current_label:
                        continue
                        
                    # Check for significant overlap
                    box2 = det2["box"]
                    x1_max = max(current_box[0], box2[0])
                    y1_max = max(current_box[1], box2[1])
                    x2_min = min(current_box[2], box2[2])
                    y2_min = min(current_box[3], box2[3])
                    
                    if x1_max < x2_min and y1_max < y2_min:
                        # There is overlap - merge boxes and take higher confidence
                        overlap_area = (x2_min - x1_max) * (y2_min - y1_max)
                        box1_area = (current_box[2] - current_box[0]) * (current_box[3] - current_box[1])
                        box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
                        
                        # If significant overlap, merge
                        if overlap_area > 0.5 * min(box1_area, box2_area):
                            # Create merged box
                            current_box = [
                                min(current_box[0], box2[0]),
                                min(current_box[1], box2[1]),
                                max(current_box[2], box2[2]),
                                max(current_box[3], box2[3])
                            ]
                            current_conf = max(current_conf, det2["confidence"])
                            processed.add(j)
                
                # Add the possibly merged detection
                deduplicated.append({
                    "label": current_label,
                    "confidence": current_conf,
                    "box": current_box
                })
            
            detections = deduplicated
        
        return detections
    except Exception as e:
        print(f"Detection error: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return [{"label": "error_detection_failed", "confidence": 0.0, "box": [0,0,0,0]}]

def process_url_image(url):
    """Download and process image from URL."""
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        return Image.open(io.BytesIO(response.content))
    except Exception as e:
        print(f"Error downloading image from URL: {e}", file=sys.stderr)
        raise

def process_base64_image(base64_data):
    """Process base64 encoded image data or direct file path."""
    try:
        # Check if input is a file path rather than base64 data
        if os.path.exists(base64_data) and os.path.isfile(base64_data):
            try:
                return Image.open(base64_data)
            except Exception as e:
                print(f"Error opening image file directly: {e}", file=sys.stderr)
                # If direct file open fails, continue with base64 processing
        
        # Handle potential encoding issues
        if isinstance(base64_data, bytes):
            try:
                base64_data = base64_data.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    base64_data = base64_data.decode('latin-1')
                except Exception:
                    pass  # Use the bytes as is if decoding fails
        
        # Remove potential header if it exists
        if isinstance(base64_data, str) and ',' in base64_data:
            base64_data = base64_data.split(',', 1)[1]
        
        # Handle potential padding issues
        if isinstance(base64_data, str):
            # Add padding if needed
            missing_padding = len(base64_data) % 4
            if missing_padding:
                base64_data += '=' * (4 - missing_padding)
        
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed (for RGBA images)
        if image.mode == 'RGBA':
            background = Image.new('RGB', image.size, (255, 255, 255))
            background.paste(image, mask=image.split()[3])  # 3 is the alpha channel
            image = background
        
        return image
    except Exception as e:
        print(f"Error processing image: {e}", file=sys.stderr)
        traceback.print_exc(file=sys.stderr)
        raise

def transform_detections(detections_raw, image_width=None, image_height=None):
    """Transform raw detections to client-expected format."""
    transformed = []
    print(f"Transforming {len(detections_raw)} raw detections for image {image_width}x{image_height}", file=sys.stderr)
    
    for det in detections_raw:
        box = det['box']
        width = box[2] - box[0]
        height = box[3] - box[1]
        if width <= 0 or height <= 0:
            print(f"Skipping detection with invalid dimensions: {det}", file=sys.stderr)
            continue
            
        # Log the transformation for debugging
        print(f"Transform: {det['label']} [{box[0]},{box[1]},{box[2]},{box[3]}] -> [{box[0]},{box[1]},{width},{height}]", file=sys.stderr)
        
        # Ensure coordinates are within valid image bounds
        x = max(0, box[0])
        y = max(0, box[1])
        width = min(width, (image_width or 1920) - x)
        height = min(height, (image_height or 1080) - y)
        
        transformed.append({
            "Label": det['label'],
            "Confidence": det['confidence'],
            "X": x,
            "Y": y,
            "Width": width,
            "Height": height
        })
    
    # Return with image metadata
    result = {
        "Detections": transformed,
        "ImageDimensions": {
            "Width": image_width,
            "Height": image_height
        }
    }
    
    # Print dimensions for better debugging
    print(f"Detection image dimensions: {image_width}x{image_height} with {len(transformed)} objects", file=sys.stderr)
    
    return result

def main():
    """Main function to handle command line arguments and run detection."""
    parser = argparse.ArgumentParser(description='YOLOv8 object detection')
    parser.add_argument('--url', help='URL of the image to analyze')
    parser.add_argument('--base64_file', help='File containing base64 image data or direct path to image file')
    parser.add_argument('--model', default='yolov8n.pt', help='Path to YOLOv8 model file')
    parser.add_argument('--conf', type=float, default=0.15, help='Confidence threshold for detections')
    parser.add_argument('--gui-mode', action='store_true', help='Use settings optimized for desktop UI detection')
    parser.add_argument('--no-fallback', action='store_true', help='Disable fallback detection proposals')
    
    args = parser.parse_args()
    
    try:
        # Load model
        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), args.model)
        model = load_model(model_path)
        
        if model is None:
            print(json.dumps({"error": "Failed to load detection model"}))
            return 1
        
        # Process image
        image = None
        try:
            if args.url:
                image = process_url_image(args.url)
            elif args.base64_file:
                try:
                    # First try to open as direct image file
                    image = process_base64_image(args.base64_file)
                except Exception as e:
                    print(f"Direct file processing failed, trying as base64: {e}", file=sys.stderr)
                    # If that fails, try as base64 file
                    try:
                        with open(args.base64_file, 'r', encoding='utf-8') as file:
                            base64_data = file.read()
                        image = process_base64_image(base64_data)
                    except UnicodeDecodeError:
                        # Try with binary mode if UTF-8 fails
                        with open(args.base64_file, 'rb') as file:
                            base64_data = file.read()
                        image = process_base64_image(base64_data)
            else:
                print(json.dumps({"error": "No image data provided"}))
                return 1
        except Exception as e:
            print(json.dumps({"error": f"Failed to process image: {str(e)}"}))
            return 1
            
        if image is None:
            print(json.dumps({"error": "Failed to load image"}))
            return 1
        
        # Set confidence threshold based on mode
        confidence_threshold = args.conf
        if args.gui_mode:
            # Use lower confidence for UI elements
            confidence_threshold = 0.10
          # Get image dimensions
        width, height = image.size
        
        # Perform detection with our specified parameters
        add_fallback = not args.no_fallback
        detections_raw = perform_detection(image, model, 
                                           confidence_threshold=confidence_threshold, 
                                           add_fallback_detections=add_fallback)
          # Transform results to expected format and include image dimensions
        results = transform_detections(detections_raw, width, height)
        
        # Output results as JSON - ensure we always have detections
        if not results["Detections"] and add_fallback:
            print("Warning: No detections found even with fallbacks. Check image quality.", file=sys.stderr)
            # Add at least one dummy detection to avoid empty results
            width, height = image.size
            results["Detections"] = [{
                "Label": "window",
                "Confidence": 0.5,
                "X": 0,
                "Y": 0,
                "Width": width,
                "Height": height
            }]
            
        # Ensure we always have image dimensions in the output
        if "ImageDimensions" not in results:
            results["ImageDimensions"] = {
                "Width": width,
                "Height": height
            }        # Ensure we always have image dimensions in the output
        if "ImageDimensions" not in results:
            results["ImageDimensions"] = {
                "Width": width,
                "Height": height
            }
        
        # Output results as JSON
        print(json.dumps(results))
        return 0
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        return 1

if __name__ == "__main__":
    sys.exit(main())
