import apiClient from './api';

// Get all annotations for an image
export const getAnnotationsForImage = async (imageId) => {
  try {
    const response = await apiClient.get(`/annotations/image/${imageId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Create an annotation for an image
export const createAnnotation = async (imageId, annotationData) => {
  try {
    const payload = { boxes: [annotationData] };
    console.log('Attempting to send payload for annotation:', JSON.stringify(payload, null, 2)); // Added for debugging
    const response = await apiClient.post(`/annotations/image/${imageId}/set`, payload);
    return response.data;
  } catch (error) {
    console.error('Error in createAnnotation service:', error.response ? error.response.data : error.message, error);
    if (error.response) {
      throw error.response.data;
    } else {
      throw new Error('Network error or server did not respond');
    }
  }
};

// New function to set/replace all annotations for an image
export const setAllAnnotationsForImage = async (imageId, annotationsArray) => {
  try {
    const payload = { boxes: annotationsArray };
    const response = await apiClient.post(`/annotations/image/${imageId}/set`, payload);
    return response.data;
  } catch (error) {
    console.error('Error in setAllAnnotationsForImage service:', error.response ? error.response.data : error.message, error);
    if (error.response) {
      throw error.response.data;
    } else {
      throw new Error('Network error or server did not respond when setting all annotations');
    }
  }
};

// Update an annotation
export const updateAnnotation = async (annotationId, annotationData) => {
  try {
    const response = await apiClient.put(`/annotations/${annotationId}`, annotationData);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};

// Delete an annotation
export const deleteAnnotation = async (annotationId) => {
  try {
    const response = await apiClient.delete(`/annotations/${annotationId}`);
    return response.data;
  } catch (error) {
    throw error.response.data;
  }
};
