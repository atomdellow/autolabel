<!-- 
  ModelTrainingPanel.vue - A component for configuring and managing model training
-->
<template>
  <div class="model-training-panel">
    <!-- Training Configuration Section -->
    <div class="training-config-section card">
      <h2>Training Configuration</h2>
      <form @submit.prevent="handleStartTraining">
        <div class="form-group">
          <label for="baseModelName">Base Model:</label>
          <input type="text" id="baseModelName" v-model="trainingConfig.baseModelName">
        </div>
        <div class="form-group">
          <label for="epochs">Epochs:</label>
          <input type="number" id="epochs" v-model.number="trainingConfig.epochs" min="1">
        </div>
        <div class="form-group">
          <label for="batchSize">Batch Size:</label>
          <input type="number" id="batchSize" v-model.number="trainingConfig.batchSize" min="1">
        </div>
        <div class="form-group">
          <label for="imgSize">Image Size (px):</label>
          <input type="number" id="imgSize" v-model.number="trainingConfig.imgSize" min="32" step="32">
        </div>
        <div class="form-group">
          <label for="trainSplit">Train/Validation Split (Train %):</label>
          <input type="number" id="trainSplit" v-model.number="trainingConfig.trainSplit" min="0.1" max="0.9" step="0.05">
        </div>
        <div class="form-group">
          <label for="incrementalTraining">Use Incremental Training:</label>
          <input type="checkbox" id="incrementalTraining" v-model="trainingConfig.incrementalTraining">
          <span class="help-text">Train on annotations in batches of 10-20 images</span>
        </div>
      </form>
    </div>

    <!-- Model Training Section -->
    <div class="training-section card">
      <h2>Model Training</h2>
      <button 
        @click="handleStartTraining" 
        :disabled="isTrainingActive || isStartingTraining || !hasAnnotatedImages"
        class="primary-button"
      >
        {{ isStartingTraining ? 'Initiating...' : (isTrainingActive ? 'Training in Progress...' : 'Start Training') }}
      </button>
      <p v-if="!hasAnnotatedImages && !isLoading">
        You need at least one annotated image to start training.
      </p>
      
      <div v-if="startTrainingError" class="error">
        Error starting training: {{ startTrainingError }}
      </div>
  
      <div v-if="currentTrainingJob && currentTrainingJob.status !== 'idle'" class="training-status">
        <h3>Current Training Job</h3>
        <p><strong>Status:</strong> {{ currentTrainingJob.status }}</p>
        <p v-if="currentTrainingJob.startTime"><strong>Start Time:</strong> {{ new Date(currentTrainingJob.startTime).toLocaleString() }}</p>
        <p v-if="currentTrainingJob.endTime"><strong>End Time:</strong> {{ new Date(currentTrainingJob.endTime).toLocaleString() }}</p>
        <p v-if="isTrainingActive"><strong>Progress:</strong> {{ currentTrainingJob.progress }}%</p>
        
        <div v-if="currentTrainingJob.logs && currentTrainingJob.logs.length">
          <h4>Logs:</h4>
          <pre class="logs-output">{{ formattedLogs }}</pre>
        </div>
        <p v-if="statusError" class="error">Error fetching status: {{ statusError }}</p>
      </div>
    </div>

    <!-- Trained Models Section -->
    <div class="trained-models-section card">
      <h2>Trained Models</h2>
      <button 
        @click="handleRefreshModels" 
        :disabled="isLoadingModels"
        class="secondary-button"
      > 
        {{ isLoadingModels ? 'Refreshing...' : 'Refresh Model List' }}
      </button>
      <p v-if="modelsError" class="error">{{ modelsError }}</p>
      <div v-if="isLoadingModels && !trainedModels.length">Loading models...</div>
      <ul v-else-if="trainedModels.length" class="model-list">
        <li v-for="model in trainedModels" :key="model.name" class="model-item">
          <p><strong>{{ model.name }}</strong></p>
          <p>Size: {{ (model.size / (1024*1024)).toFixed(2) }} MB</p>
          <p>Created: {{ new Date(model.createdAt).toLocaleString() }}</p>
          <button @click="handleUseModel(model)" class="action-button">
            Use for Auto-Detection
          </button>
        </li>
      </ul>
      <p v-else-if="!isLoadingModels">No trained models found for this project.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineProps, defineEmits } from 'vue';
import { useTrainingStore } from '../../store/trainingStore';
import { useToast } from 'vue-toastification';

const props = defineProps({
  projectId: {
    type: String,
    required: true
  },
  hasAnnotatedImages: {
    type: Boolean,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['useModel']);

const toast = useToast();
const trainingStore = useTrainingStore();

// Local refs for training config
const trainingConfig = ref({
  baseModelName: trainingStore.trainingConfig.baseModelName || 'yolov8n.pt',
  epochs: trainingStore.trainingConfig.epochs || 10,
  batchSize: trainingStore.trainingConfig.batchSize || 16,
  imgSize: trainingStore.trainingConfig.imgSize || 640,
  trainSplit: trainingStore.trainingConfig.trainSplit || 0.8,
  incrementalTraining: trainingStore.trainingConfig.incrementalTraining || false
});

// Computed properties for better code readability
const isTrainingActive = computed(() => trainingStore.isTrainingActive);
const isStartingTraining = computed(() => trainingStore.isStartingTraining);
const startTrainingError = computed(() => trainingStore.startTrainingError);
const currentTrainingJob = computed(() => trainingStore.currentTrainingJob);
const statusError = computed(() => trainingStore.statusError);
const isLoadingModels = computed(() => trainingStore.isLoadingModels);
const trainedModels = computed(() => trainingStore.trainedModels);
const modelsError = computed(() => trainingStore.modelsError);
const formattedLogs = computed(() => trainingStore.formattedLogs);

// Poll for status updates when training is active
const statusInterval = ref(null);

function setupStatusPolling() {
  if (statusInterval.value) {
    clearInterval(statusInterval.value);
  }
  
  // Poll every 5 seconds when training is active
  statusInterval.value = setInterval(() => {
    if (isTrainingActive.value) {
      trainingStore.getTrainingStatus(props.projectId);
    } else {
      clearInterval(statusInterval.value);
    }
  }, 5000);
}

// Handlers
async function handleStartTraining() {
  if (isTrainingActive.value || isStartingTraining.value) {
    return;
  }
  
  // Update the training store config with our local config
  trainingStore.updateTrainingConfig({
    ...trainingConfig.value
  });
  
  try {
    await trainingStore.startTraining(props.projectId);
    
    if (!trainingStore.startTrainingError) {
      toast.success('Training started successfully');
      setupStatusPolling();
    }
  } catch (error) {
    console.error('Error starting training:', error);
    toast.error('Failed to start training');
  }
}

async function handleRefreshModels() {
  try {
    await trainingStore.getTrainedModels(props.projectId);
  } catch (error) {
    console.error('Error refreshing models:', error);
    toast.error('Failed to refresh model list');
  }
}

function handleUseModel(model) {
  emit('useModel', model);
  toast.success(`Selected model: ${model.name}`);
}

onMounted(async () => {
  try {
    // Initialize training status
    await trainingStore.getTrainingStatus(props.projectId);
    
    // Get trained models
    await trainingStore.getTrainedModels(props.projectId);
    
    // Setup polling if training is active
    if (isTrainingActive.value) {
      setupStatusPolling();
    }
  } catch (error) {
    console.error('Error initializing training data:', error);
  }
});

onUnmounted(() => {
  if (statusInterval.value) {
    clearInterval(statusInterval.value);
  }
});
</script>

<style>
.model-training-panel {
  width: 100%;
}

.card {
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  padding: 20px;
}

.card h2 {
  border-bottom: 1px solid #eee;
  color: #333;
  font-size: 1.5rem;
  margin-top: 0;
  margin-bottom: 15px;
  padding-bottom: 10px;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 5px;
}

.form-group input[type="text"],
.form-group input[type="number"] {
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  padding: 8px 12px;
  width: 100%;
}

.help-text {
  color: #666;
  font-size: 12px;
  margin-left: 8px;
}

.primary-button,
.secondary-button,
.action-button {
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
  padding: 10px 16px;
  transition: background-color 0.3s;
}

.primary-button {
  background-color: #4285f4;
  color: white;
}

.primary-button:hover {
  background-color: #3367d6;
}

.secondary-button {
  background-color: #f1f3f4;
  color: #3c4043;
}

.secondary-button:hover {
  background-color: #d2d6d9;
}

.action-button {
  background-color: #34a853;
  color: white;
  font-size: 12px;
  padding: 6px 12px;
}

.action-button:hover {
  background-color: #2e8f49;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.error {
  color: #d93025;
  font-size: 14px;
  margin: 10px 0;
}

.training-status {
  background-color: #f9f9f9;
  border-radius: 4px;
  margin-top: 20px;
  padding: 15px;
}

.training-status h3 {
  color: #333;
  font-size: 1.2rem;
  margin-top: 0;
}

.logs-output {
  background-color: #2b2b2b;
  border-radius: 4px;
  color: #f8f8f2;
  font-family: monospace;
  font-size: 12px;
  height: 200px;
  margin-top: 10px;
  overflow-y: auto;
  padding: 10px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.model-list {
  display: grid;
  gap: 15px;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  list-style: none;
  margin: 0;
  padding: 0;
}

.model-item {
  background-color: #f8f9fa;
  border-radius: 6px;
  padding: 15px;
}

.model-item p {
  margin: 5px 0;
}

.model-item button {
  margin-top: 10px;
}
</style>
