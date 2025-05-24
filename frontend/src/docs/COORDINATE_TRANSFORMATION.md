# Coordinate Transformation in Autolabel Frontend

## Overview

This document describes the coordinate transformation system used in the Autolabel frontend to convert between image space (natural coordinates) and screen space (canvas/display coordinates).

## Key Components

1. **Image Space (Natural Coordinates)**: These are coordinates in the original image's coordinate system, unaffected by zoom or pan.
   - Annotations are stored in the database in image space coordinates.

2. **Screen Space (Canvas Coordinates)**: These are coordinates on the canvas element, affected by zoom level and pan offset.
   - Used for drawing and interaction.

## Transformation Functions

The main transformation utility is `transformCoordinates` in `annotationUtils.js`. This bidirectional function converts coordinates between image space and screen space:

```javascript
transformCoordinates(coords, zoomLevel, panOffset, direction = 'screenToImage')
```

**Parameters:**
- `coords`: Object with `x`, `y`, `width`, and `height` properties
- `zoomLevel`: Current zoom level (1 = original size)
- `panOffset`: Object with `x` and `y` properties representing pan offset
- `direction`: Either 'screenToImage' (default) or 'imageToScreen'

## Transformation Formulas

1. **Image to Screen Transformation**:
   ```
   screenX = imageX * zoomLevel + panOffset.x
   screenY = imageY * zoomLevel + panOffset.y
   screenWidth = imageWidth * zoomLevel
   screenHeight = imageHeight * zoomLevel
   ```

2. **Screen to Image Transformation**:
   ```
   imageX = (screenX - panOffset.x) / zoomLevel
   imageY = (screenY - panOffset.y) / zoomLevel
   imageWidth = screenWidth / zoomLevel
   imageHeight = screenHeight / zoomLevel
   ```

## Debug Tools

### Console Functions

Use these functions in the browser console to debug coordinate transformation:

1. **Test Coordinate Transformation**:
   ```javascript
   debugCoordinateTransform()
   ```
   This will test coordinate transformation with existing annotations or sample values.

### Zoom Test

Use the zoom test button in the UI to run a sequence of zoom levels and test coordinate transformation at each level.

## Common Issues Fixed

1. **Annotation Misalignment**: Annotations appearing offset from their intended targets when zooming or panning.
   - **Fix**: Ensured consistent use of transformation utilities across all components.

2. **Inconsistent Drawing**: Rectangle drawing coordinates not properly transformed between screen and image space.
   - **Fix**: Updated drawing functions to clearly separate screen and image space, with proper transformations when needed.

3. **Multiple Transformation Methods**: Different components were using different transformation methods.
   - **Fix**: Standardized on a single bidirectional transformation utility.

## How to Verify Fixes

1. **Drawing Test**:
   - Draw rectangles at different zoom levels (1x, 1.5x, 2x, 0.5x)
   - Pan the view and draw rectangles
   - Verify rectangles appear at the expected positions

2. **Transformation Round-Trip Test**:
   - Use `debugCoordinateTransform()` in console
   - Check that coordinates transformed to screen space and back match the original coordinates

## Implementation Details

The transformation utilities are implemented in:

1. `src/utils/annotationUtils.js` - Core transformation function
2. `src/views/AnnotationEditor/composables/useCanvasCoordinates.js` - Canvas coordinate handling
3. `src/views/AnnotationEditor/composables/useAnnotationDraw.js` - Drawing with proper transformations
