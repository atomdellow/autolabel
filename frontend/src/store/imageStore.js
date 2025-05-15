import { defineStore } from 'pinia';
import {
  getImagesForProject,
  uploadImage as apiUploadImage,
  deleteImage as apiDeleteImage,
  updateImageTags as apiUpdateImageTags, // Import the new service function
} from '../services/imageService';

export const useImageStore = defineStore('image', {
  state: () => ({
    images: [],
    loading: false,
    error: null,
  }),
  getters: {
    allImages: (state) => state.images,
    unannotatedImages: (state) => state.images.filter(img => img.status === 'Unannotated'),
    annotatedImages: (state) => state.images.filter(img => img.status === 'Annotated'),
    isLoading: (state) => state.loading,
    imageError: (state) => state.error,
    getImageById: (state) => (imageId) => state.images.find(img => img._id === imageId),
  },
  actions: {
    async fetchImages(projectId) {
      if (!projectId) {
        this.images = [];
        return;
      }
      this.loading = true;
      this.error = null;
      try {
        const imagesData = await getImagesForProject(projectId);
        this.images = imagesData;
      } catch (error) {
        this.error = error.message || 'Failed to load images';
        this.images = [];
      } finally {
        this.loading = false;
      }
    },
    async uploadImage(projectId, formData) {
      this.loading = true;
      this.error = null;
      try {
        const newImage = await apiUploadImage(projectId, formData);
        // this.images.push(newImage); // Backend returns the new image
        await this.fetchImages(projectId); // Re-fetch to get the updated list and statuses
        return newImage;
      } catch (error) {
        this.error = error.message || 'Failed to upload image';
        return null;
      } finally {
        this.loading = false;
      }
    },
    async deleteImage(imageId, projectId) {
      this.loading = true;
      this.error = null;
      try {
        await apiDeleteImage(imageId);
        // this.images = this.images.filter(img => img._id !== imageId);
        await this.fetchImages(projectId); // Re-fetch to ensure consistency
      } catch (error) {
        this.error = error.message || 'Failed to delete image';
      } finally {
        this.loading = false;
      }
    },
    clearImages() {
      this.images = [];
      this.error = null;
    },
    clearError() {
      this.error = null;
    },

    async updateImageTags(imageId, tags) {
      this.loading = true;
      this.error = null;
      try {
        const updatedImage = await apiUpdateImageTags(imageId, tags);
        const index = this.images.findIndex(img => img._id === imageId);
        if (index !== -1) {
          this.images[index].tags = updatedImage.tags;
        }
        return updatedImage;
      } catch (error) {
        this.error = error.message || 'Failed to update image tags';
        // Potentially re-throw or handle more gracefully depending on UI needs
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});
