import api from './api';

const trainingService = {
  startTraining(projectId, trainingConfig) {
    return api.post(`/training/project/${projectId}/start`, trainingConfig);
  },

  getTrainedModels(projectId) {
    return api.get(`/training/project/${projectId}/models`);
  },

  getTrainingStatus(projectId, jobId) { // Assuming a jobId might be relevant later
    // If no specific jobId, the backend might return status for the project's latest/active job
    const path = jobId ? `/training/project/${projectId}/status/${jobId}` : `/training/project/${projectId}/status`;
    return api.get(path);
  }
  // Add other training related API calls here if needed
};

export default trainingService;
