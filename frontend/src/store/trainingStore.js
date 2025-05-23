import { defineStore } from 'pinia';
import trainingService from '../services/trainingService';

export const useTrainingStore = defineStore('training', {
  state: () => ({
    // Training configuration (can be pre-filled or set by user)
    trainingConfig: {
      modelType: 'yolov8n',
      baseModelName: 'yolov8n.pt', // Default model
      epochs: 50,
      batchSize: 16,
      imgSize: 640,
      trainSplit: 0.8, // 80% for training, 20% for validation
      useGPU: true,
      annotations: [],
      classNames: []
    },
    trainedModels: [], // List of trained models
    projects: [], // List of available projects
    selectedProjectId: null,
    currentTrainingJob: {
      jobId: null,
      status: 'idle', // idle, preparing, training, completed, failed
      progress: 0,
      logs: [],
      startTime: null,
      endTime: null,
      model: null, // Reference to the model being trained
    },
    isLoadingModels: false,
    isLoadingProjects: false,
    isLoadingStatus: false,
    isStartingTraining: false,
    isImportingAnnotations: false,
    error: null,
    modelsError: null,
    statusError: null,
    startTrainingError: null,
    importError: null,
  }),
  
  actions: {
    // Configuration
    setTrainingConfig(newConfig) {
      this.trainingConfig = { ...this.trainingConfig, ...newConfig };
    },

    // Projects
    async fetchProjects() {
      this.isLoadingProjects = true;
      try {
        const response = await trainingService.getProjects();
        this.projects = response.data;
        return this.projects;
      } catch (error) {
        this.error = error.message || 'Failed to fetch projects';
        throw error;
      } finally {
        this.isLoadingProjects = false;
      }
    },
    
    setSelectedProject(projectId) {
      this.selectedProjectId = projectId;
      return projectId;
    },
      async fetchProjectClasses(projectId) {
      try {
        const response = await trainingService.getProjectClasses(projectId);
        const classes = response.data;
        this.trainingConfig.classNames = classes.map(c => c.name);
        return classes;
      } catch (error) {
        this.error = error.message || 'Failed to fetch project classes';
        throw error;
      }
    },

    // Training
    async startTraining(trainingConfig) {
      this.isStartingTraining = true;
      this.startTrainingError = null;
      this.currentTrainingJob = {
        jobId: null,
        status: 'preparing',
        progress: 0,
        logs: ['Initiating training...'],
        startTime: new Date().toISOString(),
        endTime: null,
        model: null,
      };
      try {
        // Check if trainingConfig is FormData
        if (trainingConfig instanceof FormData) {
          const projectId = trainingConfig.get('projectId');
          console.log('Starting training with project ID (from FormData):', projectId);
          
          if (!projectId) {
            throw new Error('No project ID found in form data');
          }
          
          // Check if projectId is in valid MongoDB ObjectId format (24 hex characters)
          const objectIdPattern = /^[0-9a-fA-F]{24}$/;
          if (!objectIdPattern.test(projectId)) {
            throw new Error(`Invalid project ID format: ${projectId}`);
          }
          
          // Ensure baseModelName is included
          if (!trainingConfig.get('baseModelName')) {
            const modelType = trainingConfig.get('modelType') || 'yolov8n';
            trainingConfig.append('baseModelName', `${modelType}.pt`);
            console.log(`Added baseModelName: ${modelType}.pt to FormData`);
          }
          
          // Log form data values for debugging
          console.log('FormData values:');
          for (let [key, value] of trainingConfig.entries()) {
            console.log(`${key}: ${value}`);
          }
          
          const response = await trainingService.startTraining(projectId, trainingConfig);
          
          if (response.data && response.data.jobId) {
            this.currentTrainingJob.jobId = response.data.jobId;
          }
          
          this.currentTrainingJob.status = 'training';
          this.currentTrainingJob.model = response.data.model || {
            modelType: trainingConfig.get('modelType'),
            totalEpochs: trainingConfig.get('epochs')
          };
        } else {
          // Handle regular object configuration
          const configToUse = trainingConfig || this.trainingConfig;
          const projectId = configToUse.projectId || this.selectedProjectId;
          
          console.log('Starting training with project ID (from object):', projectId);
          
          if (!projectId) {
            throw new Error('No project selected for training');
          }
          
          const response = await trainingService.startTraining(projectId, configToUse);
          
          if (response.data && response.data.jobId) {
            this.currentTrainingJob.jobId = response.data.jobId;
          }
          
          this.currentTrainingJob.status = 'training';
          this.currentTrainingJob.model = response.data.model || {
            modelType: configToUse.modelType,
            totalEpochs: configToUse.epochs
          };
        }
        
        this.currentTrainingJob.logs.push('Training process started successfully.');
        
        return {
          jobId: this.currentTrainingJob.jobId,
          status: this.currentTrainingJob.status,
          model: this.currentTrainingJob.model
        };
      } catch (err) {
        this.startTrainingError = err.response?.data?.message || err.message || 'Failed to start training';
        this.currentTrainingJob.status = 'failed';
        this.currentTrainingJob.logs.push(`Error: ${this.startTrainingError}`);
        this.currentTrainingJob.endTime = new Date().toISOString();
        throw err;
      } finally {
        this.isStartingTraining = false;
      }
    },

    // Models management
    async fetchTrainedModels() {
      this.isLoadingModels = true;
      this.modelsError = null;
      try {
        let response;
        
        // If project is selected, get models for that project
        if (this.selectedProjectId) {
          response = await trainingService.getTrainedModels(this.selectedProjectId);
        } else {
          // Otherwise get all models
          response = await trainingService.getAllTrainedModels();
        }
        
        this.trainedModels = response.data;
        return this.trainedModels;
      } catch (err) {
        this.modelsError = err.response?.data?.message || err.message || 'Failed to fetch trained models';
        this.trainedModels = [];
        throw err;
      } finally {
        this.isLoadingModels = false;
      }
    },
    
    async getModelDetails(modelId) {
      try {
        const response = await trainingService.getModelDetails(modelId);
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to get model details';
        throw error;
      }
    },
    
    async exportModel(modelId, format = 'default') {
      try {
        const response = await trainingService.exportModel(modelId, format);
        // Handle blob response
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `model-${modelId}.pt`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return true;
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to export model';
        throw error;
      }
    },
    
    async activateModel(modelId) {
      try {
        const response = await trainingService.activateModel(modelId);
        // Update models list to reflect active status
        await this.fetchTrainedModels();
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to activate model';
        throw error;
      }
    },
    
    async deleteModel(modelId) {
      try {
        await trainingService.deleteModel(modelId);
        // Remove from local state
        this.trainedModels = this.trainedModels.filter(model => model._id !== modelId);
        return true;
      } catch (error) {
        this.error = error.response?.data?.message || error.message || 'Failed to delete model';
        throw error;
      }
    },

    // Training status
    async checkTrainingStatus() {
      this.isLoadingStatus = true;
      this.statusError = null;
      try {
        const jobId = this.currentTrainingJob.jobId;
        const projectId = this.selectedProjectId;
        
        if (!projectId) {
          // If no project is selected, we'll just return a default status
          // indicating no training is in progress
          return {
            status: 'idle',
            progress: 0,
            inProgress: false,
            model: null
          };
        }
        
        const response = await trainingService.getTrainingStatus(projectId, jobId);
        const data = response.data;
        
        // Update training job details
        this.currentTrainingJob.status = data.status || this.currentTrainingJob.status;
        this.currentTrainingJob.progress = data.progress || this.currentTrainingJob.progress;
        
        // Update logs if available
        if (data.logs && Array.isArray(data.logs)) {
          // Add only new logs
          const newLogs = data.logs.filter(log => !this.currentTrainingJob.logs.includes(log));
          this.currentTrainingJob.logs = [...this.currentTrainingJob.logs, ...newLogs];
        }
        
        // Update model information
        if (data.model) {
          this.currentTrainingJob.model = data.model;
        }
        
        // Update timestamps
        if (data.startTime) this.currentTrainingJob.startTime = data.startTime;
        if (data.endTime) this.currentTrainingJob.endTime = data.endTime;
        
        return {
          status: this.currentTrainingJob.status,
          progress: this.currentTrainingJob.progress,
          inProgress: ['preparing', 'training'].includes(this.currentTrainingJob.status),
          model: this.currentTrainingJob.model
        };
      } catch (err) {
        this.statusError = err.response?.data?.message || err.message || 'Failed to fetch training status';
        throw err;
      } finally {
        this.isLoadingStatus = false;
      }
    },

    // Annotation import
    async importAnnotations(data) {
      this.isImportingAnnotations = true;
      this.importError = null;
      
      try {
        const projectId = data.projectId || this.selectedProjectId;
        
        if (!projectId) {
          throw new Error('No project selected for importing annotations');
        }
        
        // Create form data for file upload
        const formData = new FormData();
        
        // Add files
        if (data.files && Array.isArray(data.files)) {
          data.files.forEach(file => {
            formData.append('files', file);
          });
        }
        
        // Add options
        if (data.options) {
          formData.append('options', JSON.stringify(data.options));
        }
        
        const response = await trainingService.importAnnotations(projectId, formData);
        return response.data;
      } catch (error) {
        this.importError = error.response?.data?.message || error.message || 'Failed to import annotations';
        throw error;
      } finally {
        this.isImportingAnnotations = false;
      }
    },

    // Reset training state
    clearTrainingState() {
      this.currentTrainingJob = {
        jobId: null, 
        status: 'idle', 
        progress: 0, 
        logs: [], 
        startTime: null, 
        endTime: null,
        model: null
      };
      this.isStartingTraining = false;
      this.isLoadingStatus = false;
      this.startTrainingError = null;
      this.statusError = null;
      this.importError = null;
      // We keep the models list intact
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
      return state.currentTrainingJob.logs.join('\n');
    }
  }
});
