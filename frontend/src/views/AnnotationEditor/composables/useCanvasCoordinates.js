import { ref, computed } from 'vue';

/**
 * Composable for handling coordinate transformations
 */
export function useCanvasCoordinates() {
  // Natural dimensions of the image
  const naturalDimensions = ref({ width: 0, height: 0 });

  /**
   * Set the natural dimensions of the image
   * @param {Object} dimensions - The natural dimensions object
   */
  function setNaturalDimensions(dimensions) {
    naturalDimensions.value = dimensions;
    console.log('Natural dimensions set:', dimensions);
  }

  /**
   * Converts natural (original image) coordinates to screen coordinates with zoom and offset
   * @param {number} x - X coordinate in natural space
   * @param {number} y - Y coordinate in natural space
   * @param {number} width - Width in natural space
   * @param {number} height - Height in natural space
   * @param {number} zoomLevel - Current zoom level
   * @param {Object} panOffset - Current pan offset {x, y}
   * @returns {Object} The transformed coordinates
   */
  function naturalToScreen(x, y, width, height, zoomLevel, panOffset) {
    return {
      x: x * zoomLevel + panOffset.x,
      y: y * zoomLevel + panOffset.y,
      width: width * zoomLevel,
      height: height * zoomLevel
    };
  }
  
  /**
   * Converts screen coordinates to natural (original image) coordinates
   * @param {number} x - X coordinate in screen space
   * @param {number} y - Y coordinate in screen space
   * @param {number} width - Width in screen space
   * @param {number} height - Height in screen space
   * @param {number} zoomLevel - Current zoom level
   * @param {Object} panOffset - Current pan offset {x, y}
   * @returns {Object} The transformed coordinates
   */
  function screenToNatural(x, y, width, height, zoomLevel, panOffset) {
    return {
      x: (x - panOffset.x) / zoomLevel,
      y: (y - panOffset.y) / zoomLevel,
      width: width / zoomLevel,
      height: height / zoomLevel
    };
  }
  /**
   * Get canvas coordinates from a mouse event
   * @param {MouseEvent} event - The mouse event
   * @param {HTMLElement} canvasElement - The canvas element
   * @param {number} zoomLevel - Current zoom level
   * @param {Object} panOffset - Current pan offset {x, y}
   * @returns {Object} The canvas coordinates
   */
  function getCanvasCoordinates(event, canvasElement, zoomLevel, panOffset) {
    if (!canvasElement) {
      console.warn('Canvas element is undefined in getCanvasCoordinates');
      return { x: 0, y: 0 };
    }
    
    try {
      const canvasRect = canvasElement.getBoundingClientRect();
      
      // Ensure we have valid values for zoom and pan
      const zoom = zoomLevel || 1;
      const panX = panOffset?.x || 0;
      const panY = panOffset?.y || 0;
      
      // Calculate the position relative to the canvas element
      const canvasX = event.clientX - canvasRect.left;
      const canvasY = event.clientY - canvasRect.top;
      
      // Account for pan and zoom
      // When we apply transform: translate(panX, panY) scale(zoom)
      // we need to subtract the pan offset, then divide by zoom
      const x = (canvasX - panX) / zoom;
      const y = (canvasY - panY) / zoom;
      
      console.log(`Raw coords: (${canvasX}, ${canvasY}), Adjusted: (${x}, ${y}), Zoom: ${zoom}, Pan: (${panX}, ${panY})`);
      
      return { x, y };
    } catch (error) {
      console.error('Error calculating canvas coordinates:', error);
      return { x: 0, y: 0 };
    }
  }
    /**
   * Converts client coordinates to canvas coordinates
   * @param {number} clientX - The client X coordinate
   * @param {number} clientY - The client Y coordinate
   * @param {Object} canvasElement - The canvas element to use for calculations
   * @param {number} zoomLevel - Current zoom level
   * @param {Object} panOffset - Current pan offset {x, y}
   * @returns {Object} The transformed coordinates
   */
  function clientToCanvas(clientX, clientY, canvasElement, zoomLevel, panOffset) {
    if (!canvasElement) {
      console.warn('Canvas element is undefined in clientToCanvas');
      return { x: 0, y: 0 };
    }
    
    const canvasRect = canvasElement.getBoundingClientRect();
    
    // Calculate the position relative to the canvas element with zoom and pan
    // When we apply transform: translate(panX, panY) scale(zoom)
    const x = (clientX - canvasRect.left - panOffset.x) / zoomLevel;
    const y = (clientY - canvasRect.top - panOffset.y) / zoomLevel;
    
    return { x, y };
  }
    /**
   * Generate styles for elements that need to be zoomed and panned
   * @param {Object} dimensions - The dimensions of the image
   * @param {boolean} isCanvas - Whether this is for the canvas (has different cursor)
   * @param {string} currentTool - The current selected tool
   * @param {boolean} isPanning - Whether the canvas is being panned
   * @param {boolean} isDraggingAnnotation - Whether an annotation is being dragged
   * @param {boolean} isResizing - Whether an annotation is being resized
   * @param {number} zoomLevel - Current zoom level
   * @param {Object} panOffset - Current pan offset {x, y}
   * @returns {Object} The computed style object
   */
  function getZoomPanStyle(dimensions, isCanvas = false, currentTool = 'rectangle', isPanning = false, isDraggingAnnotation = false, isResizing = false, zoomLevel, panOffset) {
    const style = {
      position: 'absolute',
      top: '0',
      left: '0',
      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
      transformOrigin: '0 0',
      willChange: 'transform',
      backfaceVisibility: 'hidden'
    };
    
    if (isCanvas) {
      style.cursor = currentTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 
                    currentTool === 'select' ? (isDraggingAnnotation ? 'grabbing' : 'pointer') : 
                    isResizing ? 'grabbing' : 'crosshair';
      style.zIndex = 10;
      style.pointerEvents = 'all';
    } else {
      // For the image
      style.userSelect = 'none';
      style.WebkitUserSelect = 'none';
      style.display = 'block';
    }
    
    return style;
  }
  
  return {
    naturalDimensions,
    setNaturalDimensions,
    naturalToScreen,
    screenToNatural,
    getCanvasCoordinates,
    clientToCanvas,
    getZoomPanStyle
  };
}
