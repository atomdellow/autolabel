import { ref } from 'vue';

/**
 * Composable for handling annotation drawing functionality
 * @param {Object} annotationStore - The annotation store for saving annotations
 * @param {Object} canvasCoordinates - The canvas coordinates composable
 * @param {Object} zoomPan - The zoom pan composable
 * @param {Function} redrawCallback - Function to call when redraw is needed
 */
export function useAnnotationDraw(annotationStore, canvasCoordinates, zoomPan, redrawCallback) {
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
        // Draw the current rectangle being created
        canvasContext.value.strokeStyle = '#00AAFF';
        canvasContext.value.lineWidth = 2;
        canvasContext.value.strokeRect(
          currentRectRaw.value.x,
          currentRectRaw.value.y,
          currentRectRaw.value.width,
          currentRectRaw.value.height
        );
        
        // Log successful drawing
        console.log('Drew rectangle:', currentRectRaw.value);
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
    currentRectRaw.value = {
      x: width < 0 ? x : startX.value,
      y: height < 0 ? y : startY.value,
      width: Math.abs(width),
      height: Math.abs(height)
    };
  }
  
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
      return null;
    }
    
    // Set the pending coordinates for annotation creation
    pendingAnnotationCoordinates.value = rect;
    return rect;
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
