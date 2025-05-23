import { defineStore } from 'pinia';
import {
  getImagesForProject,
  uploadImage as apiUploadImage,
  deleteImage as apiDeleteImage,
  updateImageTags as apiUpdateImageTags,
  getImageUrl
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
    },    clearError() {
      this.error = null;
    },    // Load a single image by ID, assuming it's already in the store
    // or fetch it from the project if needed
    async loadImage(imageId) {
      if (!imageId) {
        console.error('No imageId provided to loadImage');
        return null;
      }
      
      this.loading = true;
      this.error = null;
      
      try {
        // Check if the image is already in the store
        let image = this.getImageById(imageId);
        
        // If not found and we don't have any images loaded, we can't load it
        if (!image && this.images.length === 0) {
          this.error = 'Image not found and no project context to load from';
          console.error('Image not found in store:', imageId);
          return null;
        }
        
        // Verify the image has a proper URL or path
        if (image) {
          console.log('Image found:', image);
          
          // Import needed utility functions 
          const { constructImageUrl, isValidPath } = await import('../utils/imageUtils');
          
          // Try to construct a valid image URL using our utility function
          if (constructImageUrl) {
            const validUrl = constructImageUrl(image);
            if (validUrl && validUrl !== image.url) {
              console.log('Constructed better URL for image:', validUrl);
              image.url = validUrl;
            }
          } else {
            // Fallback to legacy path handling if utility isn't available
            
            // Check for path field - this is the raw filesystem path
            if (image.path && !image.url) {
              if (isValidPath && isValidPath(image.path)) {
                image.url = image.path;
                console.log('Using image path as URL:', image.path);
              } else {
                image.url = `/uploads/images/${image.path.split('/').pop()}`;
                console.log('Using extracted filename from path:', image.url);
              }
            }
            
            // If we still don't have a URL but have a filename, construct one
            if (!image.url && image.filename) {
              image.url = `/uploads/images/${image.filename}`;
              console.log('Constructed URL from filename:', image.url);
            }
            
            // If we still don't have a URL but have a name, try that
            if (!image.url && image.name) {
              image.url = `/uploads/images/${image.name}`;
              console.log('Constructed URL from name:', image.url);
            }
          }
          
          // Make sure the URL is a valid image path, not a route path
          if (image.url && (image.url.startsWith('/project/') || image.url === window.location.pathname)) {
            console.warn('Invalid image URL detected:', image.url);
            console.warn('This appears to be a route path, not an image path');
            // Try to extract filename from image object
            if (image.filename) {
              image.url = `/uploads/images/${image.filename}`;
              console.log('Corrected image URL to:', image.url);
            } else if (image.name) {
              image.url = `/uploads/images/${image.name}`;
              console.log('Corrected image URL using name:', image.url);
            } else if (image.path) {
              image.url = image.path;
              console.log('Using path as fallback:', image.path);
            } else {
              this.error = 'Invalid image URL format and no fallback available';
              return null;
            }
          }
          
          if (!image.url) {
            console.error('Image found but has no URL, path, filename or name:', image);
            this.error = 'Image URL not available';
            return null;
          }
        } else {
          this.error = 'Image not found';
          return null;
        }
        
        // Return the image if found
        return image;
      } catch (error) {
        this.error = error.message || 'Failed to load image';
        console.error('Error in loadImage:', error);
        return null;
      } finally {
        this.loading = false;
      }
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
