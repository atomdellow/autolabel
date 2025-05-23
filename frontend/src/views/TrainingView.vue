<template>
  <div class="training-view">
    <div class="page-header">
      <h1>Model Training</h1>
      <p>Configure and manage training for custom annotation models</p>
    </div>

    <div class="training-layout">
      <div class="training-config-section">
        <TrainingForm 
          @start-training="startTraining" 
          :training-in-progress="trainingInProgress"
        />
      </div>

      <div class="training-status-section">
        <TrainingStatus 
          :status="trainingStatus"
          :progress="trainingProgress"
          :model="currentModel"
        />
      </div>
      
      <div class="models-section">
        <TrainedModels 
          :models="trainedModels"
          @export-model="exportModel"
          @use-model="useModel"
          @delete-model="deleteModel"
        />
      </div>
      
      <div class="annotation-import-section">
        <AnnotationImporter
          @import-annotations="importAnnotations"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import TrainingForm from '../components/Training/TrainingForm.vue';
import TrainingStatus from '../components/Training/TrainingStatus.vue';
import TrainedModels from '../components/Training/TrainedModels.vue';
import AnnotationImporter from '../components/Training/AnnotationImporter.vue';
import { useTrainingStore } from '../store/trainingStore';
import trainingService from '../services/trainingService';
import { validateProjectId } from '../utils/validation';

// Initialize toast
const toast = useToast();

// Initialize training store
const trainingStore = useTrainingStore();

// Reactive state
const trainingInProgress = ref(false);
const trainingStatus = ref('idle'); // idle, preparing, training, completed, failed
const trainingProgress = ref(0);
const currentModel = ref(null);
const trainedModels = ref([]);
const serverStatus = ref('unknown');

// Fetch data on component mount
onMounted(async () => {
  try {
    // Fetch trained models list
    try {
      trainedModels.value = await trainingStore.fetchTrainedModels();
    } catch (modelError) {
      console.warn('Unable to fetch trained models:', modelError);
      trainedModels.value = [];
      // Don't show error toast for this since it's expected on first use
    }
    
    // Check if there's an ongoing training process
    try {
      const status = await trainingStore.checkTrainingStatus();
      if (status && status.inProgress) {
        trainingInProgress.value = true;
        trainingStatus.value = status.status;
        trainingProgress.value = status.progress;
        currentModel.value = status.model;
      }
    } catch (statusError) {
      console.warn('Unable to check training status:', statusError);
      // This is also expected on first use
    }
  } catch (error) {
    toast.error(`Failed to load training data: ${error.message}`);
  }
});

// Start a new training job
async function startTraining(trainingConfig) {
  try {
    // First check if server is reachable
    const isConnected = await checkServerConnection();
    if (!isConnected) {
      toast.error('Cannot connect to the backend server. Please ensure the server is running.');
      return;
    }
    
    // Extract projectId from FormData
    const projectId = trainingConfig.get('projectId');
    
    // Validate projectId
    await validateProjectId(projectId);
    
    trainingInProgress.value = true;
    trainingStatus.value = 'preparing';
    trainingProgress.value = 0;
    
    // Log the form data for debugging
    console.log('Starting training with configuration:');
    for (let [key, value] of trainingConfig.entries()) {
      console.log(`${key}: ${value}`);
    }
    
    // Submit training job to backend
    try {
      const result = await trainingStore.startTraining(trainingConfig);
      currentModel.value = result.model;
      
      toast.success('Training job started successfully');
      
      // Start polling for updates
      pollTrainingStatus();    } catch (apiError) {
      console.error('API error details:', apiError);
      if (apiError.response) {
        console.error('Response data:', apiError.response.data);
        console.error('Response status:', apiError.response.status);
        toast.error(`Server error: ${apiError.response.data.message || apiError.message}`);
      } else {
        // Use the friendly message from our API interceptor if available
        const errorMessage = apiError.friendlyMessage || 
          `Failed to communicate with server: ${apiError.message}`;
        toast.error(errorMessage);
        
        // Add specific guidance for common errors
        if (apiError.code === 'ERR_NETWORK' || apiError.message.includes('Network Error')) {
          toast.info('Make sure the backend server is running and accessible');
        }
      }
      trainingInProgress.value = false;
      trainingStatus.value = 'failed';
    }
  } catch (error) {
    trainingInProgress.value = false;
    trainingStatus.value = 'failed';
    toast.error(`Failed to start training: ${error.message}`);
  }
}

// Poll for training status updates
function pollTrainingStatus() {
  const intervalId = setInterval(async () => {
    try {
      const status = await trainingStore.checkTrainingStatus();
      trainingStatus.value = status.status;
      trainingProgress.value = status.progress;
      
      if (status.status === 'completed' || status.status === 'failed') {
        clearInterval(intervalId);
        trainingInProgress.value = false;
        
        if (status.status === 'completed') {
          toast.success('Training completed successfully!');
          // Refresh models list
          trainedModels.value = await trainingStore.fetchTrainedModels();
        } else {
          toast.error('Training failed. Please check logs for details.');
        }
      }
    } catch (error) {
      console.error('Error polling training status:', error);
    }
  }, 3000); // Poll every 3 seconds
}

// Export trained model
async function exportModel(modelId) {
  try {
    await trainingStore.exportModel(modelId);
    toast.success('Model exported successfully');
  } catch (error) {
    toast.error(`Failed to export model: ${error.message}`);
  }
}

// Use model for annotation assistance
async function useModel(modelId) {
  try {
    await trainingStore.activateModel(modelId);
    toast.success('Model activated for annotation assistance');
  } catch (error) {
    toast.error(`Failed to activate model: ${error.message}`);
  }
}

// Delete trained model
async function deleteModel(modelId) {
  try {
    await trainingStore.deleteModel(modelId);
    toast.success('Model deleted successfully');
    // Refresh models list
    trainedModels.value = await trainingStore.fetchTrainedModels();
  } catch (error) {
    toast.error(`Failed to delete model: ${error.message}`);
  }
}

// Import annotations from JSON (e.g., Roboflow format)
async function importAnnotations(data) {
  try {
    await trainingStore.importAnnotations(data);
    toast.success('Annotations imported successfully');
  } catch (error) {
    toast.error(`Failed to import annotations: ${error.message}`);
  }
}

// Check if backend server is accessible
async function checkServerConnection() {
  try {
    // Use trainingService to check if the main API server is running
    await trainingService.getProjects();
    return true;
  } catch (error) {
    console.warn('Unable to connect to backend server:', error);
    return false;
  }
}

// Handle server status updates
function handleServerStatusUpdate(status) {
  serverStatus.value = status.status;
  
  // Show a toast if server status changes to error
  if (status.status === 'error') {
    toast.error('Detection server error: ' + status.message);
  }
}
</script>

<style scoped>
.training-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  margin-bottom: 30px;
}

.page-header h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

.page-header p {
  color: #666;
}

.training-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
}

@media (min-width: 768px) {
  .training-layout {
    grid-template-columns: 1fr 1fr;
  }
}

.training-config-section,
.training-status-section,
.models-section,
.annotation-import-section {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 20px;
}

.server-status-widget {
  margin-bottom: 20px;
}
</style>
