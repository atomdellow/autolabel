import { ref, computed } from 'vue';

/**
 * Composable for handling annotation selection functionality
 * @param {Object} projectId - Ref for the current project ID
 * @param {Object} imageId - Ref for the current image ID
 * @param {Object} annotationStore - The annotation store
 * @param {Object} toast - Toast notification service
 * @param {Function} redrawCanvas - Function to trigger canvas redraw
 * @returns {Object} - Selection state and functions
 */
export function useAnnotationSelection(projectId, imageId, annotationStore, toast, redrawCanvas) {
  // Selection state
  const selectedAnnotationIds = ref([]);
  const highlightedAnnotationId = ref(null);

  /**
   * Check if an annotation is selected
   * @param {string} annotationId - The annotation ID to check
   * @returns {boolean} - Whether the annotation is selected
   */
  function isAnnotationSelected(annotationId) {
    return selectedAnnotationIds.value.includes(annotationId);
  }

  /**
   * Toggle selection of an annotation
   * @param {string} annotationId - The annotation ID to toggle selection for
   */
  function toggleAnnotationSelection(annotationId) {
    if (isAnnotationSelected(annotationId)) {
      // Remove from selected annotations
      selectedAnnotationIds.value = selectedAnnotationIds.value.filter(id => id !== annotationId);
    } else {
      // Add to selected annotations
      selectedAnnotationIds.value.push(annotationId);
    }
  }

  /**
   * Select all annotations
   */
  function selectAllAnnotations() {
    if (!annotationStore.currentAnnotations) return;
    
    // If all are already selected, deselect all instead
    if (selectedAnnotationIds.value.length === annotationStore.currentAnnotations.length) {
      selectedAnnotationIds.value = [];
    } else {
      // Select all annotations
      selectedAnnotationIds.value = annotationStore.currentAnnotations.map(ann => ann._id);
    }
  }

  /**
   * Delete an existing annotation
   * @param {string} annotationId - The annotation ID to delete
   */
  function deleteExistingAnnotation(annotationId) {
    if (!annotationId) return;
    
    // Find the annotation to delete
    const annotation = annotationStore.currentAnnotations.find(ann => ann._id === annotationId);
    
    if (annotation) {
      // Delete the annotation
      annotationStore.deleteAnnotation(annotationId, imageId.value, projectId.value)
        .then(() => {
          toast.success(`Deleted ${annotation.label || 'unnamed'} annotation`);
          
          // Clear selection if this was selected
          if (selectedAnnotationIds.value.includes(annotationId)) {
            selectedAnnotationIds.value = selectedAnnotationIds.value.filter(id => id !== annotationId);
          }
          
          // Clear highlight if this was highlighted
          if (highlightedAnnotationId.value === annotationId) {
            highlightedAnnotationId.value = null;
          }
          
          // Redraw the canvas
          redrawCanvas();
        })
        .catch(error => {
          console.error('Error deleting annotation:', error);
          toast.error('Failed to delete annotation');
        });
    }
  }

  /**
   * Delete all selected annotations
   */
  function deleteSelectedAnnotations() {
    if (selectedAnnotationIds.value.length === 0) return;
    
    // Create an array of promises for each deletion
    const deletePromises = selectedAnnotationIds.value.map(id => 
      annotationStore.deleteAnnotation(id, imageId.value, projectId.value)
    );
    
    // Wait for all deletions to complete
    Promise.all(deletePromises)
      .then(() => {
        toast.success(`Deleted ${selectedAnnotationIds.value.length} annotations`);
        
        // Clear selection
        selectedAnnotationIds.value = [];
        
        // Redraw canvas
        redrawCanvas();
      })
      .catch(error => {
        console.error('Error deleting annotations:', error);
        toast.error('Failed to delete some annotations');
      });
  }

  /**
   * Highlight an annotation
   * @param {Object} annotation - The annotation to highlight
   */
  function highlightAnnotation(annotation) {
    if (annotation && annotation._id) {
      highlightedAnnotationId.value = annotation._id;
      redrawCanvas();
    }
  }

  /**
   * Remove annotation highlighting
   */
  function unhighlightAnnotation() {
    highlightedAnnotationId.value = null;
    redrawCanvas();
  }

  /**
   * Count annotations for a specific class
   * @param {string} className - The class name to count annotations for
   * @returns {number} - The number of annotations with the given class
   */
  function countAnnotationsByClass(className) {
    if (!annotationStore.currentAnnotations) return 0;
    return annotationStore.currentAnnotations.filter(ann => ann.label === className).length;
  }

  return {
    // State
    selectedAnnotationIds,
    highlightedAnnotationId,
    
    // Functions
    isAnnotationSelected,
    selectAllAnnotations,
    toggleAnnotationSelection,
    deleteSelectedAnnotations,
    deleteExistingAnnotation,
    highlightAnnotation,
    unhighlightAnnotation,
    countAnnotationsByClass
  };
}
