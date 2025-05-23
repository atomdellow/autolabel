<template>
  <div class="training-status" :class="statusClass">
    <h2>Training Status</h2>
    
    <div v-if="status === 'idle'" class="status-block idle">
      <div class="status-icon">
        <i class="icon-idle"></i>
      </div>
      <div class="status-message">
        <h3>Ready to Train</h3>
        <p>Configure your training parameters and start a new training job</p>
      </div>
    </div>
    
    <div v-else-if="status === 'preparing'" class="status-block preparing">
      <div class="status-icon">
        <i class="icon-preparing"></i>
      </div>
      <div class="status-message">
        <h3>Preparing Training</h3>
        <p>Setting up datasets and preparing the training environment</p>
        <div class="progress-container">
          <div class="progress-bar" style="width: 25%"></div>
        </div>
      </div>
    </div>
    
    <div v-else-if="status === 'training'" class="status-block training">
      <div class="status-icon">
        <i class="icon-training"></i>
      </div>
      <div class="status-message">
        <h3>Training in Progress</h3>
        <p>Training your model ({{ model?.modelType || 'Custom model' }})</p>
        <div class="progress-details">
          <span>Progress: {{ Math.round(progress) }}%</span>
          <span>Epoch: {{ model?.currentEpoch || 0 }}/{{ model?.totalEpochs || 0 }}</span>
        </div>
        <div class="progress-container">
          <div class="progress-bar" :style="{ width: `${progress}%` }"></div>
        </div>
      </div>
    </div>
    
    <div v-else-if="status === 'completed'" class="status-block completed">
      <div class="status-icon">
        <i class="icon-completed"></i>
      </div>
      <div class="status-message">
        <h3>Training Complete</h3>
        <p>Your model has been trained successfully</p>
        <div class="model-info" v-if="model">
          <div class="info-row">
            <span class="info-label">Model Type:</span>
            <span class="info-value">{{ model.modelType }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Training Time:</span>
            <span class="info-value">{{ model.trainingTimeFormatted }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Epochs:</span>
            <span class="info-value">{{ model.totalEpochs }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Accuracy:</span>
            <span class="info-value">{{ model.accuracy ? `${model.accuracy}%` : 'N/A' }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">mAP Score:</span>
            <span class="info-value">{{ model.mAP?.toFixed(3) || 'N/A' }}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div v-else-if="status === 'failed'" class="status-block failed">
      <div class="status-icon">
        <i class="icon-failed"></i>
      </div>
      <div class="status-message">
        <h3>Training Failed</h3>
        <p>An error occurred during the training process</p>
        <div class="error-details" v-if="model?.error">
          <p><strong>Error:</strong> {{ model.error }}</p>
        </div>
        <div class="retry-action">
          <button class="btn-retry">Retry Training</button>
        </div>
      </div>
    </div>
    
    <div class="status-logs" v-if="status !== 'idle'">
      <h3>Training Logs</h3>
      <div class="log-container">
        <pre v-if="model?.logs?.length">{{ model.logs.join('\n') }}</pre>
        <p v-else class="no-logs">No logs available</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

// Props
const props = defineProps({
  status: {
    type: String,
    default: 'idle',
    validator: (value) => ['idle', 'preparing', 'training', 'completed', 'failed'].includes(value)
  },
  progress: {
    type: Number,
    default: 0
  },
  model: {
    type: Object,
    default: null
  }
});

// Computed
const statusClass = computed(() => {
  return {
    'status-idle': props.status === 'idle',
    'status-preparing': props.status === 'preparing',
    'status-training': props.status === 'training',
    'status-completed': props.status === 'completed',
    'status-failed': props.status === 'failed'
  };
});
</script>

<style scoped>
.training-status {
  width: 100%;
}

h2 {
  margin-bottom: 20px;
}

.status-block {
  display: flex;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  margin-right: 15px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-message {
  flex-grow: 1;
}

.status-message h3 {
  margin-top: 0;
  margin-bottom: 8px;
}

.status-message p {
  margin-top: 0;
  margin-bottom: 15px;
}

/* Status-specific styling */
.status-idle .status-icon {
  background-color: #e9ecef;
}

.status-preparing .status-icon {
  background-color: #cff4fc;
}

.status-training .status-icon {
  background-color: #fff3cd;
}

.status-completed .status-icon {
  background-color: #d1e7dd;
}

.status-failed .status-icon {
  background-color: #f8d7da;
}

/* Progress bar styling */
.progress-container {
  height: 8px;
  background-color: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
  margin-top: 10px;
}

.progress-bar {
  height: 100%;
  background-color: #4caf50;
  transition: width 0.3s ease;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 5px;
}

/* Model info styling */
.model-info {
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: 12px;
  margin-top: 10px;
}

.info-row {
  display: flex;
  margin-bottom: 5px;
}

.info-label {
  font-weight: 600;
  min-width: 120px;
}

/* Error styling */
.error-details {
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  color: #842029;
}

.btn-retry {
  background-color: #0d6efd;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
}

/* Logs styling */
.status-logs {
  margin-top: 25px;
  border-top: 1px solid #dee2e6;
  padding-top: 15px;
}

.log-container {
  background-color: #212529;
  color: #f8f9fa;
  border-radius: 4px;
  padding: 15px;
  max-height: 200px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 12px;
  margin-top: 10px;
}

.no-logs {
  color: #6c757d;
  font-style: italic;
  margin: 0;
}

/* Icons styling with CSS */
.icon-idle::before,
.icon-preparing::before,
.icon-training::before,
.icon-completed::before,
.icon-failed::before {
  content: '';
  display: inline-block;
  width: 24px;
  height: 24px;
  background-size: cover;
}

.icon-idle::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%236c757d' d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-13h-2v6h6v-2h-4z'/%3E%3C/svg%3E");
}

.icon-preparing::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%230d6efd' d='M12 4V2C6.48 2 2 6.48 2 12h2c0-4.41 3.59-8 8-8zm0 2c-3.31 0-6 2.69-6 6H4c0-4.42 3.58-8 8-8v2zm0 14c4.41 0 8-3.59 8-8h-2c0 3.31-2.69 6-6 6v2z'/%3E%3C/svg%3E");
  animation: spin 2s infinite linear;
}

.icon-training::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23ffc107' d='M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61l1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42C16.07 4.74 14.12 4 12 4c-4.97 0-9 4.03-9 9s4.02 9 9 9 9-4.03 9-9c0-2.12-.74-4.07-1.97-5.61zM12 20c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z'/%3E%3C/svg%3E");
  animation: pulse 1.5s infinite ease-in-out;
}

.icon-completed::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234caf50' d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E");
}

.icon-failed::before {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%23dc3545' d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E");
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
</style>
