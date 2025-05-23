import { ref } from 'vue';
import { detectObjectsInImage } from '../../../services/detectionService';
import { nameAnnotationsWithLLM as nameWithLLM } from '../../../services/llmService';

/**
 * Composable for handling shape detection and naming functionality
 * @param {Object} projectId - Ref for the current project ID
 * @param {Object} imageId - Ref for the current image ID
 * @param {Object} annotationStore - The annotation store
 * @param {Object} imageStore - The image store
 * @param {Object} toast - Toast notification service
 * @param {Object} canvasCoordinates - Canvas coordinates utilities
 * @param {Object} annotationHistory - The annotation history utilities
 * @returns {Object} - Detection state and functions
 */
export function useDetection(projectId, imageId, annotationStore, imageStore, toast, canvasCoordinates, annotationHistory) {
  // Detection method configuration
  const detectionMethod = ref('yolo'); // 'yolo', 'opencv', or 'ssim'
  const detectionParams = ref({
    sensitivity: 0.5,   // For OpenCV - edge detection sensitivity (0.1-0.9)
    minArea: 100,       // For OpenCV - minimum contour area to consider
    maxArea: null       // For OpenCV - maximum contour area to consider (null = auto)
  });
  const referenceImageId = ref(''); // For SSIM comparison
  const referenceImagePreview = ref(''); // Preview of reference image for SSIM
  const referenceImageData = ref(null); // To store the base64 data of the reference image

  // Detection state
  const detectingShapes = ref(false);
  const defaultDetectionClass = ref('auto-detected'); // Default class name for auto-detected shapes

  // Naming state
  const namingAnnotations = ref(false);
  const namingStatus = ref('');
  const namingProgress = ref(0);

  /**
   * Update detection parameters
   * @param {Object} params - The new detection parameters
   */
  function updateDetectionParams(params) {
    if (params) {
      detectionParams.value = { ...detectionParams.value, ...params };
    }
  }

  /**
   * Load a reference image for SSIM comparison
   */
  function loadReferenceImage() {
    if (!referenceImageId.value) {
      referenceImagePreview.value = '';
      referenceImageData.value = null;
      return;
    }
    
    // Get the image URL from the store
    const refImage = imageStore.getImageById(referenceImageId.value);
    
    if (refImage) {
      // Set the preview image
      referenceImagePreview.value = refImage.url || '';
      
      // Fetch the image data for the detection service
      fetch(refImage.url)
        .then(response => response.blob())
        .then(blob => {
          const reader = new FileReader();
          reader.onloadend = () => {
            referenceImageData.value = reader.result;
          };
          reader.readAsDataURL(blob);
        })
        .catch(error => {
          console.error('Error loading reference image data:', error);
          toast.error('Failed to load reference image data');
          referenceImageData.value = null;
        });
    } else {
      referenceImagePreview.value = '';
      referenceImageData.value = null;
    }
  }
  /**
   * Detect shapes in the current image
   */
  async function detectShapes() {
    if (detectingShapes.value) {
      toast.info('Detection is already in progress');
      return;
    }
    
    detectingShapes.value = true;
    
    // Determine the detection parameters based on the method
    const params = {
      method: detectionMethod.value,
      sensitivity: detectionParams.value.sensitivity,
      minArea: detectionParams.value.minArea,
      maxArea: detectionParams.value.maxArea
    };
    
    // If using SSIM comparison, include the reference image
    if (detectionMethod.value === 'ssim' && referenceImageData.value) {
      params.referenceImage = referenceImageData.value;
    } else if (detectionMethod.value === 'ssim' && !referenceImageData.value) {
      toast.error('Please select a reference image for SSIM comparison');
      detectingShapes.value = false;
      return;
    }
    
    // Get the current image
    const currentImage = imageStore.getImageById(imageId.value);
    if (!currentImage || !currentImage.url) {
      toast.error('No image to detect shapes in');
      detectingShapes.value = false;
      return;
    }
    
    try {
      // Call the detection service
      const detectedObjects = await detectObjectsInImage(currentImage.url, params);
      
      // Check if we got a valid response
      if (!detectedObjects || !Array.isArray(detectedObjects.detections) || detectedObjects.detections.length === 0) {
        toast.info('No shapes detected');
        return;
      }
      
      // Normalize the detection format
      const normalizedDetections = detectedObjects.detections.map(obj => {
        // Handle both formats: x,y,width,height and x1,y1,x2,y2
        if (obj.box) {
          // Format: [x1, y1, x2, y2]
          const [x1, y1, x2, y2] = obj.box;
          return {
            x: x1,
            y: y1,
            width: x2 - x1,
            height: y2 - y1,
            label: obj.label || defaultDetectionClass.value,
            confidence: obj.confidence || 0.5
          };
        } else {
          // Format: {X, Y, Width, Height, Label}
          return {
            x: obj.X || obj.x,
            y: obj.Y || obj.y,
            width: obj.Width || obj.width,
            height: obj.Height || obj.height,
            label: obj.Label || obj.label || defaultDetectionClass.value,
            confidence: obj.Confidence || obj.confidence || 0.5
          };
        }
      });
      
      // Filter out invalid detections
      const validDetections = normalizedDetections.filter(d => 
        d.width > 5 && d.height > 5 && d.x >= 0 && d.y >= 0
      );
      
      if (validDetections.length === 0) {
        toast.info('No valid shapes detected');
        return;
      }
      
      // Ask the user if they want to add the detected annotations
      if (confirm(`Add ${validDetections.length} detected shapes as annotations?`)) {
        // Track created annotation IDs for undo stack
        const createdAnnotationIds = [];
        const createdAnnotations = [];
        
        // Create each annotation
        for (const detection of validDetections) {
          try {
            const annotation = await annotationStore.createAnnotation(
              detection,
              projectId.value,
              imageId.value
            );
            
            if (annotation && annotation._id) {
              createdAnnotationIds.push(annotation._id);
              createdAnnotations.push({...annotation});
            }
          } catch (error) {
            console.error('Error creating annotation:', error);
          }
        }
        
        if (createdAnnotationIds.length > 0) {
          toast.success(`Added ${createdAnnotationIds.length} auto-detected annotations`);          // Add to undo stack using annotation history
          if (annotationHistory) {
            annotationHistory.addToUndoStack({
              type: 'MULTI_CREATE',
              annotationIds: createdAnnotationIds,
              annotationData: createdAnnotations
            });
          }
        } else {
          toast.error('Failed to create annotations');
        }
      }
    } catch (error) {
      console.error('Error detecting shapes:', error);
      toast.error(`Failed to detect shapes: ${error.message || 'Unknown error'}`);
    } finally {
      detectingShapes.value = false;
    }
  }

  /**
   * Name annotations using the LLM service
   */
  function nameAnnotationsWithLLM() {
    if (namingAnnotations.value || annotationStore.currentAnnotations.length === 0) return;
    
    namingAnnotations.value = true;
    namingStatus.value = 'Preparing annotations...';
    namingProgress.value = 0;
    
    // Get the current image
    const currentImage = imageStore.getImageById(imageId.value);
    if (!currentImage || !currentImage.url) {
      toast.error('No image to analyze');
      namingAnnotations.value = false;
      return;
    }
    
    // Call the LLM service
    nameWithLLM(
      currentImage.url, 
      annotationStore.currentAnnotations, 
      projectId.value, 
      imageId.value,
      // Progress callback
      (status, progress) => {
        namingStatus.value = status;
        namingProgress.value = progress;
      }
    )
      .then(namedAnnotations => {
        if (!namedAnnotations || namedAnnotations.length === 0) {
          toast.info('No annotations were named');
          return;
        }
        
        toast.success(`Named ${namedAnnotations.length} annotations using AI`);
        
        // Add to undo stack (in this case, as individual updates)
        namedAnnotations.forEach(namedAnn => {
          // Find the original annotation
          const originalAnn = annotationStore.currentAnnotations.find(
            ann => ann._id === namedAnn._id
          );
            if (originalAnn && originalAnn.label !== namedAnn.label) {
            // Add to undo stack using annotation history
            if (annotationHistory) {
              annotationHistory.addToUndoStack({
                type: 'UPDATE',
                timestamp: Date.now(),
                annotationId: namedAnn._id,
                oldData: { ...originalAnn },
                newData: { ...namedAnn }
              });
            }
          }
        });
      })
      .catch(error => {
        console.error('Error naming annotations:', error);
        toast.error(`Failed to name annotations: ${error.message || 'Unknown error'}`);
      })
      .finally(() => {
        namingAnnotations.value = false;
        namingStatus.value = '';
        namingProgress.value = 0;
      });
  }
  return {
    // State
    detectionMethod,
    detectionParams,
    referenceImageId,
    referenceImagePreview,
    referenceImageData,
    detectingShapes,
    defaultDetectionClass,
    namingAnnotations,
    namingStatus,
    namingProgress,
    annotationStore, // Expose annotation store for the panel
    
    // Functions
    updateDetectionParams,
    loadReferenceImage,
    detectShapes,
    nameAnnotationsWithLLM
  };
}
