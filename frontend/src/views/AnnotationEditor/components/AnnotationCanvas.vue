<template>  <div class="canvas-container" ref="canvasContainerRef">
    <div v-if="!props.imageUrl" class="loading-placeholder">
      <p>Loading image...</p>
      <p class="load-error" v-if="loadError">{{ loadError }}</p>
    </div>
    <img 
      v-else
      ref="imageRef" 
      :src="props.imageUrl" 
      @load="onImageLoad" 
      @error="onImageError"
      :style="imageStyle" 
      alt="Image to annotate"
      crossorigin="anonymous"
    />
    <canvas 
      ref="canvasRef" 
      @mousedown="handleMouseDown" 
      @mousemove="handleMouseMove" 
      @mouseup="handleMouseUp" 
      @mouseleave="handleMouseLeave" 
      :style="canvasStyle"
    ></canvas>
  </div>
</template>

<script setup>
import { ref, computed, defineProps, defineEmits, onMounted, onUnmounted, watch, nextTick } from 'vue';
import '../styles/AnnotationCanvas.css';// Define props
const props = defineProps({
  // Canvas state dependencies
  imageUrl: {
    type: String,
    required: true,
    validator: (value) => {
      // Allow empty string during initial loading
      if (!value || value === '') return true;
      
      // Basic validation check - very permissive to handle a variety of valid URLs
      return true; // Let the image load event and error event handle validation instead
    }
  },
  // Composables
  zoomPan: {
    type: Object,
    required: true
  },
  annotationDraw: {
    type: Object,
    required: true
  },
  annotationEdit: {
    type: Object,
    required: true
  },
  canvasCoordinates: {
    type: Object,
    required: true
  }
});

// Define emits
const emit = defineEmits(['imageLoaded', 'imageLoadError', 'redraw-requested']);

// Refs
const canvasContainerRef = ref(null);
const canvasRef = ref(null);
const imageRef = ref(null);
const loadError = ref(''); // Error tracking

// Computed styles
const imageStyle = computed(() => {
  // Make sure we access the reactive value of zoomLevel
  const zoom = props.zoomPan?.zoomLevel?.value || 1;
  // Make sure we properly access the reactive panOffset values
  const panX = props.zoomPan?.panOffset?.value?.x || 0;
  const panY = props.zoomPan?.panOffset?.value?.y || 0;
  
  return {
    // Put translation first, then scaling - this order matters for proper transformation
    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
    transformOrigin: '0 0',
    display: 'block',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    // Add support for GPU acceleration
    backfaceVisibility: 'hidden',
    willChange: 'transform'
  };
});

const canvasStyle = computed(() => {
  // Make sure we access the reactive value of zoomLevel
  const zoom = props.zoomPan?.zoomLevel?.value || 1;
  // Make sure we properly access the reactive panOffset values
  const panX = props.zoomPan?.panOffset?.value?.x || 0;
  const panY = props.zoomPan?.panOffset?.value?.y || 0;
  
  const style = {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    // Match the same transform order as the image
    transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
    transformOrigin: '0 0',
    pointerEvents: 'all',
    // Add support for GPU acceleration
    backfaceVisibility: 'hidden',
    willChange: 'transform'
  };
    // Safely determine cursor style
  if (props.annotationDraw && typeof props.annotationDraw.getCanvasCursor === 'function') {
    style.cursor = props.annotationDraw.getCanvasCursor(props.annotationEdit);
  } else {
    // Fallback cursor based on tool
    const currentTool = props.annotationDraw?.currentTool?.value || 'default';
    style.cursor = currentTool === 'pan' ? 'grab' : 
                   currentTool === 'select' ? 'pointer' : 
                   currentTool === 'rectangle' ? 'crosshair' : 'default';
  }
  
  return style;
});

// Mouse event handlers
function handleMouseDown(event) {
  // Skip processing if no image is loaded
  if (!props.imageUrl || !canvasRef.value) {
    return;
  }
  try {
    // Ensure we access the reactive values with .value
    const zoomLevel = props.zoomPan?.zoomLevel?.value || 1;
    const panOffset = props.zoomPan?.panOffset?.value || { x: 0, y: 0 };
    
    const coords = props.canvasCoordinates.getCanvasCoordinates(event, canvasRef.value, zoomLevel, panOffset);
    
    // Handle the case when coords is undefined
    if (!coords) {
      console.warn('Failed to get canvas coordinates for mouse down event');
      return;
    }

    // Get current tool safely
    const currentTool = props.annotationDraw?.currentTool?.value || 'select';
    const isEditing = props.annotationEdit?.isEditing?.value || false;

    // Delegate to either drawing or editing based on tool and state
    if (currentTool === 'select' || isEditing) {
      if (typeof props.annotationEdit.handleMouseDown === 'function') {
        props.annotationEdit.handleMouseDown(coords);
      }
    } else if (currentTool === 'pan') {
      if (typeof props.zoomPan.startPan === 'function') {
        props.zoomPan.startPan(coords);
      }    } else if (currentTool === 'rectangle') {
      if (typeof props.annotationDraw.startDrawing === 'function') {
        console.log("Starting drawing at", coords.x, coords.y);
        props.annotationDraw.startDrawing(coords.x, coords.y);
        // Force immediate redraw to show starting point
        if (typeof props.annotationDraw.redrawCanvas === 'function') {
          props.annotationDraw.redrawCanvas();
        }
      }
    }
  } catch (error) {
    console.error('Error in handleMouseDown:', error);
  }
}

function handleMouseMove(event) {
  // Skip processing if no image is loaded or canvas not ready
  if (!props.imageUrl || !canvasRef.value) {
    return;
  }

  try {
    // Check if all required props exist before attempting to use them
    if (!props.canvasCoordinates || !props.zoomPan) {
      console.warn('Required props missing in handleMouseMove');
      return;
    }    // Safely access nested properties
    const zoomLevel = props.zoomPan?.zoomLevel?.value || 1;
    const panOffset = props.zoomPan?.panOffset?.value || { x: 0, y: 0 };
    
    // Log coordinates for debugging
    if (props.zoomPan?.isPanning?.value) {
      console.log(`Pan in progress - zoom: ${zoomLevel}, offset: (${panOffset.x}, ${panOffset.y})`);
    }

    const coords = props.canvasCoordinates.getCanvasCoordinates(event, canvasRef.value, zoomLevel, panOffset);
    
    // Handle the case when coords is undefined
    if (!coords) {
      console.warn('Failed to get canvas coordinates for mouse move event');
      return;
    }

    // Safely check properties before using them - guard against undefined or null values
    const isEditing = props.annotationEdit?.isEditing?.value === true;
    const isResizing = props.annotationEdit?.isResizing?.value === true; 
    const isPanning = props.zoomPan?.isPanning?.value === true;
    const isDrawing = props.annotationDraw?.drawing?.value === true;

    // Delegate to the appropriate handler based on current state
    if (isEditing || isResizing) {
      if (typeof props.annotationEdit?.handleMouseMove === 'function') {
        props.annotationEdit.handleMouseMove(coords);
      }
    } else if (isPanning) {
      if (typeof props.zoomPan?.updatePan === 'function') {
        props.zoomPan.updatePan(coords);
      }    } else if (isDrawing) {
      if (typeof props.annotationDraw?.updateDrawing === 'function') {
        console.log("Updating drawing at", coords.x, coords.y);
        props.annotationDraw.updateDrawing(coords.x, coords.y);
        // Request canvas redraw to show the rectangle being drawn
        emit('redraw-requested');
      }
    }else {
      // Hover behavior when not actively drawing/editing/panning
      if (typeof props.annotationEdit?.checkHoverState === 'function') {
        props.annotationEdit.checkHoverState(coords);
      }
    }
  } catch (error) {
    console.error('Error in handleMouseMove:', error);
  }
}

function handleMouseUp(event) {
  // Skip processing if no image is loaded
  if (!props.imageUrl || !canvasRef.value) {
    return;
  }
  try {
    // Ensure we access the reactive values with .value
    const zoomLevel = props.zoomPan?.zoomLevel?.value || 1;
    const panOffset = props.zoomPan?.panOffset?.value || { x: 0, y: 0 };
    
    const coords = props.canvasCoordinates.getCanvasCoordinates(event, canvasRef.value, zoomLevel, panOffset);
    
    // Handle the case when coords is undefined
    if (!coords) {
      console.warn('Failed to get canvas coordinates for mouse up event');
      return;
    }

    // Safely check properties before using them
    const isEditing = props.annotationEdit?.isEditing?.value || false;
    const isResizing = props.annotationEdit?.isResizing?.value || false;
    const isPanning = props.zoomPan?.isPanning?.value || false;
    const isDrawing = props.annotationDraw?.drawing?.value || false;

    // Delegate to the appropriate handler based on current state
    if (isEditing || isResizing) {
      if (typeof props.annotationEdit.handleMouseUp === 'function') {
        props.annotationEdit.handleMouseUp(coords);
      }
    } else if (isPanning) {
      if (typeof props.zoomPan.endPan === 'function') {
        props.zoomPan.endPan();
      }    } else if (isDrawing) {
      if (typeof props.annotationDraw.finishDrawing === 'function') {
        console.log("Finishing drawing, was drawing:", isDrawing);
        try {
          const newAnnotation = props.annotationDraw.finishDrawing();
          if (newAnnotation) {
            console.log("Created new annotation:", newAnnotation);
            // Emit event to allow parent to know about the new annotation
            emit('annotation-created', newAnnotation);
          }
        } catch (drawingError) {
          console.error("Error finishing drawing:", drawingError);
        }
      } else {
        console.warn("finishDrawing function not available on annotationDraw");
      }
    }
  } catch (error) {
    console.error('Error in handleMouseUp:', error);
  }
}

function handleMouseLeave() {
  // Skip processing if no image is loaded
  if (!props.imageUrl) {
    return;
  }

  try {
    // Safely check properties before using them
    const isEditing = props.annotationEdit?.isEditing?.value || false;
    const isPanning = props.zoomPan?.isPanning?.value || false;
    const isDrawing = props.annotationDraw?.drawing?.value || false;

    // Handle mouse leaving the canvas
    if (isEditing) {
      if (typeof props.annotationEdit.cancelEditing === 'function') {
        props.annotationEdit.cancelEditing();
      }
    } else if (isPanning) {
      if (typeof props.zoomPan.endPan === 'function') {
        props.zoomPan.endPan();
      }
    } else if (isDrawing) {
      if (typeof props.annotationDraw.cancelDrawing === 'function') {
        props.annotationDraw.cancelDrawing();
      }
    }
  } catch (error) {
    console.error('Error in handleMouseLeave:', error);
  }
}

// Image loading
function onImageLoad() {
  try {
    console.log('Image loaded successfully:', imageRef.value?.src);
    if (!imageRef.value) {
      console.error('Image reference is null in onImageLoad');
      emit('imageLoadError', { 
        error: new Error('Image reference is null'),
        url: props.imageUrl
      });
      return;
    }

    // Configure canvas size to match image
    const image = imageRef.value;
    const canvas = canvasRef.value;
    const container = canvasContainerRef.value;

    if (!canvas || !container) {
      console.error('Canvas or container references are null in onImageLoad');
      emit('imageLoadError', { 
        error: new Error('Canvas or container references are null'),
        url: props.imageUrl
      });
      return;
    }

    console.log('Canvas dimensions:', container.clientWidth, container.clientHeight);
    console.log('Image natural dimensions:', image.naturalWidth, image.naturalHeight);
  
  // Check for valid image dimensions
  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    console.error('Image has zero dimensions:', image.naturalWidth, 'x', image.naturalHeight);
    emit('imageLoadError', { 
      error: new Error('Image has zero dimensions'),
      url: props.imageUrl
    });
    return;
  }
  
  // Set natural dimensions
  props.canvasCoordinates.setNaturalDimensions({
    width: image.naturalWidth,
    height: image.naturalHeight
  });  // Configure canvas dimensions based on container size
  const containerWidth = container.clientWidth || 800; // Fallback width
  const containerHeight = container.clientHeight || 600; // Fallback height
  
  console.log(`Setting canvas size to container dimensions: ${containerWidth}x${containerHeight}`);
  canvas.width = containerWidth;
  canvas.height = containerHeight;

  // Reset zoom and pan when a new image is loaded
  if (props.zoomPan && typeof props.zoomPan.resetZoom === 'function') {
    props.zoomPan.resetZoom();
    console.log('Zoom and pan reset');
  } else {
    console.warn('zoomPan.resetZoom is not available');
  }
  // Update canvas context in all services
  try {
    // Force a reflow before getting context
    void canvas.offsetHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get canvas context');
      emit('imageLoadError', { 
        error: new Error('Failed to get canvas context'),
        url: props.imageUrl
      });
      return;
    }
    
    console.log('Canvas context obtained successfully');
    
    // Use conditional checks to see if these methods exist before calling them
    if (typeof props.annotationDraw?.setCanvasContext === 'function') {
      props.annotationDraw.setCanvasContext(ctx);
      console.log('Canvas context set in annotationDraw service');
    } else {
      console.warn('annotationDraw.setCanvasContext is not available');
    }
    
    if (typeof props.annotationEdit?.setCanvasContext === 'function') {
      props.annotationEdit.setCanvasContext(ctx);
      console.log('Canvas context set in annotationEdit service');
    } else {
      console.warn('annotationEdit.setCanvasContext is not available');
    }
    
    // Ensure the canvas properties are properly set before redrawing
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    
    // Make sure the zoom and pan are properly initialized
    if (props.zoomPan && typeof props.zoomPan.resetZoom === 'function') {
      props.zoomPan.resetZoom();
      console.log('Zoom and pan reset before initial draw');
    }
    
    // Trigger a redraw using requestAnimationFrame for better visual updates
    requestAnimationFrame(() => {
      console.log('Triggering redraw after context initialization');
      emit('redraw-requested');
    });
  } catch (error) {
    console.error('Error setting up canvas context:', error);
    emit('imageLoadError', { 
      error: new Error(`Failed to set up canvas context: ${error.message}`),
      url: props.imageUrl
    });
    return;
  }
  // Notify parent that image is loaded
  emit('imageLoaded', {
    imageElement: image,
    canvasElement: canvas,
    containerElement: container
  });
  } catch (error) {
    console.error('Error in onImageLoad:', error);
    emit('imageLoadError', { 
      error: new Error(`Error processing image: ${error.message}`),
      url: props.imageUrl
    });
  }
}

function onImageError(event) {
  console.error('Image failed to load:', event);
  console.error('Image URL that failed:', imageRef.value?.src);
  
  // Set the local error message for display
  loadError.value = `Failed to load image: ${imageRef.value?.src || 'Unknown URL'}`;
  
  // Notify parent component about the error with more details
  emit('imageLoadError', {
    event,
    url: imageRef.value?.src,
    target: imageRef.value,
    error: new Error(`Failed to load image: ${imageRef.value?.src}`)
  });
}

// Lifecycle hooks
onMounted(() => {
  console.log('AnnotationCanvas mounted');
  console.log('Current props:', props);
  console.log('Image URL prop:', props.imageUrl);
  
  // Make sure we only try to initialize if we have an image URL
  if (!props.imageUrl) {
    console.log('No image URL provided on mount, waiting for image URL to be set');
    return;
  }

  // Need to use nextTick to ensure the DOM has updated with the image
  nextTick(() => {
    if (imageRef.value) {
      // Initialize canvas on mount if image is already loaded
      if (imageRef.value.complete && imageRef.value.naturalWidth > 0) {
        console.log('Image already loaded on mount');
        onImageLoad();
      } else {
        console.log('Image not yet loaded on mount, waiting for load event');
        // Sometimes the load event might have fired before we added the listener
        // So we'll check again after a small delay
        setTimeout(() => {
          if (imageRef.value && imageRef.value.complete && imageRef.value.naturalWidth > 0) {
            console.log('Image loaded during delay, initializing now');
            onImageLoad();
          }
        }, 100);
      }
    } else {
      console.warn('Image reference not available on mount');
    }
  });

  // Add window resize event listener
  window.addEventListener('resize', onResize);
});

onUnmounted(() => {
  // Remove event listeners on unmount
  window.removeEventListener('resize', onResize);
});

// Window resize handler
function onResize() {
  try {
    if (canvasRef.value && canvasContainerRef.value) {
      // Set default fallback dimensions if client dimensions are not available
      const containerWidth = canvasContainerRef.value.clientWidth || 800;
      const containerHeight = canvasContainerRef.value.clientHeight || 600;
      
      console.log('Resizing canvas to:', containerWidth, 'x', containerHeight);
      
      canvasRef.value.width = containerWidth;
      canvasRef.value.height = containerHeight;
      
      // Request redraw when window is resized with a slight delay to ensure all resizing is complete
      setTimeout(() => {
        console.log('Triggering redraw after resize');
        emit('redraw-requested');
      }, 100);
    } else {
      console.warn('Canvas or container references not available during resize');
    }
  } catch (error) {
    console.error('Error during canvas resize:', error);
  }
}

// Expose refs and methods to parent component
defineExpose({
  canvasRef,
  imageRef,
  canvasContainerRef,
  onImageLoad,
  redrawCanvas: () => {
    // Call parent's redraw function instead of annotationDraw's directly
    // This avoids the circular dependency that was causing stack overflow
    emit('redraw-requested');
  }
});
</script>

<style>
.loading-placeholder {
  background: #f0f0f0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  font-size: 18px;
  color: #555;
  padding: 20px;
  box-sizing: border-box;
  text-align: center;
}

.load-error {
  color: #d03050;
  margin-top: 10px;
  font-size: 14px;
  max-width: 80%;
}
</style>
