import { defineStore } from 'pinia';
import {
  getAnnotationsForImage,
  createAnnotation as apiCreateAnnotation,
  updateAnnotation as apiUpdateAnnotation,
  deleteAnnotation as apiDeleteAnnotation,
} from '../services/annotationService';
import { useImageStore } from './imageStore';

export const useAnnotationStore = defineStore('annotation', {
  state: () => ({
    annotations: [], // Annotations for the currently active image
    loading: false,
    error: null,
  }),
  getters: {
    currentAnnotations: (state) => state.annotations,
    isLoading: (state) => state.loading,
    annotationError: (state) => state.error,
    currentClasses: (state) => {
      const classSet = new Set(state.annotations.map(ann => ann.label));
      return Array.from(classSet).sort();
    },
  },
  actions: {
    async fetchAnnotations(imageId) {
      if (!imageId) {
        this.annotations = [];
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const annotationsData = await getAnnotationsForImage(imageId);
        this.annotations = annotationsData;
      } catch (error) {
        this.error = error.message || 'Failed to load annotations';
        this.annotations = []; // Ensure annotations are cleared on error
      } finally {
        this.loading = false;
      }
    },

    async createAnnotation(imageId, annotationData, projectId) {
      this.loading = true;
      this.error = null;
      try {
        // apiCreateAnnotation POSTs to `/annotations/image/:imageId/set` 
        // which expects { boxes: [annotationData] } and returns { message, image, annotations: [createdAnn] }
        const backendResponse = await apiCreateAnnotation(imageId, annotationData);

        // Check if the backend response structure is as expected and contains the new annotation
        if (backendResponse && backendResponse.annotations && backendResponse.annotations.length > 0) {
          const newlyCreatedAnnotationFromServer = backendResponse.annotations[0]; // Assuming the first one is ours

          if (newlyCreatedAnnotationFromServer && newlyCreatedAnnotationFromServer._id) {
            // Successfully created and received the annotation from the server.
            // Add it directly to the local state.
            const existingIndex = this.annotations.findIndex(a => a._id === newlyCreatedAnnotationFromServer._id);
            if (existingIndex !== -1) {
              this.annotations[existingIndex] = newlyCreatedAnnotationFromServer;
            } else {
              this.annotations.push(newlyCreatedAnnotationFromServer);
            }

            const imageStore = useImageStore();
            // Update image in imageStore if backend sent it back (it contains updated annotation list and status)
            if (backendResponse.image && backendResponse.image._id) {
                const imageIndexInStore = imageStore.images.findIndex(img => img._id === backendResponse.image._id);
                if (imageIndexInStore !== -1) {
                    imageStore.images[imageIndexInStore] = backendResponse.image;
                } else {
                    // If image not found, maybe it's a new image or list is stale, add it or refetch.
                    // For simplicity here, we could push or decide to refetch all images.
                    // However, an image should ideally exist if we are annotating it.
                    // Fallback to refetch for safety if image not found by ID.
                    await imageStore.fetchImages(projectId); 
                }
            } else {
                await imageStore.fetchImages(projectId); // Fallback to refetch if image not in response
            }
            
            return newlyCreatedAnnotationFromServer; 
          } else {
            // Annotation in array is missing _id or is malformed
            console.error("Backend returned an annotation in the array, but it was malformed or missing _id.", newlyCreatedAnnotationFromServer);
            this.error = "Failed to process annotation from server: malformed data.";
            // Fallback to full refresh might be needed here if critical
            await this.fetchAnnotations(imageId); 
            return null;
          }
        } else {
          // Backend did not return the expected structure { annotations: [...] } or creation failed at service level.
          console.error("Backend response was not in the expected format { annotations: [...] } or service call failed.", backendResponse);
          this.error = "Failed to create annotation or server response was malformed.";
          // Fallback: refresh the entire list to try and get the latest state.
          await this.fetchAnnotations(imageId);
          
          const imageStore = useImageStore();
          await imageStore.fetchImages(projectId); // Update image status
          return null;
        }

      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to create annotation';
        console.error("Error in store createAnnotation:", error);
        // Even on error, try to refresh, as the backend state might have changed partially
        // or an error occurred after creation.
        if (imageId) {
            try {
                await this.fetchAnnotations(imageId);
            } catch (fetchError) {
                console.error("Failed to re-fetch annotations after create error:", fetchError);
            }
        }
        return null;
      } finally {
        this.loading = false;
      }
    },

    async updateAnnotation(annotationId, annotationData, imageId, projectId) {
      this.loading = true;
      this.error = null;
      try {
        const updatedAnnotation = await apiUpdateAnnotation(annotationId, annotationData);
        const index = this.annotations.findIndex(ann => ann._id === annotationId);
        if (index !== -1) {
          this.annotations[index] = updatedAnnotation;
        }
        return updatedAnnotation;
      } catch (error) {
        this.error = error.message || 'Failed to update annotation';
        return null;
      } finally {
        this.loading = false;
      }
    },

    async deleteAnnotation(annotationId, imageId, projectId) {
      this.loading = true;
      this.error = null;
      try {
        await apiDeleteAnnotation(annotationId);
        // Instead of filtering locally, re-fetch to ensure consistency with backend
        // this.annotations = this.annotations.filter(ann => ann._id !== annotationId);
        await this.fetchAnnotations(imageId); 
        
        const imageStore = useImageStore();
        await imageStore.fetchImages(projectId);
        return true;
      } catch (error) {
        this.error = error.message || 'Failed to delete annotation';
        return false;
      } finally {
        this.loading = false;
      }
    },
    
    clearAnnotations() {
      this.annotations = [];
      this.error = null;
    }
  },
});
