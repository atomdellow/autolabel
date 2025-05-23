import { ref } from 'vue';
import { useToast } from 'vue-toastification';

/**
 * Composable for annotation editing functionality
 * @param {Object} annotationStore - The annotation store
 * @param {Object} canvasCoordinates - The canvas coordinates composable
 * @param {Object} zoomPan - The zoom and pan composable
 * @param {Function} redrawCallback - Function to trigger canvas redraw
 */
export function useAnnotationEdit(annotationStore, canvasCoordinates, zoomPan, redrawCallback) {
  const toast = useToast();
  
  // Canvas context
  const canvasContext = ref(null);
  
  // Editing state
  const editingAnnotationId = ref(null);
  const isResizing = ref(false);
  const activeResizeHandle = ref(null); // e.g., 'topLeft', 'bottomRight', 'top', 'left', etc.
  const originalAnnotationBeforeEdit = ref(null); // Stores the annotation state when editing began
  const isDraggingAnnotation = ref(false);
  const dragStartPos = ref({ x: 0, y: 0 });
  const dragStartRect = ref(null);
  const resizeStartPos = ref({ x: 0, y: 0 }); // Mouse position when resize starts
  const originalResizingAnnotation = ref(null); // Annotation state at the start of a specific resize drag
    /**
   * Sets the canvas context
   * @param {CanvasRenderingContext2D} ctx - The canvas 2D context
   */
  function setCanvasContext(ctx) {
    canvasContext.value = ctx;
    console.log('Canvas context set in annotationEdit');
  }

  /**
   * Starts editing an annotation
   * @param {Object} annotation - The annotation to edit
   * @param {Object} containerRef - Reference to the container element
   */
  function startEditingAnnotation(annotation, containerRef = null) {
    if (!annotation) return;
    
    // Store a copy of the annotation before editing begins
    originalAnnotationBeforeEdit.value = { ...annotation };
    
    // Set the editing annotation ID
    editingAnnotationId.value = annotation._id;
    
    // If we have a container reference, ensure the annotation is visible on screen
    if (containerRef) {
      // Calculate the screen position of the annotation
      const rect = {
        x: annotation.x * zoomLevel.value + viewOffset.value.x,
        y: annotation.y * zoomLevel.value + viewOffset.value.y,
        width: annotation.width * zoomLevel.value,
        height: annotation.height * zoomLevel.value
      };
      
      // Check if annotation is in the viewport
      const containerWidth = containerRef.offsetWidth || 0;
      const containerHeight = containerRef.offsetHeight || 0;
      
      const isVisible = 
        rect.x >= 0 && 
        rect.y >= 0 && 
        rect.x + rect.width <= containerWidth && 
        rect.y + rect.height <= containerHeight;
      
      if (!isVisible) {
        // Center the annotation in the viewport
        const centerX = rect.x + (rect.width / 2);
        const centerY = rect.y + (rect.height / 2);
        
        viewOffset.value.x = (containerWidth / 2) - centerX;
        viewOffset.value.y = (containerHeight / 2) - centerY;
      }
    }
    
    toast.info(`Editing ${annotation.label} annotation. Drag to move, use handles to resize.`);
    redrawCanvas();
  }
  
  /**
   * Finishes editing an annotation
   */
  function finishEditingAnnotation() {
    if (editingAnnotationId.value) {
      // Clear the editing state
      editingAnnotationId.value = null;
      originalAnnotationBeforeEdit.value = null;
      
      // Redraw to remove editing UI
      redrawCanvas();
    }
  }
  
  /**
   * Starts dragging an annotation
   * @param {string} annotationId - The ID of the annotation to drag
   * @param {number} x - The starting X position
   * @param {number} y - The starting Y position
   * @param {Object} annotation - The annotation object
   */
  function startDraggingAnnotation(annotationId, x, y, annotation) {
    isDraggingAnnotation.value = true;
    editingAnnotationId.value = annotationId;
    dragStartPos.value = { x, y };
    dragStartRect.value = {
      x: annotation.x,
      y: annotation.y,
      width: annotation.width,
      height: annotation.height
    };
  }
  
  /**
   * Updates the position of a dragged annotation
   * @param {number} x - The current X position
   * @param {number} y - The current Y position
   * @param {Object} annotation - The annotation being dragged
   */
  function updateDraggedAnnotation(x, y, annotation) {
    if (!isDraggingAnnotation.value || !dragStartRect.value) return;
    
    // Calculate the drag delta
    const deltaX = x - dragStartPos.value.x;
    const deltaY = y - dragStartPos.value.y;
    
    // Update the annotation position
    annotation.x = dragStartRect.value.x + deltaX;
    annotation.y = dragStartRect.value.y + deltaY;
    
    // Redraw
    redrawCanvas();
  }
  
  /**
   * Starts resizing an annotation
   * @param {string} handle - The resize handle being used
   * @param {number} x - The starting X position
   * @param {number} y - The starting Y position
   * @param {Object} annotation - The annotation to resize
   */
  function startResizingAnnotation(handle, x, y, annotation) {
    isResizing.value = true;
    activeResizeHandle.value = handle;
    resizeStartPos.value = { x, y };
    originalResizingAnnotation.value = { ...annotation };
  }
  
  /**
   * Updates the size/position of a resized annotation
   * @param {number} x - The current X position
   * @param {number} y - The current Y position
   * @param {Object} annotation - The annotation being resized
   */
  function updateResizedAnnotation(x, y, annotation) {
    if (!isResizing.value || !originalResizingAnnotation.value) return;
    
    const deltaX = x - resizeStartPos.value.x;
    const deltaY = y - resizeStartPos.value.y;
    
    // Apply resize based on which handle is active
    switch (activeResizeHandle.value) {
      case 'topLeft':
        annotation.x = originalResizingAnnotation.value.x + deltaX;
        annotation.y = originalResizingAnnotation.value.y + deltaY;
        annotation.width = originalResizingAnnotation.value.width - deltaX;
        annotation.height = originalResizingAnnotation.value.height - deltaY;
        break;
      case 'topRight':
        annotation.y = originalResizingAnnotation.value.y + deltaY;
        annotation.width = originalResizingAnnotation.value.width + deltaX;
        annotation.height = originalResizingAnnotation.value.height - deltaY;
        break;
      case 'bottomLeft':
        annotation.x = originalResizingAnnotation.value.x + deltaX;
        annotation.width = originalResizingAnnotation.value.width - deltaX;
        annotation.height = originalResizingAnnotation.value.height + deltaY;
        break;
      case 'bottomRight':
        annotation.width = originalResizingAnnotation.value.width + deltaX;
        annotation.height = originalResizingAnnotation.value.height + deltaY;
        break;
      case 'top':
        annotation.y = originalResizingAnnotation.value.y + deltaY;
        annotation.height = originalResizingAnnotation.value.height - deltaY;
        break;
      case 'right':
        annotation.width = originalResizingAnnotation.value.width + deltaX;
        break;
      case 'bottom':
        annotation.height = originalResizingAnnotation.value.height + deltaY;
        break;
      case 'left':
        annotation.x = originalResizingAnnotation.value.x + deltaX;
        annotation.width = originalResizingAnnotation.value.width - deltaX;
        break;
    }
    
    // Ensure width and height are positive
    if (annotation.width < 0) {
      annotation.x = annotation.x + annotation.width;
      annotation.width = Math.abs(annotation.width);
    }
    
    if (annotation.height < 0) {
      annotation.y = annotation.y + annotation.height;
      annotation.height = Math.abs(annotation.height);
    }
    
    // Redraw
    redrawCanvas();
  }
  
  /**
   * Finds the resize handle at the given position
   * @param {Object} annotation - The annotation to check
   * @param {number} x - The X position to check
   * @param {number} y - The Y position to check
   * @returns {string|null} The name of the handle or null if none found
   */
  function findResizeHandleAtPosition(annotation, x, y) {
    if (!annotation) return null;
    
    const handleSize = 10; // Size of the resize handle
    const halfHandleSize = handleSize / 2;
    
    // Check each of the handles
    // Top-left
    if (Math.abs(x - annotation.x) <= halfHandleSize && 
        Math.abs(y - annotation.y) <= halfHandleSize) {
      return 'topLeft';
    }
    
    // Top-right
    if (Math.abs(x - (annotation.x + annotation.width)) <= halfHandleSize && 
        Math.abs(y - annotation.y) <= halfHandleSize) {
      return 'topRight';
    }
    
    // Bottom-left
    if (Math.abs(x - annotation.x) <= halfHandleSize && 
        Math.abs(y - (annotation.y + annotation.height)) <= halfHandleSize) {
      return 'bottomLeft';
    }
    
    // Bottom-right
    if (Math.abs(x - (annotation.x + annotation.width)) <= halfHandleSize && 
        Math.abs(y - (annotation.y + annotation.height)) <= halfHandleSize) {
      return 'bottomRight';
    }
    
    // Top edge
    if (Math.abs(y - annotation.y) <= halfHandleSize && 
        x > annotation.x + halfHandleSize && 
        x < annotation.x + annotation.width - halfHandleSize) {
      return 'top';
    }
    
    // Right edge
    if (Math.abs(x - (annotation.x + annotation.width)) <= halfHandleSize && 
        y > annotation.y + halfHandleSize && 
        y < annotation.y + annotation.height - halfHandleSize) {
      return 'right';
    }
    
    // Bottom edge
    if (Math.abs(y - (annotation.y + annotation.height)) <= halfHandleSize && 
        x > annotation.x + halfHandleSize && 
        x < annotation.x + annotation.width - halfHandleSize) {
      return 'bottom';
    }
    
    // Left edge
    if (Math.abs(x - annotation.x) <= halfHandleSize && 
        y > annotation.y + halfHandleSize && 
        y < annotation.y + annotation.height - halfHandleSize) {
      return 'left';
    }
    
    return null;
  }
    return {
    // State
    editingAnnotationId,
    isResizing,
    activeResizeHandle,
    isDraggingAnnotation,
    dragStartPos,
    dragStartRect,
    originalAnnotationBeforeEdit,
    resizeStartPos,
    originalResizingAnnotation,
    canvasContext,
    
    // Functions
    startEditingAnnotation,
    finishEditingAnnotation,
    startDraggingAnnotation,
    updateDraggedAnnotation,
    startResizingAnnotation,
    updateResizedAnnotation,
    findResizeHandleAtPosition,
    setCanvasContext
  };
}
