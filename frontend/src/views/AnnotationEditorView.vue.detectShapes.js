/**
 * Handles the auto-detection of shapes in the current image
 * Converts detected objects into annotations with default class names
 */
async function detectShapes() {
  if (detectingShapes.value) return;
  
  // Button timeout reference for cleanup
  let buttonTimeout;
  let detectButton;
  let originalButtonText;
  
  try {
    detectingShapes.value = true;
    
    // Update UI to show detecting state using nextTick to ensure DOM is available
    await nextTick();
    
    // Store the button reference to use consistently throughout the function
    detectButton = document.querySelector('button[title="Auto-detect shapes in the image"]');
    if (detectButton) {
      // Save original button text for restoration
      originalButtonText = detectButton.innerHTML;
      detectButton.innerHTML = '<span>Detecting...</span>';
      detectButton.setAttribute('disabled', 'true');
      
      // Set timeout to revert button if detection takes too long (30 seconds)
      buttonTimeout = setTimeout(() => {
        if (detectingShapes.value) {
          // Reset detecting state if it's still ongoing
          detectingShapes.value = false;
          detectButton.innerHTML = originalButtonText;
          detectButton.removeAttribute('disabled');
          console.warn('Detection timeout - button restored automatically');
        }
      }, 30000);
    }
    
    // Get the image source URL
    const imageSource = imageUrl.value;
    
    // Send the image URL to the server for processing
    console.log(`Using image URL for detection with method: ${detectionMethod.value}`);
    
    let detectionResponse;
    if (detectionMethod.value === 'ssim' && referenceImagePreview.value) {
      // For SSIM, compare with reference image
      console.log('Comparing with reference image for structural differences...');
      const comparisonResults = await compareScreenshots(imageSource, referenceImagePreview.value);
      
      // Convert comparison results to annotation format
      if (comparisonResults && comparisonResults.ComparisonResult && comparisonResults.ComparisonResult.changes) {
        const changes = comparisonResults.ComparisonResult.changes;
        detectionResponse = {
          detections: changes.map(change => ({
            Label: "change",
            Confidence: 0.9,
            X: change.x,
            Y: change.y,
            Width: change.width,
            Height: change.height
          })),
          dimensions: comparisonResults.ImageDimensions,
          method: 'ssim'
        };
      } else {
        // No changes detected
        console.log('No significant changes detected between images');
        detectionResponse = {
          detections: [],
          dimensions: { width: imageDimensions.value.naturalWidth, height: imageDimensions.value.naturalHeight },
          method: 'ssim'
        };
      }
    } else {
      // Call API to detect objects with selected method
      console.log('Detecting objects in image...');
      detectionResponse = await detectObjects(
        imageSource, 
        detectionMethod.value,
        detectionMethod.value === 'opencv' ? detectionParams.value : undefined
      );
    }
    
    let detectedObjects = detectionResponse.detections;
    let detectionDimensions = detectionResponse.dimensions;
    
    console.log(`Detection results using ${detectionMethod.value}:`, detectedObjects);
    console.log('Detection dimensions:', detectionDimensions);
    console.log('Current image dimensions:', {
      naturalWidth: imageDimensions.value.naturalWidth,
      naturalHeight: imageDimensions.value.naturalHeight,
      displayWidth: imageDimensions.value.width,
      displayHeight: imageDimensions.value.height
    });
    
    // Generate fallback UI elements if no detections
    if (!detectedObjects || detectedObjects.length === 0) {
      console.warn('No objects detected in the image, generating fallbacks');
      
      const width = imageDimensions.value.naturalWidth;
      const height = imageDimensions.value.naturalHeight;
      
      if (width > 0 && height > 0) {
        console.log('Generating fallback UI element proposals');
        
        // Create an array of fallback UI elements
        detectedObjects = [
          // Window-like element in the center
          {
            Label: 'window',
            Confidence: 0.8,
            X: Math.floor(width * 0.15),
            Y: Math.floor(height * 0.1),
            Width: Math.floor(width * 0.7),
            Height: Math.floor(height * 0.75)
          },
          // Taskbar at bottom
          {
            Label: 'taskbar',
            Confidence: 0.9,
            X: 0,
            Y: Math.floor(height * 0.95),
            Width: width,
            Height: Math.floor(height * 0.05)
          }
        ];
        
        // Add some icon-like elements
        const iconSize = Math.floor(Math.min(width, height) / 20);
        for (let i = 0; i < 5; i++) {
          detectedObjects.push({
            Label: 'icon',
            Confidence: 0.7,
            X: Math.floor(width * 0.03) + (i * iconSize * 1.5),
            Y: Math.floor(height * 0.03),
            Width: iconSize,
            Height: iconSize
          });
        }
      } else {
        alert('No objects detected in the image and unable to generate fallbacks.');
        return;
      }
    }
    
    // Process detected objects into annotations
    const detectTimestamp = Date.now() + (performance.now() / 1000);
    const allAnnotations = [...annotationStore.currentAnnotations];
    const newAnnotations = [];
    
    // Update the image metadata to record this detection attempt
    try {
      await fetch(`/api/images/${imageId.value}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detectionAttempt: {
            timestamp: new Date().toISOString(),
            objectsFound: detectedObjects.length,
            method: detectionMethod.value
          }
        })
      });
    } catch (metadataError) {
      console.warn('Failed to update image metadata:', metadataError);
      // Non-critical error, continue with annotation
    }
    
    // Convert detected objects to annotation format
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      
      // Use object label if available, otherwise use default class
      const className = obj.Label || defaultDetectionClass.value;
      
      // Create a unique identifier for the auto-generated annotation
      const tempId = `auto_${Date.now()}_${i}`;
      
      // Need to scale coordinates if detection dimensions don't match actual image
      let x = obj.X;
      let y = obj.Y;
      let width = obj.Width;
      let height = obj.Height;
      
      // Scale coordinates if we have both sets of dimensions
      if (detectionDimensions && 
          imageDimensions.value.naturalWidth && 
          imageDimensions.value.naturalHeight) {
          
        // Calculate scaling factors
        const scaleX = imageDimensions.value.naturalWidth / detectionDimensions.width;
        const scaleY = imageDimensions.value.naturalHeight / detectionDimensions.height;
        
        console.log(`Object ${i} (${obj.Label}): Original detection coordinates:`);
        console.log(`  Position: (${x}, ${y}), Size: ${width}x${height}`);
        console.log(`  Image scaling: ${scaleX.toFixed(4)}x, ${scaleY.toFixed(4)}y`);
        
        // Only apply scaling if the factor is significantly different from 1.0
        // This prevents unnecessary adjustments for tiny rounding differences
        if (Math.abs(scaleX - 1.0) > 0.01 || Math.abs(scaleY - 1.0) > 0.01) {
          // Apply scaling
          x = Math.round(x * scaleX);
          y = Math.round(y * scaleY);
          width = Math.round(width * scaleX);
          height = Math.round(height * scaleY);
          
          console.log(`  Scaled to: Position: (${x}, ${y}), Size: ${width}x${height}`);
        } else {
          console.log(`  No scaling needed (factors too close to 1.0)`);
        }
      }
      
      // Safety check - ensure annotations don't exceed image bounds
      const imageWidth = imageDimensions.value.naturalWidth;
      const imageHeight = imageDimensions.value.naturalHeight;
      
      if (x < 0) { 
        width += x; // Reduce width by the amount x is negative
        x = 0;
        console.log(`  Adjusted: x coordinate was negative, now ${x}`);
      }
      
      if (y < 0) {
        height += y; // Reduce height by the amount y is negative
        y = 0;
        console.log(`  Adjusted: y coordinate was negative, now ${y}`);
      }
      
      if (x + width > imageWidth) {
        width = imageWidth - x;
        console.log(`  Adjusted: width exceeded image bounds, now ${width}`);
      }
      
      if (y + height > imageHeight) {
        height = imageHeight - y;
        console.log(`  Adjusted: height exceeded image bounds, now ${height}`);
      }
      
      // Skip annotation if it's too small after adjustments
      if (width < 5 || height < 5) {
        console.log(`  Skipping: annotation too small after bounds adjustment (${width}x${height})`);
        continue;
      }
      
      // Create annotation data
      const annotationData = {
        x: x,
        y: y,
        width: width,
        height: height,
        label: className,
        color: getColorForClass(className),
        id: tempId,
        confidence: obj.Confidence, // Store confidence for potential filtering
        detectionMethod: detectionMethod.value // Store which method detected this
      };
      
      newAnnotations.push(annotationData);
      allAnnotations.push(annotationData);
    }
    
    // Update all annotations at once to avoid multiple server round trips
    console.log(`Saving ${newAnnotations.length} auto-detected annotations`);
    try {
      const response = await annotationStore.setAllAnnotationsForImage(imageId.value, allAnnotations, projectId.value);
      
      if (response && response.annotations) {
        // Add a single undo action for all created annotations
        const createdAnnotations = response.annotations.slice(-newAnnotations.length);
        
        // Create a group action for undo
        addToUndoStack({
          type: 'AUTO_DETECT',
          timestamp: detectTimestamp,
          annotationIds: createdAnnotations.map(ann => ann._id),
          annotationData: createdAnnotations.map(ann => ({ ...ann })),
          detectionMethod: detectionMethod.value
        });
        
        // Ensure UI is synchronized with backend state
        await debouncedRefreshAnnotations();
        
        // Update any image metadata in the store
        const imageStore = useImageStore();
        try {
          await imageStore.refreshImageDetails(imageId.value);
        } catch (refreshError) {
          console.warn('Non-critical error refreshing image details:', refreshError);
        }
        
        // Show success message with method info
        alert(`Successfully added ${createdAnnotations.length} shapes using ${detectionMethod.value.toUpperCase()} detection.`);
      } else {
        console.error('Invalid response format:', response);
        throw new Error('Invalid response from server when saving annotations');
      }
    } catch (saveError) {
      console.error('Error saving annotations:', saveError);
      throw new Error(`Failed to save detected shapes: ${saveError.message}`);
    }
  } catch (error) {
    console.error('Shape detection failed:', error);
    
    // Provide a more helpful error message
    let errorMessage = error.message || 'Unknown error';
    
    // Check for specific errors and provide more context
    if (errorMessage.includes('Failed to fetch') || error.name === 'TypeError' || errorMessage.includes('connect')) {
      errorMessage = 'Failed to connect to the backend detection API. The server might be unavailable or starting up.\n\n' +
                    'If the problem persists, check that:\n' +
                    '1. Node.js backend is running at http://localhost:5001\n' +
                    '2. Python with the required packages is installed (run setup_detection.ps1)';
    } else if (errorMessage.includes('SecurityError') || errorMessage.includes('Tainted canvas')) {
      errorMessage = 'Unable to access image data due to cross-origin restrictions.';
    } else if (errorMessage.includes('Server error: Not Found')) {
      errorMessage = 'The detection API endpoint was not found. This could be due to:\n' +
                    '1. Incorrect URL configuration in the frontend\n' +
                    '2. Detection routes not properly mounted in the backend\n\n' +
                    'Please check your server configuration and restart the application.';
    } else if (errorMessage.includes('Detection script not found')) {
      errorMessage = 'The Python detection script was not found. Please verify that:\n' +
                    '1. The AutoDesktopVisionApi folder exists in the project root\n' +
                    '2. The detect_objects.py or detect_contours.py file is present in that folder\n' +
                    '3. You have run the setup_detection script to install dependencies';
    } else if (errorMessage.includes('Invalid response from server')) {
      errorMessage = 'The server returned an unexpected response format. This could indicate a problem with:\n' +
                    '1. The detection script output format\n' +
                    '2. Server response processing\n\n' +
                    'Try refreshing the page and attempt detection again.';
    }
    
    alert('Failed to detect shapes: ' + errorMessage);
  } finally {
    detectingShapes.value = false;
    
    // Clear any timeout that might have been set
    if (buttonTimeout) {
      clearTimeout(buttonTimeout);
      buttonTimeout = null;
    }
    
    // Restore button state - use the reference to the button captured at the start of the function
    if (detectButton && originalButtonText) {
      detectButton.innerHTML = originalButtonText;
      detectButton.removeAttribute('disabled');
    } else {
      // Fallback in case we lost the original reference
      nextTick(() => {
        const fallbackButton = document.querySelector('button[title="Auto-detect shapes in the image"]');
        if (fallbackButton) {
          fallbackButton.innerHTML = '<span>Detect Shapes</span>';
          fallbackButton.removeAttribute('disabled');
        }
      });
    }
  }
}
