// Enhanced annotation utilities to fix coordinate transformation and validation issues

/**
 * Validate and clean annotation data to ensure it has all required fields
 * 
 * @param {Object} annotationData - The raw annotation data
 * @param {Object} imageId - The ID of the image this annotation belongs to
 * @returns {Object} Cleaned and validated annotation data
 */
export function validateAnnotationData(annotationData, imageId) {
  // Make sure we have valid data to start with
  if (!annotationData) {
    throw new Error('No annotation data provided');
  }
  
  // Ensure all required fields are present
  const validatedAnnotation = {
    ...annotationData,
    id: annotationData.id || annotationData._id || `new-annotation-${Date.now()}`,
    _id: annotationData._id || annotationData.id || `new-annotation-${Date.now()}`,
    label: annotationData.label || 'New Annotation', // Required by backend
    imageId: imageId,
    x: Number(annotationData.x) || 0,
    y: Number(annotationData.y) || 0,
    width: Number(annotationData.width) || 0,
    height: Number(annotationData.height) || 0,
    confidence: annotationData.confidence || 1.0,
    color: annotationData.color || '#00AAFF',
    layerOrder: typeof annotationData.layerOrder === 'number' ? 
      annotationData.layerOrder : 0
  };
  
  return validatedAnnotation;
}

/**
 * Transform annotation coordinates between screen space and image space
 * 
 * @param {Object} coords - The coordinates (x, y, width, height)
 * @param {number} zoomLevel - Current zoom level
 * @param {Object} panOffset - Current pan offset {x, y}
 * @param {string} direction - Transformation direction: 'screenToImage' (default) or 'imageToScreen'
 * @returns {Object} The transformed coordinates
 */
export function transformCoordinates(coords, zoomLevel, panOffset, direction = 'screenToImage') {
  if (!coords) {
    console.error('transformCoordinates: No coordinates provided');
    return null;
  }
  
  // Get actual values with defaults for safety
  const zoom = typeof zoomLevel === 'number' ? zoomLevel : 1;
  const pan = panOffset && typeof panOffset === 'object' ? panOffset : { x: 0, y: 0 };
  
  // Ensure pan has x and y properties
  if (pan.x === undefined || pan.y === undefined) {
    console.warn('transformCoordinates: panOffset missing x or y properties, using defaults');
    pan.x = pan.x || 0;
    pan.y = pan.y || 0;
  }
  
  // Skip transformation if zoom is 1 and no pan offset
  if (zoom === 1 && pan.x === 0 && pan.y === 0) {
    return { 
      x: coords.x, 
      y: coords.y, 
      width: coords.width, 
      height: coords.height 
    };
  }
  
  let result;
  
  if (direction === 'screenToImage') {
    // Convert from screen coordinates to image coordinates
    result = {
      x: (coords.x - pan.x) / zoom,
      y: (coords.y - pan.y) / zoom,
      width: coords.width / zoom,
      height: coords.height / zoom
    };
    
    console.log('TRANSFORM [Screen → Image]:', { 
      original: coords, 
      transformed: result,
      zoom,
      pan
    });
  } else {
    // Convert from image coordinates to screen coordinates
    result = {
      x: coords.x * zoom + pan.x,
      y: coords.y * zoom + pan.y,
      width: coords.width * zoom,
      height: coords.height * zoom
    };
    
    console.log('TRANSFORM [Image → Screen]:', { 
      original: coords, 
      transformed: result,
      zoom,
      pan
    });
  }
  
  return result;
}

/**
 * Enhance an annotation with proper ID field normalization
 * 
 * @param {Object} annotation - The annotation to enhance
 * @returns {Object} Enhanced annotation with normalized id fields
 */
export function normalizeAnnotationIds(annotation) {
  if (!annotation) return null;
  
  const enhanced = { ...annotation };
  
  // Ensure both id and _id fields exist
  if (enhanced._id && !enhanced.id) {
    enhanced.id = enhanced._id;
  } else if (enhanced.id && !enhanced._id) {
    enhanced._id = enhanced.id;
  } else if (!enhanced._id && !enhanced.id) {
    const newId = `new-annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    enhanced.id = newId;
    enhanced._id = newId;
  }
  
  return enhanced;
}

/**
 * Test the coordinate transformation in both directions
 * This is useful for debugging coordinate issues
 * 
 * @param {Object} coords - The coordinates to test (x, y, width, height)
 * @param {number} zoomLevel - Current zoom level
 * @param {Object} panOffset - Current pan offset {x, y}
 */
export function testCoordinateTransform(coords, zoomLevel, panOffset) {
  console.log('COORDINATE TRANSFORM TEST:', { 
    original: coords,
    zoom: zoomLevel,
    pan: panOffset
  });
  
  // Step 1: Transform from image to screen
  const screenCoords = transformCoordinates(
    coords,
    zoomLevel,
    panOffset,
    'imageToScreen'
  );
  
  console.log('STEP 1: Image → Screen:', screenCoords);
  
  // Step 2: Transform back from screen to image
  const imageCoords = transformCoordinates(
    screenCoords,
    zoomLevel,
    panOffset,
    'screenToImage'
  );
  
  console.log('STEP 2: Screen → Image:', imageCoords);
  
  // Check if the round trip returns the original coordinates (within rounding error)
  const xDiff = Math.abs(coords.x - imageCoords.x);
  const yDiff = Math.abs(coords.y - imageCoords.y);
  const widthDiff = Math.abs(coords.width - imageCoords.width);
  const heightDiff = Math.abs(coords.height - imageCoords.height);
  
  const isMatch = xDiff < 0.01 && yDiff < 0.01 && widthDiff < 0.01 && heightDiff < 0.01;
  
  console.log('TRANSFORM ROUND TRIP ' + (isMatch ? 'SUCCESSFUL' : 'FAILED'), {
    differences: {
      x: xDiff,
      y: yDiff,
      width: widthDiff,
      height: heightDiff
    }
  });
  
  return isMatch;
}
