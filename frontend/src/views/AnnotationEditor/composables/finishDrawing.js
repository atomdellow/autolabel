//
// This is a complete rewrite of the finishDrawing function to ensure
// proper coordinate transformation between screen space and image space
//

/**
 * Finishes the drawing operation
 * @returns {Object|null} The drawn rectangle or null if too small
 */
function finishDrawing() {
  if (!drawing.value || !currentRectRaw.value) {
    drawing.value = false;
    return null;
  }
  
  const rect = { ...currentRectRaw.value };
  
  // Reset drawing state
  drawing.value = false;
  currentRectRaw.value = null;
  
  // Check if the rectangle is large enough
  if (rect.width < 5 || rect.height < 5) {
    console.log('Rectangle too small, ignoring:', rect);
    return null;
  }
  
  // STEP 1: Log our starting point - screen coordinates
  console.log('DRAWING COMPLETE - Screen space rectangle:', rect);
  console.log(`Using zoom level: ${zoomPan.zoomLevel.value}, pan offset: (${zoomPan.panOffset.value.x}, ${zoomPan.panOffset.value.y})`);
  
  // STEP 2: Transform from screen space to image space
  // This is the critical step - we need to account for zoom and pan
  const imageSpaceCoords = {
    // First subtract the pan offset, then divide by zoom level
    x: (rect.x - zoomPan.panOffset.value.x) / zoomPan.zoomLevel.value,
    y: (rect.y - zoomPan.panOffset.value.y) / zoomPan.zoomLevel.value,
    
    // Width and height just need to be scaled by zoom level
    width: rect.width / zoomPan.zoomLevel.value,
    height: rect.height / zoomPan.zoomLevel.value
  };
  
  // STEP 3: Log the transformed coordinates
  console.log('TRANSFORMED - Image space coordinates:', imageSpaceCoords);
  
  // STEP 4: Create a properly formatted annotation with all required fields
  const newAnnotation = validateAnnotationData({
    id: `new-annotation-${Date.now()}`, // Generate a unique ID
    label: 'New Annotation', // Default label - will be updated when user selects a class
    x: Math.round(imageSpaceCoords.x),
    y: Math.round(imageSpaceCoords.y),
    width: Math.round(imageSpaceCoords.width),
    height: Math.round(imageSpaceCoords.height),
    confidence: 1.0, // For user-drawn annotations
    layerOrder: annotationStore.currentAnnotations?.length || 0, // Put on top
    color: '#00AAFF', // Default color
  }, null); // imageId will be added in the store
  
  // STEP 5: Store the formatted annotation for creation
  pendingAnnotationCoordinates.value = newAnnotation;
  
  // STEP 6: Log the final annotation data
  console.log('FINAL ANNOTATION DATA:', newAnnotation);
  
  return newAnnotation;
}
