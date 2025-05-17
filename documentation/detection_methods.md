# AutoLabel Detection Methods

This comprehensive guide explains the detection methods available in AutoLabel for identifying UI elements in desktop screenshots.

## Overview

AutoLabel offers three distinct methods for detecting UI elements in your desktop screenshots:

1. **YOLO (Machine Learning)** - Deep learning-based detection using YOLOv8
2. **OpenCV Contour Detection** - Computer vision approach using edge detection and contours
3. **Structural Similarity (SSIM)** - Comparison-based approach to detect differences between images

## When to Use Each Method

### YOLO (Machine Learning)

**Best for:**
- General-purpose UI element detection
- Detecting specific UI elements like buttons, text fields, checkboxes, etc.
- Screenshots with complex UI designs
- When you want semantic labeling of elements (i.e., "button", "checkbox", etc.)

**Advantages:**
- Trained to recognize common UI elements
- Provides semantic labels for detected elements
- Works well with varied visual styles
- Handles complex backgrounds and overlapping elements

**Limitations:**
- May miss uncommon or custom UI elements
- Requires more processing time than simpler methods
- Labels are limited to what the model was trained on

### OpenCV Contour Detection

**Best for:**
- Screenshots with clean, high-contrast UI elements
- Detecting UI elements with clear boundaries
- When you need to find more elements than YOLO might detect
- Custom or uniquely styled UI elements

**Advantages:**
- Can detect any visual element with a clear boundary
- Finds elements regardless of their semantic type
- Faster than deep learning approaches
- Customizable sensitivity and area filters

**Limitations:**
- May detect too many or too few elements depending on settings
- Doesn't provide semantic labeling (uses generic labels like "ui_element")
- Can be affected by background complexity and low contrast

### Structural Similarity (SSIM)

**Best for:**
- Detecting changes between two similar screenshots
- Finding UI elements that appear/disappear between states
- Identifying interactive elements by comparing before/after states
- Automated testing of UI changes

**Advantages:**
- Excellent for finding exactly what changed between two images
- Great for detecting interactive elements
- Useful for validating UI updates or transitions
- Can find subtle changes that might be missed by other methods

**Limitations:**
- Requires two screenshots to compare
- Detects changes, not necessarily complete UI elements
- Works best when screenshots are aligned and similar in overall content

## How to Use

### YOLO Detection
1. Select "YOLO (Machine Learning)" from the Detection Method dropdown
2. Click the "Auto-detect shapes" button
3. The detected UI elements will appear on the screen

### OpenCV Contour Detection
1. Select "OpenCV Contour Detection" from the Detection Method dropdown
2. Adjust the parameters:
   - **Sensitivity**: Controls how sensitive the edge detection is (higher values detect more edges)
   - **Min Area**: Sets the minimum size of elements to detect (filters out small noise)
3. Click the "Auto-detect shapes" button
4. The detected UI elements will appear on the screen

### Structural Similarity (SSIM)
1. Select "Structural Similarity (SSIM)" from the Detection Method dropdown
2. Select a reference image from the dropdown
3. Click the "Auto-detect shapes" button
4. The elements that differ between the current image and reference image will be detected

## Adjusting Detection Parameters

### OpenCV Parameters

- **Sensitivity (0.1-0.9):** Controls edge detection sensitivity
  - Higher values (closer to 0.9) detect more edges, finding more potential UI elements but potentially including noise
  - Lower values (closer to 0.1) detect only strong edges, finding fewer but more definite UI elements
  
- **Minimum Area:** The smallest element size (in pixels) to detect
  - Increase to ignore small elements like icons or decorations
  - Decrease to include smaller UI elements

### SSIM Parameters

- **Reference Image:** Select another screenshot to compare against
  - For best results, choose a screenshot that is similar but shows a different state of the same UI
  - Examples: before/after clicking a button, opening/closing a menu, etc.

## Tips for Best Results

- **YOLO**: Works best with familiar UI elements from Windows, macOS, or web interfaces
- **OpenCV**: 
  - Increase sensitivity for low-contrast interfaces
  - Increase min area if too many small elements are detected
  - Works well with clear boundaries between elements
- **SSIM**: 
  - Use screenshots with the same dimensions
  - Choose a reference image that is visually similar except for the changes you want to detect

## Practical Workflows

### Combined Approach
For complex annotation tasks, try using multiple detection methods and combine the results:
1. Start with YOLO to detect common UI elements
2. Use OpenCV to detect additional elements that YOLO missed
3. Use SSIM to detect interactive elements by comparing before/after states

### Finding Interactive Elements
1. Take a screenshot of the interface in its initial state
2. Take another screenshot after hovering or clicking on a potential interactive element
3. Use SSIM comparison to detect exactly what changed
4. The changes detected are likely interactive elements

### Handling Custom UIs
1. Start with YOLO detection
2. For custom UI elements that YOLO doesn't detect:
   - Switch to OpenCV
   - Adjust sensitivity based on the UI contrast
   - Set min area to match the size of the smallest elements you want to detect

## Technical Implementation

AutoLabel integrates these detection methods directly in the annotation interface through:

- YOLO: Uses the YOLO model through the `detect_objects.py` script
- OpenCV: Uses contour detection through the `detect_contours_fixed.py` script
- SSIM: Uses structural similarity through the `compare_images.py` script

All methods are accessible through the backend API endpoints:
- `/api/detection/detect` for YOLO and OpenCV detection
- `/api/detection/compare` for SSIM comparison

## Testing the Detection Methods

AutoLabel includes several test scripts to verify the functionality of each detection method:

- **test_opencv_detection.py** - Tests the OpenCV contour detection directly
- **test_ssim_comparison.py** - Tests the SSIM comparison functionality
- **test_detection_api.py** - Tests the detection API endpoints
- **test_all_detection_methods.py** - Comprehensive test of all detection methods

### Running Tests

To test a specific detection method:

```bash
# Test OpenCV detection
python test_opencv_detection.py path/to/image.png

# Test SSIM comparison
python test_ssim_comparison.py path/to/image1.png path/to/image2.png

# Test all detection methods through the API
python test_all_detection_methods.py path/to/image.png --compare-image path/to/image2.png
```

### Command-line Arguments

Each detection script supports specific command-line arguments:

#### YOLO Detection (detect_objects.py)
```
--gui-mode         Use GUI-specific detection settings
--conf CONF        Confidence threshold (default: 0.25)
--url URL          Image URL to process
--base64_file FILE Path to file containing base64 image data
```

#### OpenCV Detection (detect_contours_fixed.py)
```
--image IMAGE      Path to image file
--base64 BASE64    Path to file containing base64 image data
--sensitivity SENS Edge detection sensitivity (0.1-0.9)
--min_area MIN     Minimum contour area
--max_area MAX     Maximum contour area
```

#### SSIM Comparison (compare_images.py)
```
--base64_file1 FILE1 Path to file containing base64 data for first image
--base64_file2 FILE2 Path to file containing base64 data for second image
```
