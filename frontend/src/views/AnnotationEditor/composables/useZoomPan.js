import { ref } from 'vue';
import { useToast } from 'vue-toastification';
import { testCoordinateTransform } from '../../../utils/annotationUtils';

/**
 * Composable for handling zoom and pan functionality
 * @param {Function} redrawCallback - Function to call when zoom/pan changes require redraw
 */
export function useZoomPan(canvasCoordinates, redrawCallback) {
  const toast = useToast();
  
  // Zoom state
  const zoomLevel = ref(1);
  const MIN_ZOOM = 0.2;
  const MAX_ZOOM = 5;
  const ZOOM_STEP = 0.1;
  
  // Panning state
  const isPanning = ref(false);
  const panOffset = ref({ x: 0, y: 0 });
  const startPanPoint = ref({ x: 0, y: 0 });
  const lastClientPosition = ref({ x: 0, y: 0 });  /**
   * Zooms in the view
   */
  function zoomIn() {
    if (zoomLevel.value < MAX_ZOOM) {
      // Explicitly ensure reactivity with .value
      const newZoom = Math.min(zoomLevel.value + ZOOM_STEP, MAX_ZOOM);
      zoomLevel.value = newZoom;
      console.log(`Zoomed in to ${zoomLevel.value}x`);
      
      // Force repaint to ensure zoom is applied visually
      forceRepaint();
      
      // Make sure to call redraw callback after zoom change to update visuals
      requestAnimationFrame(() => {
        if (redrawCallback) redrawCallback();
      });
    }
  }
  
  /**
   * Zooms out the view
   */
  function zoomOut() {
    if (zoomLevel.value > MIN_ZOOM) {
      // Explicitly ensure reactivity with .value
      const newZoom = Math.max(zoomLevel.value - ZOOM_STEP, MIN_ZOOM);
      zoomLevel.value = newZoom;
      console.log(`Zoomed out to ${zoomLevel.value}x`);
      
      // Force repaint to ensure zoom is applied visually
      forceRepaint();
      
      // Make sure to call redraw callback after zoom change to update visuals
      requestAnimationFrame(() => {
        if (redrawCallback) redrawCallback();
      });
    }
  }
  
  /**
   * Force the browser to repaint
   */
  function forceRepaint() {
    // This will force a reflow/repaint
    const body = document.body;
    const oldDisplayValue = body.style.display;
    body.style.display = 'none';
    void body.offsetHeight; // Trigger a reflow
    body.style.display = oldDisplayValue;
  }  /**
   * Resets zoom and view offset
   */
  function resetZoom() {
    // Explicitly set values to ensure reactivity
    zoomLevel.value = 1;
    panOffset.value = { x: 0, y: 0 };
    console.log('Zoom reset to 1x');
    
    // Force repaint to ensure zoom reset is applied visually
    forceRepaint();
    
    // Make sure to call redraw callback after zoom reset
    requestAnimationFrame(() => {
      if (redrawCallback) redrawCallback();
    });
  }
    /**
   * Starts a panning operation
   * @param {Object} coords - The coordinates where panning started
   */
  function startPan(coords) {
    if (!coords) {
      console.warn('Invalid coordinates for starting pan');
      return;
    }
    
    isPanning.value = true;
    
    // Ensure we're copying values, not references
    startPanPoint.value = { 
      x: panOffset.value?.x || 0,
      y: panOffset.value?.y || 0
    };
    
    // Store the client position
    lastClientPosition.value = {
      x: coords.x,
      y: coords.y
    };
    
    console.log(`Starting pan at coords (${coords.x}, ${coords.y}), current offset: (${startPanPoint.value.x}, ${startPanPoint.value.y})`);
  }  /**
   * Updates the panning operation
   * @param {Object} coords - The current coordinates
   */
  function updatePan(coords) {
    if (!isPanning.value) return;
    
    if (!coords || !lastClientPosition.value) {
      console.warn('Invalid coordinates for panning');
      return;
    }
    
    // Calculate the pan delta
    const deltaX = coords.x - lastClientPosition.value.x;
    const deltaY = coords.y - lastClientPosition.value.y;
    
    // Create new object to ensure reactivity
    const newPanOffset = {
      x: startPanPoint.value.x + deltaX,
      y: startPanPoint.value.y + deltaY
    };
    
    console.log(`Panning: delta(${deltaX}, ${deltaY}), new offset(${newPanOffset.x}, ${newPanOffset.y})`);
    
    // Update view offset with new object
    panOffset.value = newPanOffset;
    
    // Force repaint to ensure pan is applied visually
    forceRepaint();
    
    // Use requestAnimationFrame for better performance and visual updates
    requestAnimationFrame(() => {
      if (redrawCallback) redrawCallback();
    });
  }
  /**
   * Ends the panning operation
   */
  function endPan() {
    if (isPanning.value) {
      console.log(`End panning. Final offset: (${panOffset.value?.x || 0}, ${panOffset.value?.y || 0})`);
      isPanning.value = false;
      
      // Force repaint to ensure final pan position is applied visually
      forceRepaint();
      
      // Use requestAnimationFrame for better performance and visual updates
      requestAnimationFrame(() => {
        if (redrawCallback) redrawCallback();
      });
    }
  }
  
  /**
   * Tests zooming with annotations
   * @param {number} annotationCount - The number of annotations to test with
   */  function runAnnotationZoomTest(annotationCount = 0) {
    if (annotationCount === 0) {
      toast.error('No annotations to test with');
      return;
    }
    
    console.log(`Starting zoom test with ${annotationCount} annotations...`);
    
    const testSteps = [
      { zoom: 1.5, message: 'Testing zoom at 1.5x' },
      { zoom: 2.0, message: 'Testing zoom at 2.0x' },
      { zoom: 0.5, message: 'Testing zoom at 0.5x' },
      { zoom: 1.0, message: 'Returning to normal zoom' }
    ];
    
    let stepIndex = 0;
    
    const runStep = () => {
      if (stepIndex >= testSteps.length) {
        toast.success('Zoom test completed');
        return;
      }
      
      const step = testSteps[stepIndex];
      console.log(step.message);
      
      // Explicitly assign to ensure reactivity
      zoomLevel.value = step.zoom;
      
      toast.info(step.message);
      
      // Move to next step after a short delay
      setTimeout(() => {
        if (redrawCallback) {
          console.log(`Redrawing at zoom level ${zoomLevel.value}x`);
          redrawCallback();
            // Force document repaint to ensure zoom changes are visible
          document.body.offsetHeight;
          
          // Test coordinate transformation at this zoom level with a sample annotation
          try {
            console.log(`Testing coordinate transformation at zoom ${zoomLevel.value}x`);
            const sampleCoords = { x: 100, y: 100, width: 200, height: 150 };
            testCoordinateTransform(sampleCoords, zoomLevel.value, panOffset.value);
          } catch (error) {
            console.error('Error testing coordinate transformation:', error);
          }
        }
        
        stepIndex++;
        setTimeout(runStep, 1000);
      }, 300); // Slightly longer delay to ensure DOM updates
    };
    
    runStep();
  }
  
  return {
    // Constants
    MIN_ZOOM,
    MAX_ZOOM,
    ZOOM_STEP,
    
    // State
    zoomLevel,
    panOffset,
    isPanning,
    
    // Functions
    zoomIn,
    zoomOut,
    resetZoom,
    startPan,
    updatePan,
    endPan,
    runAnnotationZoomTest
  };
}
