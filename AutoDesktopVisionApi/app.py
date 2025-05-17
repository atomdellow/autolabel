from flask import Flask, request, jsonify
import base64
import io
import requests
from urllib.parse import urlparse
import os
from PIL import Image # For image decoding and manipulation
from ultralytics import YOLO # For YOLOv8 model inference
from flask_cors import CORS # For handling cross-origin requests

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# --- Load your YOLOv8 model here ---
# IMPORTANT: Replace 'best.pt' with the actual name of your .pt model file if different.
# Ensure this model file is in the same directory as app.py or provide the full path.
MODEL_NAME = 'yolov8n.pt' # Or 'yolov8s.pt', etc.
try:
    model = YOLO(MODEL_NAME)
    print(f"Successfully loaded YOLOv8 model: {MODEL_NAME}")
except Exception as e:
    print(f"Error loading YOLOv8 model ({MODEL_NAME}): {e}")
    print("Please ensure the model file is correctly placed and ultralytics is installed.")
    model = None # Set model to None if loading fails
# ------------------------------------------

def perform_actual_detection(image_pil):
    """
    Performs actual object detection using the loaded YOLOv8 model.
    
    Args:
        image_pil (PIL.Image.Image): The input image.

    Returns:
        list: A list of detection dictionaries, e.g.,
              [{'label': 'button', 'confidence': 0.9, 'box': [x1, y1, x2, y2]}, ...]
    """
    print(f"perform_actual_detection: Received image of size {image_pil.size}")
    
    if model is None:
        print("YOLOv8 model is not loaded. Returning fallback mock detections.")
        return [
            {"label": "error_model_not_loaded", "confidence": 0.0, "box": [0,0,0,0]}
        ]

    try:
        results = model(image_pil) # Perform inference
        detections = []
        for r in results: # Iterates through results for (potentially) multiple images, though we send one
            boxes = r.boxes
            for box in boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0].tolist()) # Bounding box coordinates [xmin, ymin, xmax, ymax]
                conf = float(box.conf[0].item())           # Confidence score
                cls_id = int(box.cls[0].item())        # Class ID
                label = model.names[cls_id]            # Class label from model
                
                detections.append({
                    "label": label,
                    "confidence": conf,
                    "box": [x1, y1, x2, y2] 
                })
        print(f"Actual detections from YOLOv8: {detections}")
        return detections
    except Exception as e:
        print(f"Error during YOLOv8 inference: {e}")
        return [
            {"label": "error_inference_failed", "confidence": 0.0, "box": [0,0,0,0], "error_message": str(e)}
        ]

import requests
from urllib.parse import urlparse
import os

@app.route('/detect', methods=['POST'])
def detect_objects():
    try:
        if 'image_url' in request.json:
            # Handle image URL
            image_url = request.json['image_url']
            print(f"Received image URL: {image_url}")
            
            # Check if URL is relative (from our server)
            if not image_url.startswith(('http://', 'https://')):
                # This is a relative URL, make it absolute
                base_url = request.host_url.rstrip('/')
                if not image_url.startswith('/'):
                    image_url = '/' + image_url
                image_url = base_url + image_url
                print(f"Converted to absolute URL: {image_url}")
            
            # Download the image
            response = requests.get(image_url, stream=True)
            response.raise_for_status() # Raise an error for bad responses
            
            # Read the image as bytes
            image_bytes = response.content
            image_pil = Image.open(io.BytesIO(image_bytes))
            print(f"Successfully downloaded image from URL. Size: {image_pil.size}, Mode: {image_pil.mode}")
            
        elif 'screenshot' in request.json:
            # Handle base64 image data
            image_data_b64 = request.json['screenshot']
            
            # Decode the base64 image
            print(f"Received image data (first 30 chars): {image_data_b64[:30]}...")
            image_bytes = base64.b64decode(image_data_b64)
            image_pil = Image.open(io.BytesIO(image_bytes))
            print(f"Successfully decoded image. Size: {image_pil.size}, Mode: {image_pil.mode}")
        else:
            return jsonify({"error": "No image data (URL or base64) provided"}), 400

        # Perform detection using the placeholder function
        detected_objects_raw = perform_actual_detection(image_pil)

        # Transform detections to the format expected by the C# client
        transformed_detections = []
        for det in detected_objects_raw:
            box = det['box'] 
            width = box[2] - box[0]
            height = box[3] - box[1]
            if width <= 0 or height <= 0: # Basic validation for box dimensions
                print(f"Skipping invalid box: {det}")
                continue
            transformed_detections.append({
                "Label": det['label'],
                "Confidence": det['confidence'],
                "X": box[0],
                "Y": box[1],
                "Width": width,
                "Height": height
            })
        
        print(f"Returning {len(transformed_detections)} transformed detections: {transformed_detections}")
        return jsonify({"Detections": transformed_detections, "Error": None}), 200

    except base64.binascii.Error as b64_error:
        print(f"Base64 decoding error: {b64_error}")
        return jsonify({"error": f"Invalid base64 string: {b64_error}"}), 400
    except IOError as img_error:
        print(f"Image processing error: {img_error}")
        return jsonify({"error": f"Cannot process image data: {img_error}"}), 400
    except Exception as e:
        print(f"Error processing request: {type(e).__name__} - {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    print("\n========================================")
    print("🚀 Starting AutoLabel Detection Server")
    print("📡 Script API: This is a helper script used by the Node.js backend")
    print("🔍 Use the main server's /api/detection/detect endpoint instead")
    print("========================================\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
