<template>
  <div class="panel training-config-panel">
    <div class="panel-header">
      <h3 class="panel-title">Training Configuration</h3>
    </div>
    
    <div class="panel-content">
      <form @submit.prevent="submitForm">
        <div class="form-group">
          <label class="form-label" for="baseModelName">Base Model</label>
          <select 
            id="baseModelName" 
            v-model="localConfig.baseModelName"
            class="form-control"
            @change="updateConfig"
          >
            <option 
              v-for="model in availableBaseModels" 
              :key="model.id" 
              :value="model.id"
            >
              {{ model.name }} - {{ model.description }}
            </option>
          </select>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="epochs">Epochs</label>
          <input 
            type="number" 
            id="epochs" 
            v-model.number="localConfig.epochs" 
            min="1" 
            max="1000"
            class="form-control"
            @change="updateConfig"
          >
          <small class="form-text text-muted">Number of training rounds</small>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="batchSize">Batch Size</label>
          <input 
            type="number" 
            id="batchSize" 
            v-model.number="localConfig.batchSize" 
            min="1" 
            max="128"
            class="form-control"
            @change="updateConfig"
          >
          <small class="form-text text-muted">Number of samples per training batch</small>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="imgSize">Image Size</label>
          <input 
            type="number" 
            id="imgSize" 
            v-model.number="localConfig.imgSize" 
            min="32" 
            step="32"
            class="form-control"
            @change="updateConfig"
          >
          <small class="form-text text-muted">Size images will be resized to for training</small>
        </div>
        
        <div class="form-group">
          <label class="form-label" for="trainSplit">Training Split</label>
          <input 
            type="number" 
            id="trainSplit" 
            v-model.number="localConfig.trainSplit" 
            min="0.1" 
            max="0.9" 
            step="0.05"
            class="form-control"
            @change="updateConfig"
          >
          <small class="form-text text-muted">Portion of data used for training vs validation (0.8 = 80% train, 20% validation)</small>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useTrainingConfig } from '../composables/useTrainingConfig';

const props = defineProps({
  trainingConfig: {
    type: Object,
    required: true
  },
  projectStore: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['update-config']);

// Local copy of the config for form binding
const localConfig = ref({
  baseModelName: props.trainingConfig.baseModelName,
  epochs: props.trainingConfig.epochs,
  batchSize: props.trainingConfig.batchSize,
  imgSize: props.trainingConfig.imgSize,
  trainSplit: props.trainingConfig.trainSplit
});

// Get available base models from the composable
const { availableBaseModels } = useTrainingConfig({
  trainingConfig: props.trainingConfig,
  setTrainingConfig: () => {}
});

// Update the config in the parent component when local values change
function updateConfig() {
  emit('update-config', { ...localConfig.value });
}

// Submit form handler
function submitForm() {
  updateConfig();
}

// Sync local config with props when props change
onMounted(() => {
  localConfig.value = { ...props.trainingConfig };
});
</script>

<style scoped>
.training-config-panel {
  margin-bottom: 20px;
}

.form-text {
  display: block;
  margin-top: 5px;
  font-size: 0.8rem;
  color: #6c757d;
}
</style>
