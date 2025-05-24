import apiClient from './api';
import { validateAnnotationData, normalizeAnnotationIds } from '../utils/annotationUtils';

// Get all annotations for an image
export const getAnnotationsForImage = async (imageId) => {
  try {
    const response = await apiClient.get(`/annotations/image/${imageId}`);
    
    // Normalize all annotations to ensure consistent id fields
    const normalizedAnnotations = response.data.map(annotation => 
      normalizeAnnotationIds(annotation)
    );
    
    return normalizedAnnotations;
  } catch (error) {
    throw error.response.data;
  }
};

// Import annotations from JSON for an image
export const importAnnotationsFromJson = async (imageId, annotations, format = 'default', mergeStrategy = 'replace') => {
  try {
    const payload = { 
      annotations,
      format,
      mergeStrategy 
    };
    const response = await apiClient.post(`/annotations/image/${imageId}/import`, payload);
    return response.data;
  } catch (error) {
    console.error('Error in importAnnotationsFromJson service:', error.response ? error.response.data : error.message, error);
    if (error.response) {
      throw error.response.data;
    } else {
      throw new Error('Network error or server did not respond');
    }
  }
};

// Create an annotation for an image
// WARNING: This function uses /annotations/image/:imageId/set which DELETES ALL existing annotations before creating new ones
// Use setAllAnnotationsForImage instead for adding a new annotation while preserving existing ones
export const createAnnotation = async (imageId, annotationData) => {
  try {
    const payload = { boxes: [annotationData] };
    console.warn('WARNING: createAnnotation is using /annotations/image/:imageId/set which deletes all existing annotations. ' +
                'Use setAllAnnotationsForImage instead to preserve existing annotations.');
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
    // Validate and normalize all annotations
    const validatedAnnotations = annotationsArray.map(annotation => {
      // Make sure each annotation has all required fields and consistent ID fields
      const validated = validateAnnotationData(annotation, imageId);
      return {
        id: validated.id, // Backend expects 'id'
        label: validated.label,
        x: Number(validated.x),
        y: Number(validated.y),
        width: Number(validated.width), 
        height: Number(validated.height),
        confidence: validated.confidence,
        color: validated.color,
        layerOrder: validated.layerOrder
      };
    });
    
    const payload = { boxes: validatedAnnotations };
    const response = await apiClient.post(`/annotations/image/${imageId}/set`, payload);
    
    // Normalize all annotations in the response
    if (response.data && response.data.annotations) {
      response.data.annotations = response.data.annotations.map(annotation => 
        normalizeAnnotationIds(annotation)
      );
    }
    
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
