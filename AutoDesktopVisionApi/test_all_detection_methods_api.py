import requests
import json
import sys
import time

def test_all_detection_methods():
    # API endpoint URL
    api_url = "http://localhost:5001/api/detection/detect"
    
    # Test image URL - use a local uploaded image
    test_image_url = "http://localhost:5001/uploads/image-1747378407599-30427821.png"
    
    # Fallback to a public image if the local one is not accessible
    fallback_image_url = "https://github.com/ultralytics/ultralytics/raw/main/ultralytics/assets/bus.jpg"
    
    # Detection methods to test
    detection_methods = ["yolo", "opencv_contour", "ssim"]
    
    results = {}
    
    for method in detection_methods:
        print(f"\n\n===== Testing {method.upper()} detection method =====")
        
        # Detection parameters
        payload = {
            "detectionMethod": method,
            "image_url": test_image_url,
            "detectionParams": {
                "sensitivity": 0.5,
                "minArea": 100
            }
        }
        
        print(f"Sending request to: {api_url}")
        print(f"Method: {method}")
        
        try:
            # Send POST request to the API
            start_time = time.time()
            response = requests.post(api_url, json=payload, timeout=30)
            elapsed_time = time.time() - start_time
            
            # Check if the request was successful
            if response.status_code == 200:
                result = response.json()
                num_detections = len(result.get("Detections", []))
                print(f"\nSuccess! Response received in {elapsed_time:.2f} seconds")
                print(f"Found {num_detections} elements in the image")
                results[method] = {
                    "success": True,
                    "numDetections": num_detections,
                    "time": elapsed_time
                }
            else:
                print(f"\nError: Received status code {response.status_code}")
                print(f"Response: {response.text}")
                
                # If the first URL fails, try with the fallback URL
                if method == "yolo" and "fallback" not in results:
                    print(f"\nTrying fallback image URL: {fallback_image_url}")
                    payload["image_url"] = fallback_image_url
                    
                    fallback_response = requests.post(api_url, json=payload, timeout=30)
                    if fallback_response.status_code == 200:
                        result = fallback_response.json()
                        num_detections = len(result.get("Detections", []))
                        print(f"\nSuccess with fallback image! Found {num_detections} elements")
                        results["fallback"] = True
                    else:
                        results[method] = {
                            "success": False,
                            "error": f"Status code: {response.status_code}"
                        }
                else:
                    results[method] = {
                        "success": False,
                        "error": f"Status code: {response.status_code}"
                    }
                    
        except Exception as e:
            print(f"\nError during API request: {str(e)}")
            results[method] = {
                "success": False,
                "error": str(e)
            }
    
    # Print summary
    print("\n\n===== Detection Methods Test Summary =====")
    all_success = True
    
    for method in detection_methods:
        if method in results:
            result = results[method]
            if result["success"]:
                print(f"✅ {method.upper()}: Success - Found {result['numDetections']} elements in {result['time']:.2f} seconds")
            else:
                print(f"❌ {method.upper()}: Failed - {result.get('error', 'Unknown error')}")
                all_success = False
        else:
            print(f"❌ {method.upper()}: No results")
            all_success = False
    
    return all_success

if __name__ == "__main__":
    # Run the tests
    success = test_all_detection_methods()
    if success:
        print("\nAll detection methods tested successfully!")
    else:
        print("\nSome detection methods failed the test.")
        sys.exit(1)
