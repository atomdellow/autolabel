import { defineStore } from 'pinia';
import {
  getAnnotationsForImage,
  createAnnotation as apiCreateAnnotation,
  updateAnnotation as apiUpdateAnnotation,
  deleteAnnotation as apiDeleteAnnotation,
  setAllAnnotationsForImage,
  importAnnotationsFromJson,
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
    
    async setAllAnnotationsForImage(imageId, annotationsArray, projectId) {
      this.loading = true;
      this.error = null;
      
      try {
        console.log(`Store: Setting all annotations for image: ${imageId} (${annotationsArray.length} annotations)`);
        const backendResponse = await setAllAnnotationsForImage(imageId, annotationsArray);
        
        if (backendResponse && backendResponse.annotations) {
          console.log(`Store: Received ${backendResponse.annotations.length} annotations from server after setting all`);
          
          // Update the local annotations with the server response
          this.annotations = backendResponse.annotations;
          
          // Update image in imageStore if needed
          const imageStore = useImageStore();
          if (projectId) {
            await imageStore.fetchImages(projectId);
          } else if (backendResponse.image && backendResponse.image._id) {
            const imageIndexInStore = imageStore.images.findIndex(img => img._id === backendResponse.image._id);
            if (imageIndexInStore !== -1) {
                imageStore.images[imageIndexInStore] = backendResponse.image;
            }
          }
          
          return backendResponse;
        } else {
          console.error("Backend response was not in the expected format { annotations: [...] } or service call failed.", backendResponse);
          this.error = "Failed to set annotations or server response was malformed.";
          await this.fetchAnnotations(imageId);
          return null;
        }
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to set annotations';
        console.error("Error in store setAllAnnotationsForImage:", error);
        
        // Try to refresh annotations on error
        if (imageId) {
          try {
            await this.fetchAnnotations(imageId);
          } catch (fetchError) {
            console.error("Failed to re-fetch annotations after setting all annotations error:", fetchError);
          }
        }
        return null;
      } finally {
        this.loading = false;
      }
    },    
    async createAnnotation(annotationData, projectId, imageId) {
      this.loading = true;
      this.error = null;
      try {
        console.log(`Store: Creating annotation for image: ${imageId}`);        // IMPORTANT: The backend endpoint /annotations/image/:imageId/set first DELETES ALL existing annotations
        // for this image and then creates the new one(s). 
        // Instead of just sending the new annotation, we'll send all existing ones plus the new one
        // To ensure latest annotations are preserved correctly in the undo stack, place the new annotation at the end
        const allAnnotations = [...this.annotations, annotationData];
        const backendResponse = await setAllAnnotationsForImage(imageId, allAnnotations);

        // Check if the backend response structure is as expected and contains the new annotation
        if (backendResponse && backendResponse.annotations && backendResponse.annotations.length > 0) {
          console.log(`Store: Received ${backendResponse.annotations.length} annotations from server after creation`);
          const newlyCreatedAnnotationFromServer = backendResponse.annotations[0]; // Assuming the first one is ours

          if (newlyCreatedAnnotationFromServer && newlyCreatedAnnotationFromServer._id) {
            console.log(`Store: Successfully created annotation with ID: ${newlyCreatedAnnotationFromServer._id}`);
            
            // Since the backend replaces ALL annotations, we should replace our local collection
            // to maintain consistency instead of just adding the new annotation
            this.annotations = backendResponse.annotations;
            console.log(`Store: Updated local annotations array with server response (${backendResponse.annotations.length} annotations)`);

            const imageStore = useImageStore();
            // Update image in imageStore if backend sent it back (it contains updated annotation list and status)
            if (backendResponse.image && backendResponse.image._id) {
                const imageIndexInStore = imageStore.images.findIndex(img => img._id === backendResponse.image._id);
                if (imageIndexInStore !== -1) {
                    imageStore.images[imageIndexInStore] = backendResponse.image;
                    console.log(`Store: Updated image in imageStore with ID: ${backendResponse.image._id}`);
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
    },    async updateAnnotation(annotationId, annotationData, projectId, imageId) { // Added imageId for consistency
      this.loading = true;
      this.error = null;
      try {
        console.log(`Store: Attempting to update annotation with ID: ${annotationId}`);
        
        // First check if the annotation exists in our local state
        const annotationExists = this.annotations.some(ann => ann._id === annotationId);
        if (!annotationExists) {
          console.warn(`Cannot update annotation: Annotation with ID ${annotationId} not found in local store`);
          this.error = `Annotation with ID: ${annotationId} not found in local store.`;
          
          // If imageId is provided, refresh annotations to get current state
          if (imageId) {
            console.log(`Refreshing annotations for image ${imageId} since we couldn't find annotation ${annotationId}`);
            await this.fetchAnnotations(imageId);
          }
          return null;
        }
        
        // Proceed with the update
        const updatedAnnotationFromServer = await apiUpdateAnnotation(annotationId, annotationData);
        if (updatedAnnotationFromServer && updatedAnnotationFromServer._id) {
          console.log(`Store: Successfully updated annotation with ID: ${annotationId}`);
          const index = this.annotations.findIndex(ann => ann._id === annotationId);
          if (index !== -1) {
            this.annotations[index] = { ...this.annotations[index], ...updatedAnnotationFromServer };
          }

          // After successful update, update the image in imageStore
          const imageStore = useImageStore();
          if (projectId) { // projectId is crucial for fetching images of a project
            // Option 1: Refetch all images for the project to update statuses
            await imageStore.fetchImages(projectId);
            console.log(`Store: Updated image store for project: ${projectId} after annotation update`);
            
            // If imageId is also available, we could potentially fetch just that image
            // if (imageId) { await imageStore.fetchImageById(projectId, imageId); }
          } else {
            console.warn('updateAnnotation: projectId not provided, cannot refresh imageStore effectively.');
          }

          return updatedAnnotationFromServer;
        } else {
          console.error("Backend returned malformed data on update for annotationId:", annotationId, updatedAnnotationFromServer);
          this.error = "Failed to update annotation: malformed server response.";
          // Optionally, refetch the specific annotation or all annotations for the image to ensure consistency
          if (imageId) await this.fetchAnnotations(imageId);
          return null;
        }
      } catch (error) {
        // Handle 404 errors specifically
        if (error.response && error.response.status === 404) {
          console.warn(`Store: Annotation with ID: ${annotationId} not found on server (404). Refreshing local state.`);
          this.error = `Annotation with ID: ${annotationId} not found on server.`;
        } else {
          this.error = error.response?.data?.message || error.message || 'Failed to update annotation';
          console.error("Error in store updateAnnotation:", error);
        }
        
        // Always refresh annotations on error to ensure UI consistency with backend state
        if (imageId) {
          try {
            console.log(`Store: Re-fetching annotations for image: ${imageId} after update error`);
            await this.fetchAnnotations(imageId);
          } catch (fetchError) {
            console.error("Failed to re-fetch annotations after update error:", fetchError);
          }
        }
        return null;
      } finally {
        this.loading = false;
      }
    },

    async deleteAnnotation(annotationId, imageId, projectId) {
      this.loading = true;
      this.error = null;
      try {
        console.log(`Store: Attempting to delete annotation with ID: ${annotationId}`);
        await apiDeleteAnnotation(annotationId); // Backend deletes the specific annotation
        console.log(`Store: Successfully deleted annotation with ID: ${annotationId} from server`);
        
        // Successfully deleted from backend, now update local state
        const index = this.annotations.findIndex(ann => ann._id === annotationId);
        if (index !== -1) {
          this.annotations.splice(index, 1);
          console.log(`Store: Removed annotation with ID: ${annotationId} from local store`);
        } else {
          // If not found, it might have been already removed or list is out of sync.
          // A targeted fetch might be good here, but for now, this is simpler.
          console.warn(`Annotation with id ${annotationId} not found in local store for deletion, fetching fresh list.`);
          await this.fetchAnnotations(imageId); // Fallback to refetch if local removal is problematic
        }
        
        // Update the image status in the image store
        const imageStore = useImageStore();
        // We need to update the specific image, or at least its project's list
        // A simple way is to refetch the image itself or the project's images
        // For now, let's refetch the project's images to update the status of the current image
        if (projectId) {
            await imageStore.fetchImages(projectId);
            console.log(`Store: Updated image store for project: ${projectId} after annotation deletion`);
        } else {
            console.warn("deleteAnnotation: projectId not provided, cannot refresh imageStore effectively.");
        }

        return true;
      } catch (error) {
        // Handle 404 errors more specifically
        if (error.response && error.response.status === 404) {
          console.warn(`Store: Annotation with ID: ${annotationId} not found on server (404). Refreshing local state.`);
          this.error = `Annotation with ID: ${annotationId} not found on server.`;
        } else {
          this.error = error.response?.data?.message || error.message || 'Failed to delete annotation';
          console.error(`Store: Error deleting annotation with ID: ${annotationId}:`, error);
        }
        
        // Always refetch annotations on error to ensure UI consistency with backend state
        if (imageId) {
            try {
                console.log(`Store: Re-fetching annotations for image: ${imageId} after delete error`);
                await this.fetchAnnotations(imageId);
            } catch (fetchError) {
                console.error("Failed to re-fetch annotations after delete error:", fetchError);
            }
        }
        return false;
      } finally {
        this.loading = false;
      }
    },

    async importAnnotationsFromJson(imageId, annotations, format = 'default', mergeStrategy = 'replace', projectId) {
      this.loading = true;
      this.error = null;
      
      try {
        console.log(`Store: Importing annotations for image: ${imageId} (${annotations.length} annotations), format: ${format}, strategy: ${mergeStrategy}`);
        const backendResponse = await importAnnotationsFromJson(imageId, annotations, format, mergeStrategy);
        
        if (backendResponse && backendResponse.annotations) {
          console.log(`Store: Received ${backendResponse.annotations.length} annotations from server after import`);
          this.annotations = backendResponse.annotations;
          
          // Update image in imageStore if needed
          const imageStore = useImageStore();
          if (projectId) {
            await imageStore.fetchImages(projectId);
          } else if (backendResponse.image && backendResponse.image._id) {
            const imageIndexInStore = imageStore.images.findIndex(img => img._id === backendResponse.image._id);
            if (imageIndexInStore !== -1) {
              imageStore.images[imageIndexInStore] = backendResponse.image;
            }
          }
          
          return backendResponse;
        } else {
          console.error("Backend response was not in the expected format or service call failed.", backendResponse);
          this.error = "Failed to import annotations or server response was malformed.";
          await this.fetchAnnotations(imageId);
          return null;
        }
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to import annotations';
        console.error("Error in store importAnnotationsFromJson:", error);
        
        if (imageId) {
          try {
            await this.fetchAnnotations(imageId);
          } catch (fetchError) {
            console.error("Failed to re-fetch annotations after import error:", fetchError);
          }
        }
        return null;
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
