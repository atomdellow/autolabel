import { defineStore } from 'pinia';
import trainingService from '../services/trainingService';

export const useTrainingStore = defineStore('training', {
  state: () => ({
    // Training configuration (can be pre-filled or set by user)
    trainingConfig: {
      baseModelName: 'yolov8n.pt', // Default model
      epochs: 50,
      batchSize: 16,
      imgSize: 640,
      trainSplit: 0.8, // 80% for training, 20% for validation
      // Add other parameters as needed, e.g., learning_rate, patience
    },
    trainedModels: [], // List of trained models for the current project
    currentTrainingJob: {
      jobId: null, // Could be a timestamp or a specific ID from the backend
      status: 'idle', // e.g., 'idle', 'preparing', 'training', 'completed', 'failed'
      progress: 0, // Percentage or step-based
      logs: [], // Array of log messages from the training script
      startTime: null,
      endTime: null,
    },
    isLoadingModels: false,
    isLoadingStatus: false,
    isStartingTraining: false,
    error: null, // For general errors in the store
    modelsError: null, // For errors specific to fetching models
    statusError: null, // For errors specific to fetching status
    startTrainingError: null, // For errors specific to starting training
  }),
  actions: {
    // Action to update training configuration
    setTrainingConfig(newConfig) {
      this.trainingConfig = { ...this.trainingConfig, ...newConfig };
    },

    // Action to start the training process
    async startTraining(projectId) {
      this.isStartingTraining = true;
      this.startTrainingError = null;
      this.currentTrainingJob = { // Reset job details
        jobId: null,
        status: 'preparing',
        progress: 0,
        logs: ['Initiating training...'],
        startTime: new Date().toISOString(),
        endTime: null,
      };
      try {
        const response = await trainingService.startTraining(projectId, this.trainingConfig);
        // Backend might return an initial job ID or status
        if (response.data && response.data.jobId) {
          this.currentTrainingJob.jobId = response.data.jobId;
        }
        this.currentTrainingJob.status = 'training'; // Or as indicated by backend
        this.currentTrainingJob.logs.push(response.data.message || 'Training process started successfully.');
        // Optionally, start polling for status immediately
        // this.fetchTrainingStatus(projectId, response.data.jobId);
      } catch (err) {
        this.startTrainingError = err.response?.data?.message || err.message || 'Failed to start training.';
        this.currentTrainingJob.status = 'failed';
        this.currentTrainingJob.logs.push(`Error: ${this.startTrainingError}`);
        this.currentTrainingJob.endTime = new Date().toISOString();
      } finally {
        this.isStartingTraining = false;
      }
    },

    // Action to fetch the list of trained models
    async fetchTrainedModels(projectId) {
      this.isLoadingModels = true;
      this.modelsError = null;
      try {
        const response = await trainingService.getTrainedModels(projectId);
        this.trainedModels = response.data.map(model => ({
          ...model,
          // Frontend specific properties can be added here if needed
          // e.g., a display name or a download link
        }));
      } catch (err) {
        this.modelsError = err.response?.data?.message || err.message || 'Failed to fetch trained models.';
        this.trainedModels = []; // Clear models on error
      } finally {
        this.isLoadingModels = false;
      }
    },

    // Action to fetch the status of a training job
    async fetchTrainingStatus(projectId, jobId) {
      // If no jobId is provided, and we have one in currentTrainingJob, use that.
      const effectiveJobId = jobId || this.currentTrainingJob.jobId;
      if (!effectiveJobId && this.currentTrainingJob.status !== 'training' && this.currentTrainingJob.status !== 'preparing') {
        // Don't fetch if no job ID and not actively training/preparing
        // or if we want to fetch general project status, the backend API needs to support it
        return;
      }

      this.isLoadingStatus = true;
      this.statusError = null;
      try {
        const response = await trainingService.getTrainingStatus(projectId, effectiveJobId);
        const { status, progress, logs, startTime, endTime, message } = response.data;

        this.currentTrainingJob.status = status || this.currentTrainingJob.status;
        this.currentTrainingJob.progress = progress || this.currentTrainingJob.progress;
        if (logs && Array.isArray(logs)) {
          // Append new logs or replace, depending on backend behavior
          this.currentTrainingJob.logs = [...this.currentTrainingJob.logs, ...logs.filter(l => !this.currentTrainingJob.logs.includes(l))];
        } else if (message && !this.currentTrainingJob.logs.includes(message)) {
            this.currentTrainingJob.logs.push(message);
        }
        if (startTime) this.currentTrainingJob.startTime = startTime;
        if (endTime) this.currentTrainingJob.endTime = endTime;


        // If training is completed or failed, stop polling (logic to be handled by the component)
      } catch (err) {
        this.statusError = err.response?.data?.message || err.message || 'Failed to fetch training status.';
        // Potentially set status to 'unknown' or 'error_fetching_status'
        // this.currentTrainingJob.status = 'unknown';
      } finally {
        this.isLoadingStatus = false;
      }
    },

    // Clear training status and messages
    clearTrainingState() {
      this.currentTrainingJob = {
        jobId: null, status: 'idle', progress: 0, logs: [], startTime: null, endTime: null,
      };
      this.isStartingTraining = false;
      this.isLoadingStatus = false;
      this.startTrainingError = null;
      this.statusError = null;
      // Optionally keep models and modelsError, or clear them too
      // this.trainedModels = [];
      // this.modelsError = null;
    },

    // Utility to add a log message manually from the frontend if needed
    addLogMessage(message) {
      if (this.currentTrainingJob) {
        this.currentTrainingJob.logs.push(`[UI] ${message}`);
      }
    }
  },
  getters: {
    // Example getter: is a training job currently active?
    isTrainingActive: (state) => {
      return state.currentTrainingJob.status === 'preparing' || state.currentTrainingJob.status === 'training';
    },
    // Getter for formatted logs
    formattedLogs: (state) => {
      return state.currentTrainingJob.logs.join('\\n');
    }
  }
});
