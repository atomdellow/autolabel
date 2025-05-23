// This script patches the file: c:\Users\adamd\Projects\autolabel\frontend\src\views\AnnotationEditorView.vue
// Apply these changes to fix the zoom functionality issue

// Replace the updateZoomOffset function with this improved version:
function updateZoomOffset() {
  if (!canvasContainerRef.value) return;
  
  // Get the container dimensions
  const containerRect = canvasContainerRef.value.getBoundingClientRect();
  
  // Calculate the offset needed to keep the center point fixed during zoom
  const imageWidth = imageDimensions.value.width * zoomLevel.value;
  const imageHeight = imageDimensions.value.height * zoomLevel.value;
  
  // Center the image in the container - this is key to preventing the upper-right shift
  // This ensures the image is centered regardless of zoom level
  const newOffsetX = Math.max((containerRect.width - imageWidth) / 2, 0);
  const newOffsetY = Math.max((containerRect.height - imageHeight) / 2, 0);
  
  // Update the view offset smoothly to maintain relative position
  viewOffset.value = { 
    x: newOffsetX, 
    y: newOffsetY 
  };
  
  // Log the new offset for debugging
  console.log(`New view offset after zoom: (${newOffsetX}, ${newOffsetY})`);
}

// Replace the drawRectangle function with this improved version:
function drawRectangle(x, y, width, height, strokeColor, lineWidth, isFilled, fillColor) {
  if (!ctx) return;
  
  // Save the original context state
  ctx.save();
  
  // Set the rectangle style
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  
  // Apply the zoom level to coordinates and dimensions
  // Note: we don't apply viewOffset here because the canvas itself is already
  // transformed with the viewOffset via its style.transform property
  
  // Fix: Calculate accurate scaling for coordinates and dimensions
  // The canvas itself maintains its base size, but we scale the drawing coordinates
  // This keeps annotations fixed to their correct image pixel positions
  const scaledX = x * zoomLevel.value;
  const scaledY = y * zoomLevel.value;
  const scaledWidth = width * zoomLevel.value;
  const scaledHeight = height * zoomLevel.value;
  
  // Log coords for debugging if needed
  // console.log(`Drawing rect at (${x},${y}) scaled to (${scaledX},${scaledY}) with zoom ${zoomLevel.value}`);
  
  // Draw the rectangle outline
  ctx.beginPath();
  ctx.rect(scaledX, scaledY, scaledWidth, scaledHeight);
  ctx.stroke();
  
  // Fill the rectangle if requested
  if (isFilled && fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  
  // Restore the original context state
  ctx.restore();
}

// Enhance the drawAnnotationLabel function for better zoom handling:
function drawAnnotationLabel(annotation, color) {
  if (!ctx) return;
  
  // Save the original context state
  ctx.save();
  
  // Apply the zoom level to coordinates
  const scaledX = annotation.x * zoomLevel.value;
  const scaledY = annotation.y * zoomLevel.value;
  
  // Set the text style - scale font size with zoom for better readability
  ctx.font = `${Math.max(12, 12 * Math.sqrt(zoomLevel.value))}px Arial`;
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 2;
  
  // Create the label text
  const label = annotation.label || 'unknown';
  
  // Draw the text background
  const textMetrics = ctx.measureText(label);
  const textWidth = textMetrics.width + 10; // Add some padding
  const textHeight = 24 * Math.sqrt(zoomLevel.value); // Scale height with zoom
  
  // Position the label above the annotation
  const labelX = scaledX;
  const labelY = scaledY - textHeight - 5; // 5px gap
  
  // Draw text background
  ctx.fillStyle = color;
  ctx.fillRect(labelX, labelY, textWidth, textHeight);
  
  // Draw text
  ctx.fillStyle = 'white';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, labelX + 5, labelY + (textHeight / 2)); // Center text vertically with padding
  
  // Restore the original context state
  ctx.restore();
}

// Enhance the runAnnotationZoomTest function to provide more debugging information:
function runAnnotationZoomTest() {
  if (annotationStore.currentAnnotations.length === 0) {
    toast.info("No annotations to test zoom functionality with");
    return;
  }
  
  // Log the current state
  console.log("Starting annotation zoom test:");
  console.log("Current zoom level:", zoomLevel.value);
  console.log("Current view offset:", viewOffset.value);
  
  // Log a sample annotation before zooming
  const sampleAnnotation = annotationStore.currentAnnotations[0];
  console.log("Sample annotation before zoom:", {
    id: sampleAnnotation._id,
    label: sampleAnnotation.label,
    x: sampleAnnotation.x,
    y: sampleAnnotation.y,
    width: sampleAnnotation.width,
    height: sampleAnnotation.height
  });
  
  // Perform a zoom in
  console.log("Zooming in...");
  zoomIn();
  
  // Log the state after zooming
  console.log("After zoom level:", zoomLevel.value);
  console.log("After view offset:", viewOffset.value);
  
  // Log canvas dimensions
  console.log("Canvas dimensions:", {
    width: canvasRef.value.width,
    height: canvasRef.value.height,
    style: {
      width: `${imageDimensions.value.width * zoomLevel.value}px`,
      height: `${imageDimensions.value.height * zoomLevel.value}px`
    }
  });
  
  // Log annotation position after zooming
  console.log("Sample annotation screen position after zoom:", {
    x: sampleAnnotation.x * zoomLevel.value,
    y: sampleAnnotation.y * zoomLevel.value,
    width: sampleAnnotation.width * zoomLevel.value,
    height: sampleAnnotation.height * zoomLevel.value
  });
  
  // Redraw to ensure annotations are correctly positioned
  redrawCanvas();
  
  toast.info(`Zoom test complete. Check console for details.`);
}

// Update resetZoom function to also center the image:
function resetZoom() {
  const prevZoomLevel = zoomLevel.value;
  zoomLevel.value = 1;
  
  // Only apply the zoom offset update if zoom actually changed
  if (prevZoomLevel !== zoomLevel.value) {
    // Reset the view offset and re-center
    viewOffset.value = { x: 0, y: 0 };
    updateZoomOffset(); // Make sure to center properly
  }
  
  redrawCanvas();
}
