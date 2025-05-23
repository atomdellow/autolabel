<template>
  <div class="detection-settings-section">
    <h4>Detection Settings</h4>
    <div class="detection-method">
      <label>Detection Method:</label>
      <select v-model="detection.detectionMethod">
        <option value="yolo">YOLO (Machine Learning)</option>
        <option value="opencv">OpenCV Contour Detection</option>
        <option value="ssim">Structural Similarity (SSIM)</option>
      </select>
    </div>
    
    <!-- Additional controls for OpenCV detection -->
    <div class="detection-params" v-if="detection.detectionMethod === 'opencv'">
      <div class="param-group">
        <label>Sensitivity:</label>
        <input 
          type="range" 
          v-model.number="detection.detectionParams.sensitivity" 
          min="0.1" 
          max="0.9" 
          step="0.1" 
        />
        <span>{{ detection.detectionParams.sensitivity }}</span>
      </div>
      <div class="param-group">
        <label>Min Area:</label>
        <input 
          type="number" 
          v-model.number="detection.detectionParams.minArea" 
          min="10" 
          max="10000" 
          step="10" 
        />
      </div>
    </div>
    
    <!-- Reference image selector for SSIM -->
    <div class="detection-params" v-if="detection.detectionMethod === 'ssim'">
      <p>Select a reference image to compare with:</p>
      <select v-model="detection.referenceImageId" @change="loadReferenceImage">
        <option value="">None (Select an image)</option>
        <option v-for="img in imageStore.allImages" :key="img._id" :value="img._id">
          {{ img.name }}
        </option>
      </select>
      <div v-if="detection.referenceImagePreview" class="reference-image-preview">
        <img :src="detection.referenceImagePreview" alt="Reference Image" />
      </div>
    </div>
    
    <!-- Detection actions -->
    <div class="detection-actions">
      <button 
        @click="detectShapes" 
        :disabled="isDetecting"
        class="primary-action"
      >
        <span v-if="isDetecting">
          <i class="fas fa-spinner fa-spin"></i> Detecting...
        </span>
        <span v-else>Detect Shapes</span>
      </button>
      
      <button 
        @click="detection.nameAnnotationsWithLLM" 
        :disabled="detection.namingAnnotations || !hasAnnotations"
        class="secondary-action"
        title="Use AI to name annotations based on their visual appearance"
      >
        <span v-if="detection.namingAnnotations">
          <i class="fas fa-spinner fa-spin"></i> {{ detection.namingStatus }}
        </span>
        <span v-else>Auto-Name with AI</span>
      </button>
    </div>
    
    <!-- Progress bar for naming -->
    <div class="progress-container" v-if="detection.namingAnnotations">
      <div class="progress-bar" :style="{ width: `${detection.namingProgress}%` }"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, defineProps } from 'vue';
import '../styles/DetectionPanel.css';

// Define props
const props = defineProps({
  detection: {
    type: Object,
    required: true
  },
  imageStore: {
    type: Object,
    required: true
  }
});

// Local state
const isDetecting = ref(false);

// Computed properties
const hasAnnotations = computed(() => {
  return props.detection.annotationStore && 
         props.detection.annotationStore.currentAnnotations && 
         props.detection.annotationStore.currentAnnotations.length > 0;
});

// Methods
function loadReferenceImage() {
  props.detection.loadReferenceImage();
}

async function detectShapes() {
  isDetecting.value = true;
  try {
    await props.detection.detectShapes();
  } finally {
    isDetecting.value = false;
  }
}
</script>

<style>
.detection-settings-section {
  padding: 10px;
  margin-bottom: 15px;
  border-bottom: 1px solid #ddd;
}

.detection-settings-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 16px;
}

.detection-method {
  margin-bottom: 10px;
}

.detection-method select {
  width: 100%;
  padding: 5px;
  margin-top: 5px;
}

.param-group {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.param-group label {
  flex: 0 0 80px;
  margin-right: 10px;
}

.param-group input[type="range"] {
  flex: 1;
  margin-right: 10px;
}

.param-group input[type="number"] {
  width: 70px;
  padding: 3px 5px;
}

.reference-image-preview {
  margin-top: 10px;
  text-align: center;
}

.reference-image-preview img {
  max-width: 100%;
  max-height: 150px;
  border: 1px solid #ddd;
}

.detection-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.detection-actions button {
  flex: 1;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.detection-actions .primary-action {
  background-color: #4285f4;
  color: white;
  border: none;
}

.detection-actions .secondary-action {
  background-color: #f8f9fa;
  color: #3c4043;
  border: 1px solid #dadce0;
}

.detection-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.progress-container {
  height: 4px;
  width: 100%;
  background-color: #e0e0e0;
  margin-top: 10px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background-color: #4285f4;
  transition: width 0.3s ease;
}
</style>
