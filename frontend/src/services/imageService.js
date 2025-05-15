import apiClient from './api';

// Get all images for a project
export const getImagesForProject = async (projectId) => {
  try {
    const response = await apiClient.get(`/images/project/${projectId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Upload image to a project
export const uploadImage = async (projectId, formData) => {
  try {
    const response = await apiClient.post(`/images/project/${projectId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Get a specific image by ID
export const getImageById = async (imageId) => {
  try {
    const response = await apiClient.get(`/images/${imageId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Delete an image by ID
export const deleteImage = async (imageId) => {
  try {
    const response = await apiClient.delete(`/images/${imageId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Update tags for an image
export const updateImageTags = async (imageId, tags) => {
  try {
    const response = await apiClient.put(`/images/${imageId}/tags`, { tags });
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};
