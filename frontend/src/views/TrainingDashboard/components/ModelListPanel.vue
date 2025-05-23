<template>
  <div class="panel model-list-panel">
    <div class="panel-header">
      <h3 class="panel-title">Trained Models</h3>
      <div v-if="isLoading" class="loading-spinner"></div>
    </div>
    
    <div class="panel-content">
      <div v-if="models.length === 0" class="no-models-message">
        No trained models available for this project.
      </div>
      
      <div v-else class="model-list">
        <div 
          v-for="model in models" 
          :key="model._id" 
          class="model-item"
          :class="{ 'selected': isModelSelected(model._id) }"
          @click="selectModel(model._id)"
        >
          <div class="model-info">
            <div class="model-name">{{ model.name || 'Unnamed model' }}</div>
            <div class="model-meta">
              <span>Created: {{ formatDate(model.createdAt) }}</span>
              <span v-if="model.accuracy">Accuracy: {{ (model.accuracy * 100).toFixed(1) }}%</span>
            </div>
          </div>
          
          <div class="model-actions">
            <button 
              v-if="model.downloadUrl" 
              class="btn btn-sm btn-secondary"
              @click.stop="downloadModel(model)"
              title="Download model"
            >
              <i class="fas fa-download"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  models: {
    type: Array,
    default: () => []
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select-model']);

// Currently selected model ID
const selectedModelId = ref(null);

// Check if a model is selected
const isModelSelected = (modelId) => {
  return selectedModelId.value === modelId;
};

// Handle model selection
function selectModel(modelId) {
  selectedModelId.value = modelId;
  emit('select-model', modelId);
}

// Format date
function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  return date.toLocaleDateString();
}

// Download model
function downloadModel(model) {
  // Prevent the click from selecting the model
  event.stopPropagation();
  
  if (model.downloadUrl) {
    window.open(model.downloadUrl, '_blank');
  }
}
</script>

<style scoped>
.no-models-message {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-style: italic;
}

.model-list {
  max-height: 300px;
  overflow-y: auto;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  transition: background-color 0.2s;
}

.model-item:hover {
  background-color: #f8f9fa;
}

.model-item.selected {
  background-color: #e6f2ff;
}

.model-info {
  flex: 1;
}

.model-name {
  font-weight: 500;
  margin-bottom: 2px;
}

.model-meta {
  font-size: 0.8rem;
  color: #6c757d;
  display: flex;
  flex-direction: column;
}

.model-actions {
  display: flex;
  gap: 5px;
}

.btn-sm {
  padding: 2px 8px;
  font-size: 0.8rem;
}
</style>
