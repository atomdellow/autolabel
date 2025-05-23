<template>
  <div class="panel metrics-panel">
    <div class="panel-header">
      <h3 class="panel-title">Model Metrics</h3>
      <div v-if="isLoading" class="loading-spinner"></div>
    </div>
    
    <div class="panel-content">
      <div v-if="!selectedModel" class="no-model-selected">
        Select a model to view metrics
      </div>
      
      <div v-else class="metrics-container">
        <div class="metrics-summary">
          <div class="metric-card">
            <div class="metric-label">Precision</div>
            <div class="metric-value">{{ formatMetric(metricsData.precision) }}</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">Recall</div>
            <div class="metric-value">{{ formatMetric(metricsData.recall) }}</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">mAP@50</div>
            <div class="metric-value">{{ formatMetric(metricsData.mAP50) }}</div>
          </div>
          
          <div class="metric-card">
            <div class="metric-label">mAP@50-95</div>
            <div class="metric-value">{{ formatMetric(metricsData.mAP50_95) }}</div>
          </div>
        </div>
        
        <div class="metrics-details">
          <h4>Performance by Class</h4>
          <div v-if="Object.keys(metricsData.classMetrics).length === 0" class="no-class-metrics">
            No class-specific metrics available
          </div>
          <div v-else class="class-metrics-list">
            <!-- Class metrics would be displayed here -->
            <!-- This would typically be a table or chart -->
            <div class="placeholder-chart">
              Class-specific metrics visualization
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineExpose, ref, watch } from 'vue';
import { useMetricsVisualization } from '../composables/useMetricsVisualization';

const props = defineProps({
  selectedModel: {
    type: Object,
    default: null
  },
  isLoading: {
    type: Boolean,
    default: false
  }
});

// Use the metrics visualization composable
const selectedModelRef = ref(props.selectedModel);
const { metricsData, isLoadingMetrics } = useMetricsVisualization(selectedModelRef);

// Format metric value as percentage
function formatMetric(value) {
  if (value === undefined || value === null) return 'N/A';
  return `${(value * 100).toFixed(1)}%`;
}

// Update the selected model ref when the prop changes
watch(() => props.selectedModel, (newModel) => {
  selectedModelRef.value = newModel;
});

// Expose functions that might be needed by the parent component
defineExpose({
  formatMetric
});
</script>

<style scoped>
.no-model-selected {
  text-align: center;
  padding: 20px;
  color: #6c757d;
  font-style: italic;
}

.metrics-summary {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.metric-card {
  background-color: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: bold;
  margin: 10px 0;
}

.metric-label {
  font-size: 0.9rem;
  color: #6c757d;
  text-align: center;
}

.metrics-details h4 {
  margin-bottom: 15px;
  font-size: 1rem;
}

.no-class-metrics {
  text-align: center;
  padding: 15px;
  color: #6c757d;
  font-style: italic;
}

.placeholder-chart {
  background-color: #f8f9fa;
  border: 1px dashed #ced4da;
  border-radius: 4px;
  height: 200px;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #6c757d;
  font-style: italic;
}
</style>
