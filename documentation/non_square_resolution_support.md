# Non-Square Image Resolution Support - Implementation Notes

## Changes Made

### Backend Controller (`trainingController.js`)
1. Enhanced the parameter handling to support:
   - Direct `imgWidth` and `imgHeight` parameters
   - String format `imgSize` parameter like "640x480" 
   - Legacy numeric `imgSize` parameter (for backward compatibility)
2. Added parsing logic to extract width and height values
3. Updated command-line arguments for the Python script
4. Updated response JSON to include both original and parsed dimensions

### Training Script (`train_yolo.py`)
1. Added separate `--img_width` and `--img_height` parameters
2. Maintained backwards compatibility with `--img_size` parameter
3. Enhanced image size handling in the training function:
   - Support for rectangular dimensions [width, height]
   - Support for square dimensions (legacy mode)
4. Updated console output to show the dimensions being used

## Testing Plan

### 1. Test with Square Dimensions (Legacy)
- Use imgSize=640 as a number
- Expected result: Training with 640x640 image size

### 2. Test with String Format Dimensions
- Use imgSize="640x480" as a string
- Expected result: Training with 640x480 image size

### 3. Test with Direct Width/Height Parameters
- Use imgWidth=1280, imgHeight=720
- Expected result: Training with 1280x720 image size

### 4. Test with Frontend Form
- Select predefined resolution: 1920x1080
- Expected result: Training with 1920x1080 image size

### 5. Test with Custom Resolution via Frontend
- Select "Custom Size" and enter width=800, height=600
- Expected result: Training with 800x600 image size

## Notes
- The ultralytics YOLO package supports non-square dimensions by accepting a list [width, height] for the `imgsz` parameter.
- Test with smaller datasets first to verify that the dimensions are correctly passed through the entire pipeline.
- Monitor GPU memory usage, as larger dimensions will increase memory requirements.
