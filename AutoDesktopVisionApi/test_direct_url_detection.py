import sys
import os
import subprocess
import json

# Direct test of the detect_contours_fixed.py script with URL image
def test_opencv_contour_direct():
    # Get the absolute path to the script
    script_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "detect_contours_fixed.py")
    
    # Test image URL
    test_image_url = "http://localhost:3000/uploads/image-1747378407599-30427821.png"
    
    # If the URL is not accessible, use a public test image
    fallback_image_url = "https://github.com/ultralytics/ultralytics/raw/main/ultralytics/assets/bus.jpg"
    
    # Command to run the script with the URL
    print(f"Testing detect_contours_fixed.py with URL image")
    print(f"Script path: {script_path}")
    print(f"Test URL: {test_image_url}")
    
    # Try with the original URL
    result = run_detection(script_path, test_image_url)
    
    # If it fails, try with the fallback URL
    if not result:
        print("\nFallback: Testing with public image URL")
        print(f"Fallback URL: {fallback_image_url}")
        result = run_detection(script_path, fallback_image_url)
    
    return result

def run_detection(script_path, image_url):
    try:
        # Run the Python script with the URL as argument
        cmd = [
            sys.executable,  # Current Python interpreter
            script_path,
            "--image", image_url,
            "--sensitivity", "0.5",
            "--min_area", "100"
        ]
        
        print(f"Running command: {' '.join(cmd)}")
        
        # Execute the command and capture output
        process = subprocess.Popen(
            cmd, 
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate()
        
        # Check if the process ran successfully
        if process.returncode == 0:
            print("\nSuccess! Script executed successfully.")
            
            try:
                # Try to parse the JSON output
                result = json.loads(stdout)
                print(f"Parsed output: {json.dumps(result, indent=2)}")
                
                # Check if we have detections
                if "Detections" in result:
                    print(f"\nFound {len(result['Detections'])} elements in the image.")
                
                return True
            except json.JSONDecodeError:
                print(f"Warning: Output is not valid JSON: {stdout}")
                print(f"Stderr: {stderr}")
                return False
        else:
            print(f"\nError: Script exited with code {process.returncode}")
            print(f"Stdout: {stdout}")
            print(f"Stderr: {stderr}")
            return False
            
    except Exception as e:
        print(f"\nError running detection script: {str(e)}")
        return False

if __name__ == "__main__":
    # Run the direct test
    success = test_opencv_contour_direct()
    if success:
        print("\nTest completed successfully!")
    else:
        print("\nTest failed!")
        sys.exit(1)
