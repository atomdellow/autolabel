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

// Utility function to get the full URL for an image
export const getImageUrl = (relativeUrl) => {
  if (!relativeUrl) {
    console.error('Empty or null URL passed to getImageUrl');
    return '';
  }
  
  // For debugging
  console.log('getImageUrl called with:', relativeUrl);
  
  // If this is a route path rather than an image path, don't use it
  if (relativeUrl.includes('/project/') || relativeUrl.includes('/annotate')) {
    console.error('Invalid image path detected (appears to be a route):', relativeUrl);
    return '';
  }
  
  // For backend paths like /uploads/xxx, we need to append to base URL
  const baseUrl = apiClient.defaults.baseURL.replace('/api', '');
  console.log('Base URL:', baseUrl);
  
  // If the URL already has http/https, don't prepend the base URL
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    console.log('Returning absolute URL:', relativeUrl);
    return relativeUrl;
  }
  
  // Handle direct path specified in the DB
  if (relativeUrl.includes('/image-')) {
    // If this is a direct path like /uploads/image-1234567890.png
    console.log('Direct path detected, ensuring proper formatting');
    
    // Extract filename only if it's a full path
    const pathParts = relativeUrl.split('/');
    const filename = pathParts[pathParts.length - 1];
    
    // Ensure proper uploads path
    if (relativeUrl.startsWith('/uploads/')) {
      console.log('Already in uploads directory:', relativeUrl);
    } else {
      relativeUrl = `/uploads/${filename}`;
      console.log('Corrected path to:', relativeUrl);
    }
  }
  
  // Make sure the URL doesn't have double slashes
  const separator = relativeUrl.startsWith('/') ? '' : '/';
  const fullUrl = `${baseUrl}${separator}${relativeUrl}`;
  
  console.log('Constructed full URL:', fullUrl);
  return fullUrl;
};

// Check if the image URL is valid (returns an image, not a redirect or error)
export const verifyImageUrl = async (url) => {
  if (!url) {
    return false;
  }
  
  try {
    // Use fetch to check the headers without downloading the full image
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      console.error(`Image URL verification failed with status: ${response.status}`);
      return false;
    }
    
    const contentType = response.headers.get('content-type');
    return contentType && contentType.startsWith('image/');
  } catch (error) {
    console.error('Error verifying image URL:', error);
    return false;
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
