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
        const response = await apiCreateAnnotation(imageId, annotationData);

        if (response && response.annotations && response.annotations.length > 0) {
          await this.fetchAnnotations(imageId);
          const imageStore = useImageStore();
          await imageStore.fetchImages(projectId);
          return response.annotations[0];
        } else if (response && response.message === 'Annotations set successfully' && response.image) {
          await this.fetchAnnotations(imageId);
          const imageStore = useImageStore();
          await imageStore.fetchImages(projectId);
          const newAnn = this.annotations.find(a => 
            a.label === annotationData.label && 
            Math.abs(a.x - annotationData.x) < 0.001 && 
            Math.abs(a.y - annotationData.y) < 0.001
          );
          return newAnn || null;
        } else {
          console.error("Unexpected response from createAnnotation service:", response);
          this.error = "Failed to create annotation: unexpected server response.";
          return null;
        }
      } catch (error) {
        this.error = error.message || 'Failed to create annotation';
        console.error("Error in store createAnnotation:", error);
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
        this.annotations = this.annotations.filter(ann => ann._id !== annotationId);
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
