import { ref } from 'vue';
import { transformCoordinates, validateAnnotationData } from '../../../utils/annotationUtils';

/**
 * Composable for handling annotation drawing functionality
 * @param {Object} canvasComponent - Reference to the canvas component
 * @param {Object} projectId - The project ID 
 * @param {Object} imageId - The image ID
 * @param {Object} annotationStore - The annotation store for saving annotations
 * @param {Object} toast - Toast notification service
 * @param {Object} zoomPan - The zoom pan composable
 * @param {Function} redrawCallback - Function to call when redraw is needed
 */
export function useAnnotationDraw(canvasComponent, projectId, imageId, annotationStore, toast, zoomPan, redrawCallback) {
  // Canvas context for drawing
  const canvasContext = ref(null);
  
  // Tool selection
  const currentTool = ref('rectangle'); // Default tool: 'rectangle', 'pan', 'select'
  
  // Drawing state
  const drawing = ref(false);
  const startX = ref(0);
  const startY = ref(0);
  const currentX = ref(0);
  const currentY = ref(0);
  const startPos = ref({ x: 0, y: 0 });
  const currentRectRaw = ref(null);
  const pendingAnnotationCoordinates = ref(null);

  // Debug flag to trace coordinates
  const debugCoordinates = ref(false);
  
  /**
   * Sets the canvas context for drawing
   * @param {CanvasRenderingContext2D} ctx - The canvas context
   */
  function setCanvasContext(ctx) {
    if (!ctx) {
      console.warn('Attempted to set null canvas context');
      return;
    }
    canvasContext.value = ctx;
    console.log('Canvas context set in annotationDraw');
  }  /**
   * Redraws the canvas with current annotations
   */
  function redrawCanvas() {
    // Add explicit check for canvasContext and its value
    if (!canvasContext || !canvasContext.value) {
      console.warn('Cannot redraw: canvas context is null or undefined');
      // Request another redraw attempt after a short delay
      setTimeout(() => {
        console.log('Retrying canvas redraw...');
        redrawCanvas();
      }, 100);
      return;
    }
    
    try {
      // Clear the canvas
      const canvas = canvasContext.value.canvas;
      
      if (!canvas) {
        console.warn('Cannot redraw: canvas element is null');
        return;
      }
      
      // Check if canvas dimensions are valid
      if (canvas.width === 0 || canvas.height === 0) {
        console.warn('Cannot redraw: canvas has zero dimensions');
        return;
      }
      
      // Force a repaint before clearing and redrawing
      void canvas.offsetHeight;
      
      canvasContext.value.clearRect(0, 0, canvas.width, canvas.height);
        // Draw any pending rectangles
      if (drawing && drawing.value === true && currentRectRaw && currentRectRaw.value) {
        // Draw the current rectangle being created - these are screen coordinates already
        canvasContext.value.strokeStyle = '#00AAFF';
        canvasContext.value.lineWidth = 2;
        
        const rect = currentRectRaw.value;
        
        // Draw the raw rectangle exactly as measured on screen
        // These coordinates are already in screen space, no transformation needed
        canvasContext.value.strokeRect(
          rect.x,
          rect.y,
          rect.width,
          rect.height
        );
        
        // Log successful drawing
        console.log('Drew in-progress rectangle in screen space:', rect);
      }
      
      // Log successful redraw
      console.log('Canvas redrawn successfully');
    } catch (error) {
      console.error('Error in redrawCanvas:', error);
    }
    
    // Do not call redrawCallback from here to avoid circular reference
    // The parent component should handle coordinating redraw between composables
  }/**
   * Sets the current drawing tool
   * @param {string} tool - The tool to set ('rectangle', 'pan', 'select')
   */
  function setTool(tool) {
    if (['rectangle', 'pan', 'select'].includes(tool)) {
      // Clear any active drawing state
      drawing.value = false;
      currentRectRaw.value = null;
      
      // Set the new tool
      currentTool.value = tool;
      
      console.log(`Tool set to: ${tool}`);
    }
  }
  
  /**
   * Starts a drawing operation
   * @param {number} x - The x coordinate to start drawing from
   * @param {number} y - The y coordinate to start drawing from
   */
  function startDrawing(x, y) {
    drawing.value = true;
    startX.value = x;
    startY.value = y;
    startPos.value = { x, y };
    
    currentRectRaw.value = {
      x: startX.value,
      y: startY.value,
      width: 0,
      height: 0
    };
  }
    /**
   * Updates the current rectangle being drawn
   * @param {number} x - The current x coordinate
   * @param {number} y - The current y coordinate
   */
  function updateDrawing(x, y) {
    if (!drawing.value) return;
    
    currentX.value = x;
    currentY.value = y;
    
    // Calculate width and height
    const width = x - startX.value;
    const height = y - startY.value;
    
    // Update the current rectangle
    // These are raw screen coordinates without any transformation
    const rect = {
      x: width < 0 ? x : startX.value,
      y: height < 0 ? y : startY.value,
      width: Math.abs(width),
      height: Math.abs(height)
    };
    
    currentRectRaw.value = rect;
    
    // Debug drawing coordinates
    console.log('Drawing rectangle (screen coords):', rect);
  }  /**
   * Finishes the drawing operation
   * @returns {Object|null} The drawn rectangle or null if too small
   */  function finishDrawing() {
    console.log("finishDrawing called. Drawing state:", drawing.value, "Current rect:", currentRectRaw.value);
    
    if (!drawing.value || !currentRectRaw.value) {
      console.warn("No active drawing to finish");
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
    }      // STEP 1: Log our starting point - screen coordinates
    console.log('DRAWING COMPLETE - Screen space rectangle:', rect);
    
    // Check if zoomPan and its properties are defined to avoid errors
    const zoomLevel = zoomPan?.zoomLevel?.value ?? 1; // Default to 1 if undefined
    const panOffset = zoomPan?.panOffset?.value ?? { x: 0, y: 0 }; // Default to origin if undefined
    
    console.log(`Using zoom level: ${zoomLevel}, pan offset: (${panOffset.x}, ${panOffset.y})`);
    
    // STEP 2: Transform from screen space to image space
    // This is the critical step - we need to account for zoom and pan
    const imageSpaceCoords = transformCoordinates(
      rect, 
      zoomLevel, 
      panOffset, 
      'screenToImage'
    );
    
    // STEP 3: Log the transformed coordinates
    console.log('TRANSFORMED - Image space coordinates:', imageSpaceCoords);    // STEP 4: Create a properly formatted annotation with all required fields
    const newAnnotation = validateAnnotationData({
      _id: `new-annotation-${Date.now()}`, // Generate a unique ID with _id format
      label: '', // Empty label - will be updated when user selects a class
      x: Math.round(imageSpaceCoords.x),
      y: Math.round(imageSpaceCoords.y),
      width: Math.round(imageSpaceCoords.width),
      height: Math.round(imageSpaceCoords.height),
      confidence: 1.0, // For user-drawn annotations
      layerOrder: annotationStore.currentAnnotations?.length || 0, // Put on top
      color: '#00AAFF', // Default color
      imageId: imageId.value, // Add the image ID
      projectId: projectId.value // Add the project ID
    }, null);
    
    // STEP 5: Store the formatted annotation for creation
    pendingAnnotationCoordinates.value = newAnnotation;
    
    // STEP 6: Log the final annotation data
    console.log('FINAL ANNOTATION DATA:', newAnnotation);
    
    return newAnnotation;
  }
  
  /**
   * Cancels the current drawing operation
   */
  function cancelDrawing() {
    drawing.value = false;
    currentRectRaw.value = null;
    pendingAnnotationCoordinates.value = null;
  }
    /**
   * Gets the appropriate cursor style based on current tool and editing state
   * @param {Object} annotationEdit - The annotation edit composable
   * @returns {string} The cursor style to apply
   */
  function getCanvasCursor(annotationEdit) {
    if (!annotationEdit) return 'default';
    
    if (currentTool.value === 'pan') {
      return annotationEdit.isPanning?.value ? 'grabbing' : 'grab';
    } else if (currentTool.value === 'select') {
      if (annotationEdit.isDraggingAnnotation?.value) return 'grabbing';
      if (annotationEdit.isResizing?.value) return 'grabbing';
      if (annotationEdit.isEditing?.value) return 'move';
      if (annotationEdit.hoveredAnnotationId?.value) return 'pointer';
      return 'default';
    } else if (currentTool.value === 'rectangle') {
      return 'crosshair';
    }
    
    return 'default';
  }
  return {
    // State
    currentTool,
    drawing,
    startX,
    startY,
    currentX,
    currentY,
    startPos,
    currentRectRaw,
    pendingAnnotationCoordinates,
    canvasContext,
    
    // Functions
    setTool,
    startDrawing,
    updateDrawing,
    finishDrawing,
    cancelDrawing,
    getCanvasCursor,
    setCanvasContext,
    redrawCanvas
  };
}
