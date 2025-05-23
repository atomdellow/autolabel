<template>
  <div class="panel training-status-panel">
    <div class="panel-header">
      <h3 class="panel-title">Training Status</h3>
      <div v-if="isLoading" class="loading-spinner"></div>
    </div>
    
    <div class="panel-content">
      <div v-if="!trainingJob.jobId" class="no-job-message">
        No active training job. Start training to see status here.
      </div>
      
      <div v-else class="job-status-container">
        <div class="status-header">
          <div class="status-indicator" :class="getStatusClass"></div>
          <span class="status-text">{{ trainingJob.status }}</span>
          <span class="job-id">Job ID: {{ trainingJob.jobId }}</span>
        </div>
        
        <div class="job-times">
          <div v-if="trainingJob.startTime" class="start-time">
            Started: {{ formatDateTime(trainingJob.startTime) }}
          </div>
          <div v-if="trainingJob.endTime" class="end-time">
            Ended: {{ formatDateTime(trainingJob.endTime) }}
          </div>
          <div v-if="trainingJob.startTime && !trainingJob.endTime" class="duration">
            Duration: {{ formatDuration(trainingJob.startTime) }}
          </div>
        </div>
        
        <div v-if="trainingJob.progress > 0 || trainingJob.status === 'training'" class="progress-section">
          <div class="progress-info">
            <span>Progress: {{ trainingJob.progress }}%</span>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar" :style="{ width: `${trainingJob.progress}%` }"></div>
          </div>
        </div>
        
        <div class="log-section">
          <h4>Training Logs</h4>
          <div class="log-container">
            <div v-for="(log, index) in trainingJob.logs" :key="index" class="log-entry">
              {{ log }}
            </div>
            <div v-if="trainingJob.logs.length === 0" class="no-logs">
              No logs available
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  trainingJob: {
    type: Object,
    required: true
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Compute the appropriate CSS class for the status indicator
const getStatusClass = computed(() => {
  const status = props.trainingJob.status;
  return {
    'status-idle': status === 'idle',
    'status-preparing': status === 'preparing',
    'status-training': status === 'training',
    'status-completed': status === 'completed',
    'status-failed': status === 'failed'
  };
});

// Format date and time
function formatDateTime(dateTimeString) {
  if (!dateTimeString) return '';
  
  const date = new Date(dateTimeString);
  return date.toLocaleString();
}

// Format duration (time elapsed since start)
function formatDuration(startTimeString) {
  if (!startTimeString) return '';
  
  const startTime = new Date(startTimeString);
  const now = new Date();
  const diffMs = now - startTime;
  
  // Convert to seconds, minutes, hours
  const seconds = Math.floor(diffMs / 1000) % 60;
  const minutes = Math.floor(diffMs / (1000 * 60)) % 60;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.no-job-message {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-style: italic;
}

.job-status-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.status-header {
  display: flex;
  align-items: center;
}

.status-text {
  font-weight: 600;
  text-transform: capitalize;
  margin-right: 10px;
}

.job-id {
  font-size: 0.8rem;
  color: #6c757d;
}

.job-times {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  font-size: 0.9rem;
  color: #495057;
}

.progress-section {
  margin: 10px 0;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  font-size: 0.9rem;
}

.log-section h4 {
  margin-bottom: 10px;
  font-size: 1rem;
}

.no-logs {
  color: #6c757d;
  font-style: italic;
  text-align: center;
  padding: 10px;
}
</style>
