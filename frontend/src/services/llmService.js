// LLM Vision service for AI-powered annotation features
import apiClient from './api';

/**
 * Name annotations using LLM Vision API
 * Uses GPT-4 Vision to analyze image sections and generate meaningful names
 * 
 * @param {string} imageUrl - URL of the full image
 * @param {Array} annotations - Array of annotation objects
 * @returns {Promise<Array>} - Array of annotations with updated names/labels
 */
export const nameAnnotationsWithLLM = async (imageUrl, annotations) => {  try {
    // Input validation
    if (!imageUrl) {
      throw new Error('No image URL provided');
    }
    
    if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
      throw new Error('No annotations provided or invalid format');
    }
    
    // Call the backend API
    const response = await apiClient.post('/llm/name-annotations', {
      imageUrl,
      annotations
    }, {
      timeout: 60000, // 60 seconds timeout for LLM processing
    });
    
    return response.data;
  } catch (error) {
    console.error('Error naming annotations with LLM:', error);
    
    // Handle different error types more specifically
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const serverError = error.response.data?.error || error.response.statusText;
      throw new Error(`Server error: ${serverError}`);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response from server. The backend service might be unavailable.');
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(error.message || 'Failed to name annotations');
    }
  }
};
