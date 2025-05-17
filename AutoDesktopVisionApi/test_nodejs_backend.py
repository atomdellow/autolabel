import requests
import json
import sys
import os
import base64
from pathlib import Path

# Test OpenCV contour detection with a URL image using the Node.js backend
def test_opencv_contour_detection():    # API endpoint URL - using the Node.js backend endpoint
    api_url = "http://localhost:5001/api/detection/detect"
    
    # Test with one of our uploaded images
    test_image_url = "http://localhost:5001/uploads/image-1747378407599-30427821.png"
    
    # Detection parameters
    payload = {
        "detectionMethod": "opencv_contour",
        "image_url": test_image_url,
        "detectionParams": {
            "sensitivity": 0.5,
            "minArea": 100
        }
    }
    
    print(f"Testing OpenCV contour detection with URL image: {test_image_url}")
    print(f"Sending request to: {api_url}")
    print(f"Request payload: {json.dumps(payload, indent=2)}")
    
    try:
        # Send POST request to the API
        response = requests.post(api_url, json=payload)
        
        # Check if the request was successful
        if response.status_code == 200:
            result = response.json()
            print("\nSuccess! Response received:")
            print(json.dumps(result, indent=2))
            
            # Display number of detections
            if "Detections" in result:
                print(f"\nFound {len(result['Detections'])} elements in the image.")
            return True
        else:
            print(f"\nError: Received status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
    
    except Exception as e:
        print(f"\nError during API request: {str(e)}")
        return False

if __name__ == "__main__":
    # Run the test
    success = test_opencv_contour_detection()
    if success:
        print("\nTest completed successfully!")
    else:
        print("\nTest failed!")
        sys.exit(1)
