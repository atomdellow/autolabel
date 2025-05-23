import api from './api';

const trainingService = {    // Training job management  
  startTraining(projectId, trainingConfig) {
    console.log(`Training service: startTraining called with projectId ${projectId}`);
    
    // Check if trainingConfig is FormData
    if (trainingConfig instanceof FormData) {
      // First, extract all data from the FormData to create a JSON object
      const configObject = {};
      for (let [key, value] of trainingConfig.entries()) {
        configObject[key] = value;
      }
      console.log('Extracted FormData to object:', configObject);
      
      // Ensure required fields are present with proper types
      configObject.projectId = projectId; // Ensure projectId is always set
      
      // Add baseModelName if not present (required by controller)
      if (!configObject.baseModelName) {
        const modelType = configObject.modelType || 'yolov8n';
        configObject.baseModelName = modelType + '.pt';
        console.log(`Added baseModelName: ${configObject.baseModelName}`);
      }
      
      // Set appropriate content type for file uploads
      const hasFiles = trainingConfig.has('jsonFiles');
      
      if (hasFiles) {
        console.log('FormData contains files, sending as multipart/form-data');
        // For files, send the original FormData
        return api.post(`/training/project/${projectId}/start`, trainingConfig, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
      } else {
        console.log('FormData has no files, sending as JSON');
        // For JSON data only, convert to a plain object
        return api.post(`/training/project/${projectId}/start`, configObject, {
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }
    } else {
      // Regular JSON data - make sure baseModelName is set
      const configToUse = { ...trainingConfig };
      
      if (!configToUse.baseModelName) {
        configToUse.baseModelName = (configToUse.modelType || 'yolov8n') + '.pt';
        console.log(`Added baseModelName: ${configToUse.baseModelName}`);
      }
      
      return api.post(`/training/project/${projectId}/start`, configToUse);
    }
  },

  getTrainedModels(projectId) {
    return api.get(`/training/project/${projectId}/models`);
  },

  getAllTrainedModels() {
    return api.get('/training/models');
  },

  getTrainingStatus(projectId, jobId) {
    const path = jobId ? `/training/project/${projectId}/status/${jobId}` : `/training/project/${projectId}/status`;
    return api.get(path);
  },
  
  // Model management
  getModelDetails(modelId) {
    return api.get(`/training/models/${modelId}`);
  },
  
  exportModel(modelId, format = 'default') {
    return api.get(`/training/models/${modelId}/export?format=${format}`, {
      responseType: 'blob'
    });
  },
  
  activateModel(modelId) {
    return api.post(`/training/models/${modelId}/activate`);
  },
    deactivateModel(modelId) {
    return api.post(`/training/models/${modelId}/deactivate`);
  },
  
  deleteModel(modelId) {
    return api.delete(`/training/models/${modelId}`);
  },
  
  // Annotation import/export
  importAnnotations(projectId, formData) {
    return api.post(`/training/project/${projectId}/import-annotations`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  
  // Project data
  getProjectClasses(projectId) {
    return api.get(`/projects/${projectId}/classes`);
  },
  
  getProjects() {
    return api.get('/projects');
  },

  verifyTrainingPrerequisites(projectId) {
    return api.get(`/training/project/${projectId}/prerequisites`);
  },
};

export default trainingService;
