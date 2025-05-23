<template>  <div class="training-dashboard-view">
    <BreadcrumbNav>
      <router-link :to="{ name: 'Dashboard' }">Dashboard</router-link> &gt;
      <router-link :to="{ name: 'ProjectDetail', params: { projectId: projectId } }">Project: {{ projectStore.currentProject?.name }}</router-link> &gt;
      <span>Training Dashboard</span>
    </BreadcrumbNav>

    <div class="dashboard-layout">
      <Toolbar 
        :training-config="trainingConfig"
        :can-start-training="canStartTraining"
        @start-training="startTraining"
      />

      <div class="main-panel">
        <TrainingConfigPanel
          :training-config="trainingConfig"
          :project-store="projectStore"
          @update-config="updateTrainingConfig"
        />
        
        <TrainingStatusPanel
          :training-job="trainingStore.currentTrainingJob"
          :is-loading="trainingStore.isLoadingStatus"
        />
      </div>

      <div class="side-panel">
        <ModelListPanel 
          :models="trainingStore.trainedModels"
          :is-loading="trainingStore.isLoadingModels"
          @select-model="selectModel"
        />
        
        <MetricsPanel 
          :selected-model="selectedModel"
          :is-loading="isLoadingMetrics"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
// Import necessary functions
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import './styles/index.css';

// Import our stores
import { useProjectStore } from '../../store/projectStore';
import { useImageStore } from '../../store/imageStore';
import { useTrainingStore } from '../../store/trainingStore';

// Import components
import Toolbar from './components/Toolbar.vue';
import TrainingConfigPanel from './components/TrainingConfigPanel.vue';
import TrainingStatusPanel from './components/TrainingStatusPanel.vue';
import ModelListPanel from './components/ModelListPanel.vue';
import MetricsPanel from './components/MetricsPanel.vue';
import BreadcrumbNav from '../../components/BreadcrumbNav.vue';

// Import composables
import { useTrainingConfig } from './composables/useTrainingConfig';
import { useModelSelection } from './composables/useModelSelection';
import { useMetricsVisualization } from './composables/useMetricsVisualization';

// Component state
const route = useRoute();
const router = useRouter();
const toast = useToast();
const projectStore = useProjectStore();
const imageStore = useImageStore();
const trainingStore = useTrainingStore();

// Get route params
const projectId = ref(route.params.projectId);

// Initialize training configuration functionality
const { trainingConfig, updateTrainingConfig } = useTrainingConfig(trainingStore);

// Initialize model selection functionality
const { selectedModel, selectModel } = useModelSelection(trainingStore);

// Initialize metrics visualization functionality
const { isLoadingMetrics } = useMetricsVisualization(selectedModel);

// Computed properties
const canStartTraining = computed(() => {
  return imageStore.annotatedImages.length > 0 && 
         !trainingStore.isStartingTraining && 
         !isTrainingActive.value;
});

const isTrainingActive = computed(() => {
  const status = trainingStore.currentTrainingJob?.status;
  return status === 'preparing' || status === 'training';
});

// Methods
function startTraining() {
  trainingStore.startTraining(projectId.value)
    .then(() => {
      toast.success('Training started successfully');
      // Start polling for status updates
      startStatusPolling();
    })
    .catch(error => {
      toast.error(`Failed to start training: ${error.message}`);
    });
}

// Status polling functionality
const statusPollingInterval = ref(null);

function startStatusPolling() {
  // Clear any existing interval
  if (statusPollingInterval.value) {
    clearInterval(statusPollingInterval.value);
  }
  
  // Poll every 5 seconds
  statusPollingInterval.value = setInterval(() => {
    if (isTrainingActive.value) {
      trainingStore.fetchTrainingStatus(projectId.value);
    } else {
      stopStatusPolling();
    }
  }, 5000);
}

function stopStatusPolling() {
  if (statusPollingInterval.value) {
    clearInterval(statusPollingInterval.value);
    statusPollingInterval.value = null;
  }
}

// Lifecycle hooks
onMounted(async () => {
  console.log('TrainingDashboardView mounted');
  
  try {
    // Load project data
    await projectStore.loadProjectById(projectId.value);
    
    // Fetch trained models for this project
    await trainingStore.fetchTrainedModels(projectId.value);
    
    // Fetch current training status if there's an active job
    await trainingStore.fetchTrainingStatus(projectId.value);
    
    // Start polling if there's an active training job
    if (isTrainingActive.value) {
      startStatusPolling();
    }
    
    // Make sure images are fetched for this project
    await imageStore.fetchImages(projectId.value);
  } catch (error) {
    console.error('Error initializing training dashboard:', error);
    toast.error('Failed to load training data. Please try again.');
  }
});

// Stop polling when component is unmounted
watch(() => isTrainingActive.value, (newValue) => {
  if (!newValue) {
    stopStatusPolling();
  } else if (!statusPollingInterval.value) {
    startStatusPolling();
  }
});
</script>

<style>
@import './styles/index.css';
</style>
