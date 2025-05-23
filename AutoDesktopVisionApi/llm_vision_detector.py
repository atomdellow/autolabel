#!/usr/bin/env python
"""
Object detection using LLM Vision API (OpenAI GPT-4 Vision)
This script processes images and returns detected UI elements using the OpenAI Vision API.
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
import openai
from dotenv import load_dotenv

# Load environment variables for API key
load_dotenv()

# Check if OpenAI API key is available in environment
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    print("Warning: OPENAI_API_KEY not found in environment variables", file=sys.stderr)

def process_url_image(url):
    """Download and process image from URL."""
    try:
        if not url:
            raise ValueError("Empty or invalid URL provided")
            
        print(f"Attempting to load image from URL: {url}", file=sys.stderr)
        
        # Handle different URL formats (including local file URLs)
        if url.startswith('file://'):
            # Local file URL - extract path and open directly
            file_path = url[7:]  # Remove 'file://' prefix
            if os.path.exists(file_path):
                return Image.open(file_path)
            else:
                raise FileNotFoundError(f"Local file not found: {file_path}")
        elif url.startswith(('http://', 'https://')):
            # Standard web URL
            response = requests.get(url, stream=True, timeout=10)  # Add timeout
            response.raise_for_status()  # Raise exception for HTTP errors
            
            image_bytes = response.content
            image = Image.open(io.BytesIO(image_bytes))
            
            print(f"Successfully loaded image from URL, size: {image.size}", file=sys.stderr)
            return image
        else:
            # Try as a local path
            if os.path.exists(url):
                return Image.open(url)
            else:
                # Fallback to treating as web URL even without http prefix
                response = requests.get(f"http://{url}", stream=True, timeout=10)
                response.raise_for_status()
                image_bytes = response.content
                image = Image.open(io.BytesIO(image_bytes))
                return image
    except requests.exceptions.Timeout:
        print(f"Timeout error while loading image from URL: {url}", file=sys.stderr)
        raise ValueError(f"Request timed out when accessing URL: {url}")
    except requests.exceptions.RequestException as req_err:
        print(f"Request error while loading image from URL: {url} - {req_err}", file=sys.stderr)
        raise ValueError(f"Failed to retrieve image from URL: {req_err}")
    except Exception as e:
        print(f"Error processing URL image: {e}", file=sys.stderr)
        raise

def process_base64_image(base64_data):
    """Process base64 encoded image data or direct file path."""
    try:
        # Check if it's a file path instead of actual base64 data
        if os.path.exists(base64_data):
            try:
                with open(base64_data, 'r') as f:
                    base64_data = f.read().strip()
            except UnicodeDecodeError:
                # If not readable as text, try to open as an image directly
                try:
                    return Image.open(base64_data)
                except Exception as img_err:
                    print(f"Error opening as direct image: {img_err}", file=sys.stderr)
                    raise
        
        # Decode base64 and open as image
        if ',' in base64_data:
            # Handle data URLs (e.g., "data:image/png;base64,...")
            base64_data = base64_data.split(',', 1)[1]
            
        image_bytes = base64.b64decode(base64_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        print(f"Successfully decoded base64 image, size: {image.size}", file=sys.stderr)
        return image
    except Exception as e:
        print(f"Error processing base64 image: {e}", file=sys.stderr)
        raise

def encode_image_for_api(image):
    """Convert PIL Image to base64 for API request"""
    buffered = io.BytesIO()
    # Save as PNG for better quality
    image.save(buffered, format="PNG")
    return base64.b64encode(buffered.getvalue()).decode('utf-8')

def perform_llm_vision_detection(image, api_key=None, max_elements=20):
    """
    Detect UI elements using OpenAI's GPT-4 Vision API
    Returns JSON with detected UI elements including labels, positions and confidence
    """
    try:
        if api_key:
            openai.api_key = api_key
        elif OPENAI_API_KEY:
            openai.api_key = OPENAI_API_KEY
        else:
            return [{"label": "error_missing_api_key", "confidence": 0.0, "box": [0,0,0,0]}]
        
        # Convert image to base64 for API
        base64_image = encode_image_for_api(image)
        
        # Get image dimensions
        width, height = image.size
        
        # Prepare the prompt for UI element detection
        prompt = f"""
You are an expert UI element detector. Analyze this screenshot and identify up to {max_elements} UI elements.
For each element:
1. Determine its type (button, text_field, checkbox, dropdown, label, image, icon, window, panel, etc.)
2. Find its precise bounding box coordinates (x, y, width, height) where x,y is top-left corner
3. Assign a confidence score (0.0-1.0)

The image dimensions are: {width}x{height} pixels.

Return ONLY a JSON array with the following structure, no explanation or other text:
[
  {{
    "label": "button",
    "confidence": 0.95,
    "box": [x1, y1, x2, y2]
  }},
  ...more elements...
]

where box coordinates are integers in format [left, top, right, bottom].
"""

        # Call OpenAI Vision API
        client = openai.Client()
        response = client.chat.completions.create(
            model="gpt-4-vision-preview",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{base64_image}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=2500
        )
        
        # Extract the JSON response
        result_text = response.choices[0].message.content
        
        # Try to extract JSON from the response
        json_data = None
        try:
            # Sometimes the LLM wraps the JSON in markdown code blocks, try to handle that
            if "```json" in result_text:
                json_part = result_text.split("```json")[1].split("```")[0].strip()
                json_data = json.loads(json_part)
            elif "```" in result_text:
                json_part = result_text.split("```")[1].strip()
                json_data = json.loads(json_part)
            else:
                json_data = json.loads(result_text)
        except:
            # If JSON parsing fails, return a minimal error detection
            print(f"Error parsing LLM response: {result_text}", file=sys.stderr)
            return [{"label": "error_parsing_response", "confidence": 0.0, "box": [0,0,0,0]}]
        
        # Convert box format if needed and validate
        detections = []
        for item in json_data:
            # Ensure box contains exactly 4 values and fix format if needed
            if "box" in item and len(item["box"]) == 4:
                # Check if the box is in [left, top, right, bottom] format
                # If not, convert from [x, y, width, height] to [x, y, x+w, y+h]
                box = item["box"]
                if box[2] < box[0] or box[3] < box[1]:  # This would indicate [x,y,w,h] format
                    box = [box[0], box[1], box[0] + box[2], box[1] + box[3]]
                
                detections.append({
                    "label": item.get("label", "unknown"),
                    "confidence": item.get("confidence", 0.9),
                    "box": box
                })
        
        return detections
    
    except Exception as e:
        print(f"LLM Vision detection error: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return [{"label": "error_detection_failed", "confidence": 0.0, "box": [0,0,0,0], "error": str(e)}]

def transform_detections(detections_raw, image_width=None, image_height=None):
    """Transform raw detections to client-expected format."""
    transformed = []
    print(f"Transforming {len(detections_raw)} raw detections", file=sys.stderr)
    
    for det in detections_raw:
        box = det['box']
        
        # Check if box is in [left, top, right, bottom] format
        if len(box) != 4:
            print(f"Invalid box format: {box}", file=sys.stderr)
            continue
            
        # Convert from [left, top, right, bottom] to [x, y, width, height]
        x = box[0]
        y = box[1]
        width = box[2] - box[0]
        height = box[3] - box[1]
        
        if width <= 0 or height <= 0:
            print(f"Skipping detection with invalid dimensions: {det}", file=sys.stderr)
            continue
        
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
        },
        "DetectionMethod": "llm_vision"
    }
    
    return result

def name_annotations(image_url, annotations, api_key=None):
    """
    Use LLM Vision to name annotations based on their visual appearance
    
    Args:
        image_url: URL of the image
        annotations: List of annotation objects with coordinates
        api_key: Optional OpenAI API key
        
    Returns:
        List of annotations with suggested names/labels
    """
    try:
        if not annotations or not isinstance(annotations, list):
            return {"error": "No valid annotations provided or invalid format", "annotations": []}
            
        print(f"Processing {len(annotations)} annotations for naming", file=sys.stderr)
        
        # Validate image_url
        if not image_url:
            return {"error": "No image URL provided", "annotations": annotations}
            
        # Load the image from URL
        try:
            image = process_url_image(image_url)
            width, height = image.size
            print(f"Successfully loaded image for annotation naming, size: {width}x{height}", file=sys.stderr)
        except Exception as img_err:
            print(f"Failed to load image for annotation naming: {img_err}", file=sys.stderr)
            return {"error": f"Image loading failed: {str(img_err)}", "annotations": annotations}
        
        # API key setup
        if api_key:
            openai.api_key = api_key
        elif OPENAI_API_KEY:
            openai.api_key = OPENAI_API_KEY
        else:
            return {"error": "Missing OpenAI API key", "annotations": annotations}
        
        # Convert image to base64 for API
        base64_image = encode_image_for_api(image)
        
        # Process annotations in batches to avoid overloading the model
        processed_annotations = []
        batch_size = 5  # Process annotations in groups of 5
        total_batches = (len(annotations) + batch_size - 1) // batch_size
        
        print(f"Processing {len(annotations)} annotations in {total_batches} batches of max {batch_size}", file=sys.stderr)
        
        for i in range(0, len(annotations), batch_size):
            batch = annotations[i:i+batch_size]
            print(f"Processing batch {(i//batch_size)+1}/{total_batches} with {len(batch)} annotations", file=sys.stderr)
            
            # Create individual cropped images for each annotation
            crops_info = []
            
            for idx, ann in enumerate(batch):
                # Extract coordinates - handle different annotation formats
                try:
                    if all(k in ann for k in ('X', 'Y', 'Width', 'Height')):
                        # X, Y, Width, Height format
                        x1 = ann['X']
                        y1 = ann['Y']
                        x2 = x1 + ann['Width']
                        y2 = y1 + ann['Height']
                    elif all(k in ann for k in ('x', 'y', 'width', 'height')):
                        # x, y, width, height format (lowercase)
                        x1 = ann['x']
                        y1 = ann['y']
                        x2 = x1 + ann['width']
                        y2 = y1 + ann['height']
                    elif 'box' in ann and len(ann['box']) >= 4:
                        # Direct box format
                        box = ann['box']
                        x1, y1, x2, y2 = box
                    elif 'coordinates' in ann and len(ann['coordinates']) >= 4:
                        # Coordinates array
                        coords = ann['coordinates']
                        x1, y1, x2, y2 = coords
                    else:
                        print(f"Unable to extract coordinates from annotation {i+idx}: {ann}", file=sys.stderr)
                        continue
                    
                    # Ensure coordinates are valid numbers
                    try:
                        x1 = float(x1)
                        y1 = float(y1)
                        x2 = float(x2)
                        y2 = float(y2)
                    except (ValueError, TypeError):
                        print(f"Invalid coordinate values in annotation {i+idx}: {ann}", file=sys.stderr)
                        continue
                        
                    # Ensure coordinates are valid
                    x1 = max(0, int(x1))
                    y1 = max(0, int(y1))
                    x2 = min(width, int(x2))
                    y2 = min(height, int(y2))
                    
                    # Check if the crop area is too small
                    if x2 - x1 < 5 or y2 - y1 < 5:
                        print(f"Annotation {i+idx} is too small to crop: {x1},{y1},{x2},{y2}", file=sys.stderr)
                        continue
                    
                    # Crop the image
                    try:
                        crop = image.crop((x1, y1, x2, y2))
                        crop_base64 = encode_image_for_api(crop)
                        
                        crops_info.append({
                            "index": i + idx,
                            "crop_base64": crop_base64,
                            "coords": [x1, y1, x2, y2]
                        })
                    except Exception as e:
                        print(f"Error cropping annotation {i+idx}: {e}", file=sys.stderr)
                except Exception as e:
                    print(f"Error processing annotation {i+idx}: {e}", file=sys.stderr)
                    print(f"Annotation data: {ann}", file=sys.stderr)
            
              # Prepare the prompt for UI element identification
            prompt = f"""
You are an expert UI element classifier. Analyze these {len(crops_info)} UI element images cropped from a larger screenshot.
For each element, identify what it is (e.g., button, dropdown, checkbox, text field, label, icon, etc.) 
and assign a descriptive name that explains its purpose or content.

Your response must be a JSON array with one object per image:
[
  {{
    "index": 0,
    "element_type": "button",
    "name": "Submit Button"
  }},
  ...
]
"""
            
            # Call OpenAI Vision API with multiple cropped images
            if crops_info:
                try:
                    print(f"Calling GPT-4 Vision API with {len(crops_info)} cropped images...", file=sys.stderr)
                    client = openai.Client()
                    content = [{"type": "text", "text": prompt}]
                    
                    # Add each cropped image to the content
                    for crop_info in crops_info:
                        content.append({
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{crop_info['crop_base64']}",
                                "detail": "high"
                            }
                        })
                    
                    response = client.chat.completions.create(
                        model="gpt-4-vision-preview",
                        messages=[
                            {
                                "role": "user",
                                "content": content
                            }
                        ],
                        max_tokens=2500,
                        timeout=45  # Add timeout
                    )                    # Parse the response
                    result_text = response.choices[0].message.content
                    print(f"Received response from GPT-4 Vision API, length: {len(result_text)}", file=sys.stderr)
                    # Extract JSON from the response
                    results = None
                    try:
                        if "```json" in result_text:
                            json_part = result_text.split("```json")[1].split("```")[0].strip()
                            results = json.loads(json_part)
                        elif "```" in result_text:
                            json_part = result_text.split("```")[1].strip()
                            results = json.loads(json_part)
                        else:
                            results = json.loads(result_text)
                        
                        if not results or not isinstance(results, list):
                            raise ValueError(f"Invalid results format, expected JSON array but got: {type(results)}")
                            
                        print(f"Successfully parsed {len(results)} label suggestions", file=sys.stderr)
                        
                        # Update the original annotations with the suggested names
                        for result in results:
                            idx = result.get("index")
                            if idx is not None and 0 <= idx < len(annotations):
                                # Generate a label in the format "element_type: name"
                                element_type = result.get("element_type", "element").strip()
                                name = result.get("name", "unnamed").strip()
                                
                                # Create a cleaned-up label
                                label = f"{element_type}: {name}"
                                
                                # Update the annotation in the batch
                                batch_index = idx - i
                                if 0 <= batch_index < len(batch):
                                    batch[batch_index]["label"] = label
                                    print(f"Updated annotation {idx} with label '{label}'", file=sys.stderr)
                                else:
                                    print(f"Invalid batch index {batch_index} for annotation {idx}", file=sys.stderr)
                    except Exception as json_error:
                        print(f"Error parsing JSON from LLM response: {json_error}", file=sys.stderr)
                        print(f"Raw response text: {result_text[:500]}{'...' if len(result_text) > 500 else ''}", file=sys.stderr)
                        
                    
                    # Add processed batch to results
                    processed_annotations.extend(batch)
                    
                except Exception as e:
                    print(f"Error parsing LLM response for name suggestions: {e}", file=sys.stderr)
                    print(f"Raw response: {result_text}", file=sys.stderr)
                    # Add batch without names if there was an error
                    processed_annotations.extend(batch)
            else:
                # No valid crops in this batch
                processed_annotations.extend(batch)
        
        return {"annotations": processed_annotations}
        
    except Exception as e:
        print(f"Error in name_annotations: {e}", file=sys.stderr)
        print(traceback.format_exc(), file=sys.stderr)
        return {"error": str(e), "annotations": annotations}

def main():
    """Main function to handle command line arguments and run detection."""
    parser = argparse.ArgumentParser(description='LLM Vision API object detection')
    parser.add_argument('--url', help='URL of the image to analyze')
    parser.add_argument('--base64_file', help='File containing base64 image data or direct path to image file')
    parser.add_argument('--api_key', help='OpenAI API key (if not set in environment)')
    parser.add_argument('--max_elements', type=int, default=20, help='Maximum number of elements to detect')
    parser.add_argument('--annotations_file', help='JSON file containing image URL and annotations to name')
    parser.add_argument('--name_annotations', action='store_true', help='Use LLM to name annotations')
    
    args = parser.parse_args()
    
    try:
        # Process annotation naming if requested
        if args.name_annotations and args.annotations_file:
            try:
                with open(args.annotations_file, 'r') as f:
                    data = json.load(f)
                
                if 'imageUrl' in data and 'annotations' in data:
                    result = name_annotations(data['imageUrl'], data['annotations'], api_key=args.api_key)
                    print(json.dumps(result))
                    return 0
                else:
                    print(json.dumps({"error": "Invalid annotations file format. Must contain imageUrl and annotations."}))
                    return 1
            except Exception as e:
                print(json.dumps({"error": f"Failed to process annotations file: {str(e)}"}))
                return 1
                
        # Process image
        image = None
        try:
            if args.url:
                image = process_url_image(args.url)
            elif args.base64_file:
                image = process_base64_image(args.base64_file)
            else:
                print(json.dumps({"error": "No image provided. Use --url or --base64_file"}))
                return 1
        except Exception as img_error:
            print(json.dumps({"error": f"Failed to process image: {str(img_error)}"}))
            return 1
            
        # Record dimensions
        width, height = image.size
        print(f"Image dimensions: {width}x{height}", file=sys.stderr)
            
        # Perform LLM Vision API detection
        detections = perform_llm_vision_detection(
            image, 
            api_key=args.api_key,
            max_elements=args.max_elements
        )
        
        # Transform to expected format
        result = transform_detections(detections, width, height)
        
        # Output JSON result
        print(json.dumps(result, indent=2))
        return 0
        
    except Exception as e:
        print(json.dumps({"error": f"Detection failed: {str(e)}"}))
        print(traceback.format_exc(), file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
