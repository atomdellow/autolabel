#!/usr/bin/env python3
"""
Test script for the OpenCV contour detection method

This script tests the command-line interface of the detect_contours_fixed.py script
to ensure it works correctly with the arguments passed by the backend.
"""

import os
import sys
import subprocess
import argparse
import base64
from PIL import Image
import io

def encode_image_to_base64(image_path):
    """Convert an image file to base64 string"""
    with open(image_path, 'rb') as f:
        image_data = f.read()
        base64_data = base64.b64encode(image_data).decode('utf-8')
        return base64_data

def save_base64_to_file(base64_data, output_path):
    """Save base64 data to a file"""
    with open(output_path, 'w') as f:
        f.write(base64_data)
    return output_path

def test_opencv_detection(image_path=None, sensitivity=0.5, min_area=100):
    """Test the OpenCV detection script with various argument combinations"""
    script_path = os.path.join(os.path.dirname(__file__), 'detect_contours_fixed.py')
    
    print(f"\n{'='*60}")
    print(f"Testing OpenCV detection with detect_contours_fixed.py")
    print(f"{'='*60}")
    
    if not os.path.exists(script_path):
        print(f"Error: Script not found at {script_path}")
        return False
    
    # Test cases with different argument combinations
    tests = []
    
    if image_path and os.path.exists(image_path):
        # Test with direct image file
        tests.append({
            'name': 'Direct image file',
            'args': ['--image', image_path, '--sensitivity', str(sensitivity), '--min_area', str(min_area)]
        })
        
        # Test with base64 data
        base64_data = encode_image_to_base64(image_path)
        base64_file = save_base64_to_file(base64_data, 'temp_base64_data.txt')
        
        tests.append({
            'name': 'Base64 data from file',
            'args': ['--base64', base64_file, '--sensitivity', str(sensitivity), '--min_area', str(min_area)]
        })
    else:
        # If no image provided, test just the script invocation
        tests.append({
            'name': 'Help display',
            'args': ['--help']
        })
    
    # Run the tests
    success_count = 0
    for test in tests:
        print(f"\nTest: {test['name']}")
        print(f"Command: python {script_path} {' '.join(test['args'])}")
        
        try:
            # Execute the script with the arguments
            process = subprocess.run(
                ['python', script_path] + test['args'],
                capture_output=True,
                text=True,
                timeout=30  # 30 seconds timeout
            )
            
            # Print output
            if process.stdout:
                print("\nStandard Output:")
                print(process.stdout[:500] + "..." if len(process.stdout) > 500 else process.stdout)
            
            if process.stderr:
                print("\nStandard Error:")
                print(process.stderr)
            
            # Check exit code
            print(f"\nExit code: {process.returncode}")
            if process.returncode == 0:
                print("✅ Test passed")
                success_count += 1
            else:
                print("❌ Test failed")
        
        except subprocess.TimeoutExpired:
            print("❌ Test failed: Timeout")
        except Exception as e:
            print(f"❌ Test failed: {e}")
    
    # Clean up temp file
    if os.path.exists('temp_base64_data.txt'):
        os.remove('temp_base64_data.txt')
    
    # Print summary
    print(f"\n{'='*60}")
    print(f"Test Summary: {success_count}/{len(tests)} tests passed")
    print(f"{'='*60}")
    
    return success_count == len(tests)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test OpenCV contour detection")
    parser.add_argument('image', nargs='?', help='Path to the image file (optional)')
    parser.add_argument('--sensitivity', type=float, default=0.5, help='Edge detection sensitivity (0.1-0.9)')
    parser.add_argument('--min_area', type=int, default=100, help='Minimum contour area')
    
    args = parser.parse_args()
    
    test_opencv_detection(args.image, args.sensitivity, args.min_area)
