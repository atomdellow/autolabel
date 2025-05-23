<template>
  <div class="trained-models">
    <h2>Trained Models</h2>
    
    <div v-if="models && models.length > 0" class="models-list">
      <div v-for="model in models" :key="model._id" class="model-card">
        <div class="model-header">
          <h3>{{ model.name }}</h3>
          <div class="model-type-badge" :class="getModelTypeClass(model.type)">
            {{ model.type }}
          </div>
        </div>
        
        <div class="model-info">
          <div class="info-row">
            <div class="info-item">
              <span class="info-label">Created</span>
              <span class="info-value">{{ formatDate(model.createdAt) }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Classes</span>
              <span class="info-value">{{ model.classCount || 'N/A' }}</span>
            </div>
          </div>
          
          <div class="info-row">
            <div class="info-item">
              <span class="info-label">Accuracy</span>
              <span class="info-value">{{ model.accuracy ? `${model.accuracy}%` : 'N/A' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Size</span>
              <span class="info-value">{{ formatFileSize(model.fileSize) }}</span>
            </div>
          </div>
          
          <div class="metrics-row" v-if="model.metrics">
            <div class="metric-item">
              <span class="metric-label">mAP</span>
              <span class="metric-value">{{ model.metrics.mAP?.toFixed(3) || 'N/A' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Precision</span>
              <span class="metric-value">{{ model.metrics.precision?.toFixed(3) || 'N/A' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Recall</span>
              <span class="metric-value">{{ model.metrics.recall?.toFixed(3) || 'N/A' }}</span>
            </div>
          </div>
        </div>
        
        <div class="model-status" :class="model.isActive ? 'active' : ''">
          {{ model.isActive ? 'Currently Active' : 'Not Active' }}
        </div>
        
        <div class="model-actions">
          <button 
            class="btn btn-export" 
            title="Export Model"
            @click="$emit('export-model', model._id)"
          >
            <i class="icon-download"></i>
            Export
          </button>
          <button 
            class="btn btn-use" 
            title="Use for Annotation"
            @click="$emit('use-model', model._id)"
            :disabled="model.isActive"
          >
            <i class="icon-use"></i>
            {{ model.isActive ? 'Active' : 'Use' }}
          </button>
          <button 
            class="btn btn-delete" 
            title="Delete Model"
            @click="confirmDelete(model)"
          >
            <i class="icon-delete"></i>
            Delete
          </button>
        </div>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <div class="empty-icon">
        <i class="icon-empty-models"></i>
      </div>
      <h3>No Models Available</h3>
      <p>You haven't trained any models yet. Start a new training job to create your first model.</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

// Props
const props = defineProps({
  models: {
    type: Array,
    default: () => []
  }
});

// Emits
const emit = defineEmits(['export-model', 'use-model', 'delete-model']);

// Format date method
function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Format file size method
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// Get model type class method
function getModelTypeClass(type) {
  if (!type) return '';
  
  if (type.toLowerCase().includes('yolo')) {
    return 'model-type-yolo';
  } else if (type.toLowerCase().includes('faster')) {
    return 'model-type-fasterrcnn';
  } else if (type.toLowerCase().includes('ssd')) {
    return 'model-type-ssd';
  } else {
    return 'model-type-other';
  }
}

// Confirm delete method
function confirmDelete(model) {
  if (confirm(`Are you sure you want to delete the model "${model.name}"? This action cannot be undone.`)) {
    emit('delete-model', model._id);
  }
}
</script>

<style scoped>
.trained-models {
  width: 100%;
}

h2 {
  margin-bottom: 20px;
}

.models-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.model-card {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  transition: all 0.2s ease-in-out;
}

.model-card:hover {
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.model-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0f0f0;
}

.model-header h3 {
  margin: 0;  font-size: 18px;
  font-weight: 600;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.model-type-badge {
  padding: 4px 8px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.model-type-yolo {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.model-type-fasterrcnn {
  background-color: #e3f2fd;
  color: #1565c0;
}

.model-type-ssd {
  background-color: #fff3e0;
  color: #e65100;
}

.model-type-other {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.model-info {
  margin-bottom: 15px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
}

.info-item {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 12px;
  color: #757575;
  margin-bottom: 2px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
}

.metrics-row {
  display: flex;
  justify-content: space-between;
  background-color: #f8f9fa;
  padding: 8px 12px;
  border-radius: 4px;
  margin-top: 10px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-label {
  font-size: 11px;
  color: #757575;
}

.metric-value {
  font-size: 14px;
  font-weight: 600;
}

.model-status {
  font-size: 12px;
  text-align: center;
  padding: 6px;
  margin-bottom: 15px;
  border-radius: 4px;
  background-color: #f0f0f0;
  color: #757575;
}

.model-status.active {
  background-color: #e8f5e9;
  color: #2e7d32;
  font-weight: 600;
}

.model-actions {
  display: flex;
  justify-content: space-between;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 4px;
  font-weight: 500;
  font-size: 14px;
  cursor: pointer;
  border: none;
  white-space: nowrap;
}

.btn i {
  margin-right: 6px;
}

.btn-export {
  background-color: #f1f3f5;
  color: #495057;
}

.btn-export:hover {
  background-color: #e9ecef;
}

.btn-use {
  background-color: #e3f2fd;
  color: #0d6efd;
}

.btn-use:hover:not(:disabled) {
  background-color: #cfe2ff;
}

.btn-use:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-delete {
  background-color: #fff5f5;
  color: #fa5252;
}

.btn-delete:hover {
  background-color: #ffe3e3;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px dashed #ced4da;
}

.empty-icon {
  margin-bottom: 15px;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
  border-radius: 50%;
}

.empty-state h3 {
  margin: 0 0 10px 0;
}

.empty-state p {
  color: #6c757d;
  max-width: 400px;
  margin: 0;
}

/* Icon styles using CSS */
[class^="icon-"] {
  display: inline-block;
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
}

.icon-download {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23495057'%3E%3Cpath d='M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'/%3E%3C/svg%3E");
}

.icon-use {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230d6efd'%3E%3Cpath d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
}

.icon-delete {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23fa5252'%3E%3Cpath d='M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'/%3E%3C/svg%3E");
}

.icon-empty-models {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%236c757d'%3E%3Cpath d='M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z'/%3E%3C/svg%3E");
  width: 32px;
  height: 32px;
}
</style>
