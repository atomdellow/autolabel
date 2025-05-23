// Function to auto-detect shapes in the image
async function detectShapes() {
  if (detectingShapes.value || !imageUrl.value) {
    return;
  }
  
  detectingShapes.value = true;
  
  try {
    toast.info(`Detecting shapes using ${detectionMethod.value} method...`);
    
    // Prepare parameters for detection
    const detectionConfig = {
      method: detectionMethod.value,
      params: { ...detectionParams.value }
    };
    
    // Include reference image for SSIM method
    if (detectionMethod.value === 'ssim' && referenceImageData.value) {
      detectionConfig.referenceImage = referenceImageData.value;
    }
    
    // Call the detection service
    const detectedObjects = await detectObjectsInImage(
      imageId.value,
      detectionConfig
    );
    
    if (!detectedObjects || detectedObjects.length === 0) {
      toast.info('No shapes were detected in the image');
      return;
    }
    
    // Create annotations for each detected object
    const createPromises = detectedObjects.map(obj => {
      // Convert detection coordinates to annotation format
      // Note: The detection service might return coordinates in different formats
      // depending on the detection method, so we normalize here
      const newAnnotation = {
        label: obj.class || defaultDetectionClass.value,
        x: obj.x || obj.bbox[0],
        y: obj.y || obj.bbox[1],
        width: obj.width || obj.bbox[2],
        height: obj.height || obj.bbox[3],
        confidence: obj.confidence || null,
        detectionMethod: detectionMethod.value
      };
      
      return annotationStore.createAnnotation(newAnnotation, projectId.value, imageId.value);
    });
    
    const createdAnnotations = await Promise.all(createPromises);
    
    // Add all created annotations to a single undo action for better UX
    if (createdAnnotations.length > 0) {
      addToUndoStack({
        type: 'MULTI_CREATE',
        timestamp: Date.now(),
        annotationIds: createdAnnotations.map(ann => ann._id),
        annotationData: createdAnnotations.map(ann => ({ ...ann }))
      });
      
      toast.success(`Created ${createdAnnotations.length} annotations from detected shapes`);
    }
  } catch (error) {
    console.error('Error detecting shapes:', error);
    toast.error(`Failed to detect shapes: ${error.message || 'Unknown error'}`);
  } finally {
    detectingShapes.value = false;
  }
}

// Function to count annotations for a specific class
function countAnnotationsByClass(className) {
  if (!annotationStore.currentAnnotations) return 0;
  
  return annotationStore.currentAnnotations.filter(ann => ann.label === className).length;
}

// Function to check if an annotation has history (undos/redos)
function hasAnnotationHistory(annotationId) {
  if (!annotationId) return false;
  
  // Check if there's any undo or redo operation for this annotation
  const hasUndoHistory = undoStack.value.some(action => 
    action.annotationId === annotationId || 
    (action.type === 'MULTI_DELETE' && action.annotationIds && action.annotationIds.includes(annotationId)) ||
    (action.annotationData && action.annotationData._id === annotationId)
  );
  
  const hasRedoHistory = redoStack.value.some(action => 
    action.annotationId === annotationId || 
    (action.type === 'MULTI_DELETE' && action.annotationIds && action.annotationIds.includes(annotationId)) ||
    (action.annotationData && action.annotationData._id === annotationId)
  );
  
  return hasUndoHistory || hasRedoHistory;
}

// Functions to get descriptive text for undo/redo actions
function getUndoActionDescription() {
  if (undoStack.value.length === 0) return '';
  
  const lastAction = undoStack.value[undoStack.value.length - 1];
  
  switch (lastAction.type) {
    case 'CREATE':
      return `Create ${getAnnotationLabel(lastAction.annotationData)}`;
    case 'UPDATE':
      return `Update ${getAnnotationLabel(lastAction.oldData)}`;
    case 'DELETE':
      return `Delete ${getAnnotationLabel(lastAction.annotationData)}`;
    case 'MULTI_DELETE':
      return `Delete ${lastAction.annotationIds?.length || 0} annotations`;
    case 'MULTI_CREATE':
      return `Create ${lastAction.annotationIds?.length || 0} annotations`;
    default:
      return lastAction.type;
  }
}

function getRedoActionDescription() {
  if (redoStack.value.length === 0) return '';
  
  const nextAction = redoStack.value[redoStack.value.length - 1];
  
  switch (nextAction.type) {
    case 'CREATE':
      return `Create ${getAnnotationLabel(nextAction.annotationData)}`;
    case 'UPDATE':
      return `Update ${getAnnotationLabel(nextAction.oldData)}`;
    case 'DELETE':
      return `Delete ${getAnnotationLabel(nextAction.annotationData)}`;
    case 'MULTI_DELETE':
      return `Delete ${nextAction.annotationIds?.length || 0} annotations`;
    case 'MULTI_CREATE':
      return `Create ${nextAction.annotationIds?.length || 0} annotations`;
    default:
      return nextAction.type;
  }
}

// Helper function to get a human-readable label for an annotation
function getAnnotationLabel(annotation) {
  if (!annotation) return 'unknown';
  return `${annotation.label || 'unknown'} annotation`;
}

// Function to select a class for the current annotation
function selectClass(className) {
  if (!className) return;
  
  currentClassName.value = className;
  
  if (pendingAnnotationCoordinates.value) {
    // If we have pending coordinates, this means we're waiting to assign a class
    // to a newly drawn annotation
    confirmClassInput();
  } else if (editingAnnotationId.value) {
    // If we're editing an annotation, update its class
    const annotationToUpdate = annotationStore.currentAnnotations.find(
      ann => ann._id === editingAnnotationId.value
    );
    
    if (annotationToUpdate) {
      // Store the old annotation for undo
      const oldAnnotation = { ...annotationToUpdate };
      
      // Update the annotation with the new class
      annotationStore.updateAnnotation({
        ...annotationToUpdate,
        label: className
      }, projectId.value, imageId.value)
      .then(() => {
        toast.success(`Updated annotation class to ${className}`);
        
        // Add to undo stack
        addToUndoStack({
          type: 'UPDATE',
          timestamp: Date.now(),
          annotationId: oldAnnotation._id,
          oldData: oldAnnotation,
          newData: { ...oldAnnotation, label: className }
        });
      })
      .catch(error => {
        console.error('Error updating annotation class:', error);
        toast.error('Failed to update annotation class');
      });
    }
  } else {
    // If we're not creating or editing an annotation, just update the current class name
    // This will be used when creating the next annotation
    showClassModal.value = false;
  }
}

// Functions for editing annotations
function startEditingAnnotation(annotation) {
  if (!annotation) return;
  
  // Store a copy of the annotation before editing begins
  originalAnnotationBeforeEdit.value = { ...annotation };
  
  // Set the editing annotation ID
  editingAnnotationId.value = annotation._id;
  
  // Ensure the annotation is visible on screen
  // If annotation is outside of the visible area, pan to it
  const rect = naturalToScreen(
    annotation.x,
    annotation.y,
    annotation.width,
    annotation.height
  );
  
  // Check if annotation is in the viewport
  const containerWidth = canvasContainerRef.value ? canvasContainerRef.value.offsetWidth : 0;
  const containerHeight = canvasContainerRef.value ? canvasContainerRef.value.offsetHeight : 0;
  
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
  
  toast.info(`Editing ${annotation.label} annotation. Drag to move, use handles to resize.`);
  redrawCanvas();
}

function finishEditingAnnotation() {
  // Clear the editing state
  editingAnnotationId.value = null;
  isResizing.value = false;
  activeResizeHandle.value = null;
  originalAnnotationBeforeEdit.value = null;
  originalResizingAnnotation.value = null;
  
  redrawCanvas();
}

// Tag handling functions
function addTag() {
  if (!newTagInput.value) {
    tagError.value = 'Please enter a tag';
    return;
  }
  
  const tag = newTagInput.value.trim();
  
  // Check if tag already exists
  if (currentImageTags.value.includes(tag)) {
    tagError.value = 'This tag already exists';
    return;
  }
  
  // Reset error
  tagError.value = '';
  
  // Add tag to the current tags array
  currentImageTags.value.push(tag);
  
  // Save tags to the current image
  const currentImage = imageStore.getImageById(imageId.value);
  if (currentImage) {
    imageStore.updateImageTags(imageId.value, currentImageTags.value)
      .then(() => {
        console.log(`Added tag "${tag}" to image`);
      })
      .catch(error => {
        console.error('Error updating image tags:', error);
        // Remove the tag from the array since the update failed
        currentImageTags.value = currentImageTags.value.filter(t => t !== tag);
      });
  }
  
  // Clear the input field
  newTagInput.value = '';
}

function removeTag(tag) {
  if (!tag) return;
  
  // Remove tag from the current tags array
  currentImageTags.value = currentImageTags.value.filter(t => t !== tag);
  
  // Save updated tags to the current image
  const currentImage = imageStore.getImageById(imageId.value);
  if (currentImage) {
    imageStore.updateImageTags(imageId.value, currentImageTags.value)
      .then(() => {
        console.log(`Removed tag "${tag}" from image`);
      })
      .catch(error => {
        console.error('Error updating image tags:', error);
        // Add the tag back since the update failed
        currentImageTags.value.push(tag);
      });
  }
}

// Function to name annotations using LLM
async function nameAnnotationsWithLLM() {
  if (namingAnnotations.value || !imageUrl.value || !annotationStore.currentAnnotations.length) {
    return;
  }
  
  namingAnnotations.value = true;
  namingStatus.value = 'Starting naming process...';
  namingProgress.value = 0;
  
  try {
    // Show toast to indicate the process is starting
    toast.info(`Starting automatic naming of ${annotationStore.currentAnnotations.length} annotations...`);
    
    // Call the LLM service to name annotations
    const namedAnnotations = await nameWithLLM(imageUrl.value, annotationStore.currentAnnotations);
    
    if (!namedAnnotations || !namedAnnotations.length) {
      throw new Error('No annotations returned from naming service');
    }
    
    namingStatus.value = 'Updating annotations...';
    
    // Update each annotation with its new name/label
    const updatePromises = namedAnnotations.map((namedAnn, index) => {
      // Find the corresponding annotation in our current set
      const originalAnn = annotationStore.currentAnnotations.find(ann => ann._id === namedAnn._id);
      
      if (!originalAnn) {
        console.warn(`Could not find original annotation for named annotation ${namedAnn._id}`);
        return Promise.resolve();
      }
      
      // Skip update if the label is unchanged
      if (originalAnn.label === namedAnn.label) {
        return Promise.resolve();
      }
      
      // Track progress
      namingProgress.value = Math.round((index / namedAnnotations.length) * 100);
      
      // Create a copy of the original annotation for undo stack
      const oldAnnotation = { ...originalAnn };
      
      // Update the annotation with the new label
      return annotationStore.updateAnnotation({
        ...originalAnn,
        label: namedAnn.label
      }, projectId.value, imageId.value)
      .then(() => {
        // Add to undo stack
        addToUndoStack({
          type: 'UPDATE',
          timestamp: Date.now(),
          annotationId: oldAnnotation._id,
          oldData: oldAnnotation,
          newData: { ...oldAnnotation, label: namedAnn.label }
        });
        
        return namedAnn.label;
      });
    });
    
    // Wait for all updates to complete
    const results = await Promise.all(updatePromises);
    
    // Count successful updates
    const changedCount = results.filter(Boolean).length;
    
    if (changedCount > 0) {
      toast.success(`Successfully named ${changedCount} annotations`);
    } else {
      toast.info('No changes made to annotation labels');
    }
    
    namingStatus.value = 'Complete';
  } catch (error) {
    console.error('Error naming annotations with LLM:', error);
    toast.error(`Failed to name annotations: ${error.message || 'Unknown error'}`);
    namingStatus.value = 'Failed';
  } finally {
    namingAnnotations.value = false;
    namingProgress.value = 100;
  }
}
