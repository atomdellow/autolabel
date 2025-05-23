import { ref, computed } from 'vue';

/**
 * Composable for handling annotation history (undo/redo) functionality
 * @param {Object} projectId - Ref for the current project ID
 * @param {Object} imageId - Ref for the current image ID
 * @param {Object} annotationStore - The annotation store
 * @param {Object} toast - Toast notification service
 * @returns {Object} - History state and functions
 */
export function useAnnotationHistory(projectId, imageId, annotationStore, toast) {
  // Undo/Redo state
  const undoStack = ref([]);
  const redoStack = ref([]);
  const MAX_UNDO_HISTORY = 20; // Maximum number of actions in undo history
  const undoLimitReached = ref(false); // Flag to indicate if undo history limit has been reached

  // Computed properties for undo/redo availability
  const canUndo = computed(() => undoStack.value.length > 0);
  const canRedo = computed(() => redoStack.value.length > 0);

  /**
   * Helper function to get annotation label for display
   * @param {Object} annotation - The annotation object
   * @returns {string} - Label for the annotation
   */
  function getAnnotationLabel(annotation) {
    if (!annotation) return 'unknown';
    return `${annotation.label || 'unnamed'} annotation`;
  }

  /**
   * Helper function to check if an annotation has undo/redo history
   * @param {string} annotationId - The annotation ID to check
   * @returns {boolean} - Whether the annotation has history
   */
  function hasAnnotationHistory(annotationId) {
    if (!annotationId) return false;
    
    // Check undo stack for actions relating to this annotation
    const hasUndoHistory = undoStack.value.some(
      action => action.annotationId === annotationId || 
      (action.annotationData && action.annotationData._id === annotationId) ||
      (action.oldData && action.oldData._id === annotationId) ||
      (action.newData && action.newData._id === annotationId)
    );
    
    // Check redo stack for actions relating to this annotation
    const hasRedoHistory = redoStack.value.some(
      action => action.annotationId === annotationId || 
      (action.annotationData && action.annotationData._id === annotationId) ||
      (action.oldData && action.oldData._id === annotationId) ||
      (action.newData && action.newData._id === annotationId)
    );
    
    return hasUndoHistory || hasRedoHistory;
  }

  /**
   * Get description of the last undo action
   * @returns {string} - Description of the action to undo
   */
  function getUndoActionDescription() {
    if (undoStack.value.length === 0) return '';
    
    const lastAction = undoStack.value[undoStack.value.length - 1];
    
    switch (lastAction.type) {
      case 'CREATE':
        return `creation of ${getAnnotationLabel(lastAction.annotationData)}`;
      case 'UPDATE':
        return `update to ${getAnnotationLabel(lastAction.oldData)}`;
      case 'DELETE':
        return `deletion of ${getAnnotationLabel(lastAction.annotationData)}`;
      case 'MULTI_CREATE':
        return `creation of ${lastAction.annotationIds?.length || 0} annotations`;
      case 'MULTI_DELETE':
        return `deletion of ${lastAction.annotationIds?.length || 0} annotations`;
      case 'AUTO_DETECT':
        return `auto-detection of ${lastAction.annotationIds?.length || 0} shapes`;
      default:
        return 'last action';
    }
  }

  /**
   * Get description of the last redo action
   * @returns {string} - Description of the action to redo
   */
  function getRedoActionDescription() {
    if (redoStack.value.length === 0) return '';
    
    const lastAction = redoStack.value[redoStack.value.length - 1];
    
    switch (lastAction.type) {
      case 'CREATE':
        return `creation of ${getAnnotationLabel(lastAction.annotationData)}`;
      case 'UPDATE':
        return `update to ${getAnnotationLabel(lastAction.newData)}`;
      case 'DELETE':
        return `deletion of ${getAnnotationLabel(lastAction.annotationData)}`;
      case 'MULTI_CREATE':
        return `creation of ${lastAction.annotationIds?.length || 0} annotations`;
      case 'MULTI_DELETE':
        return `deletion of ${lastAction.annotationIds?.length || 0} annotations`;
      case 'AUTO_DETECT':
        return `auto-detection of ${lastAction.annotationIds?.length || 0} shapes`;
      default:
        return 'next action';
    }
  }

  /**
   * Add an action to the undo stack
   * @param {Object} action - The action to add
   */
  function addToUndoStack(action) {
    // Ensure action has a timestamp - use high precision timestamp to avoid ordering issues
    if (!action.timestamp) {
      action.timestamp = Date.now() + (performance.now() / 1000);
    }

    // Add the action to the undo stack
    undoStack.value.push(action);
    
    // Clear the redo stack after a new action
    redoStack.value = [];
    
    // Check if we've reached the undo limit
    if (undoStack.value.length > MAX_UNDO_HISTORY) {
      // Remove the oldest action
      undoStack.value.shift();
      
      if (!undoLimitReached.value) {
        console.warn(`Undo history limit (${MAX_UNDO_HISTORY}) reached. Oldest actions will be discarded.`);
        undoLimitReached.value = true;
      }
    } else {
      undoLimitReached.value = false;
    }
  }

  /**
   * Undo the last action
   */
  function undo() {
    if (undoStack.value.length === 0) return;
    
    const action = undoStack.value.pop();
    
    switch (action.type) {
      case 'CREATE':
        // Undo a creation by deleting the annotation
        annotationStore.deleteAnnotation(action.annotationId, imageId.value, projectId.value)
          .then(() => {
            toast.success(`Undid ${getAnnotationLabel(action.annotationData)} creation`);
            
            // Add to redo stack
            redoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error undoing creation:', error);
            toast.error('Failed to undo creation');
            
            // Put the action back on the undo stack
            undoStack.value.push(action);
          });
        break;
        
      case 'UPDATE':
        // Undo an update by reverting to the old data
        annotationStore.updateAnnotation(action.annotationId, action.oldData, projectId.value, imageId.value)
          .then(() => {
            toast.success(`Undid update to ${getAnnotationLabel(action.oldData)}`);
            
            // Add to redo stack
            redoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error undoing update:', error);
            toast.error('Failed to undo update');
            
            // Put the action back on the undo stack
            undoStack.value.push(action);
          });
        break;
        
      case 'DELETE':
        // Undo a deletion by recreating the annotation
        annotationStore.createAnnotation(action.annotationData, projectId.value, imageId.value)
          .then(newAnnotation => {
            toast.success(`Undid deletion of ${getAnnotationLabel(action.annotationData)}`);
            
            // Save the newly created annotation ID to the redo action
            // (since the original is gone and has a new ID now)
            const redoAction = {
              ...action,
              newAnnotationId: newAnnotation._id // Save the new ID for redo
            };
            
            // Add to redo stack
            redoStack.value.push(redoAction);
          })
          .catch(error => {
            console.error('Error undoing deletion:', error);
            toast.error('Failed to undo deletion');
            
            // Put the action back on the undo stack
            undoStack.value.push(action);
          });
        break;
        
      case 'MULTI_CREATE':
      case 'AUTO_DETECT':
        // Undo multiple creations (e.g. from detection)
        const deletePromises = action.annotationIds.map(id => 
          annotationStore.deleteAnnotation(id, imageId.value, projectId.value)
        );
        
        Promise.all(deletePromises)
          .then(() => {
            toast.success(`Undid ${action.type === 'AUTO_DETECT' ? 'auto-detection' : 'creation'} of ${action.annotationIds.length} annotations`);
            
            // Add to redo stack
            redoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error undoing multiple creations:', error);
            toast.error('Failed to undo multiple creations');
            
            // Put the action back on the undo stack
            undoStack.value.push(action);
          });
        break;
        
      case 'MULTI_DELETE':
        // Undo multiple deletions
        const createPromises = action.annotationData.map(ann => 
          annotationStore.createAnnotation(ann, projectId.value, imageId.value)
        );
        
        Promise.all(createPromises)
          .then(newAnnotations => {
            toast.success(`Undid deletion of ${newAnnotations.length} annotations`);
            
            // Update the redo action with the new annotation IDs
            const redoAction = {
              ...action,
              newAnnotationIds: newAnnotations.map(ann => ann._id)
            };
            
            // Add to redo stack
            redoStack.value.push(redoAction);
          })
          .catch(error => {
            console.error('Error undoing multiple deletions:', error);
            toast.error('Failed to undo multiple deletions');
            
            // Put the action back on the undo stack
            undoStack.value.push(action);
          });
        break;
        
      default:
        console.warn('Unknown action type:', action.type);
        break;
    }
  }

  /**
   * Redo the last undone action
   */
  function redo() {
    if (redoStack.value.length === 0) return;
    
    const action = redoStack.value.pop();
    
    switch (action.type) {
      case 'CREATE':
        // Redo a creation by recreating the annotation
        annotationStore.createAnnotation(action.annotationData, projectId.value, imageId.value)
          .then(() => {
            toast.success(`Redid ${getAnnotationLabel(action.annotationData)} creation`);
            
            // Add back to undo stack
            undoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error redoing creation:', error);
            toast.error('Failed to redo creation');
            
            // Put back on redo stack
            redoStack.value.push(action);
          });
        break;
        
      case 'UPDATE':
        // Redo an update by applying the new data
        annotationStore.updateAnnotation(action.annotationId, action.newData, projectId.value, imageId.value)
          .then(() => {
            toast.success(`Redid update to ${getAnnotationLabel(action.newData)}`);
            
            // Add back to undo stack
            undoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error redoing update:', error);
            toast.error('Failed to redo update');
            
            // Put back on redo stack
            redoStack.value.push(action);
          });
        break;
        
      case 'DELETE':
        // Redo a deletion by deleting the annotation
        // Use the newAnnotationId if available (from an undo operation), otherwise use the original
        const idToDelete = action.newAnnotationId || action.annotationId;
        
        annotationStore.deleteAnnotation(idToDelete, imageId.value, projectId.value)
          .then(() => {
            toast.success(`Redid deletion of ${getAnnotationLabel(action.annotationData)}`);
            
            // Add back to undo stack
            undoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error redoing deletion:', error);
            toast.error('Failed to redo deletion');
            
            // Put back on redo stack
            redoStack.value.push(action);
          });
        break;
        
      case 'MULTI_CREATE':
      case 'AUTO_DETECT':
        // Redo multiple creations
        const createPromises = action.annotationData.map(ann => 
          annotationStore.createAnnotation(ann, projectId.value, imageId.value)
        );
        
        Promise.all(createPromises)
          .then(newAnnotations => {
            toast.success(`Redid ${action.type === 'AUTO_DETECT' ? 'auto-detection' : 'creation'} of ${newAnnotations.length} annotations`);
            
            // Add back to undo stack with updated IDs
            const undoAction = {
              ...action,
              annotationIds: newAnnotations.map(ann => ann._id)
            };
            
            undoStack.value.push(undoAction);
          })
          .catch(error => {
            console.error('Error redoing multiple creations:', error);
            toast.error('Failed to redo multiple creations');
            
            // Put back on redo stack
            redoStack.value.push(action);
          });
        break;
        
      case 'MULTI_DELETE':
        // Redo multiple deletions
        const deletePromises = (action.newAnnotationIds || action.annotationIds).map(id => 
          annotationStore.deleteAnnotation(id, imageId.value, projectId.value)
        );
        
        Promise.all(deletePromises)
          .then(() => {
            toast.success(`Redid deletion of ${action.annotationData.length} annotations`);
            
            // Add back to undo stack
            undoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error redoing multiple deletions:', error);
            toast.error('Failed to redo multiple deletions');
            
            // Put back on redo stack
            redoStack.value.push(action);
          });
        break;
        
      default:
        console.warn('Unknown action type:', action.type);
        break;
    }
  }

  return {
    // State
    undoStack,
    redoStack,
    
    // Computed
    canUndo,
    canRedo,
    
    // Functions
    addToUndoStack,
    undo,
    redo,
    getUndoActionDescription,
    getRedoActionDescription,
    getAnnotationLabel,
    hasAnnotationHistory
  };
}
