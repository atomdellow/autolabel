<template>
  <div class="toolbar">
    <h3>Tools</h3>    <button 
      @click="annotationDraw.setTool('rectangle')" 
      :class="{ active: annotationDraw.currentTool.value === 'rectangle' }"
    >
      Rectangle
    </button>
    <button 
      @click="annotationDraw.setTool('pan')" 
      :class="{ active: annotationDraw.currentTool.value === 'pan' }"
    >
      Pan
    </button>
    <button 
      @click="annotationDraw.setTool('select')" 
      :class="{ active: annotationDraw.currentTool.value === 'select' }"
    >
      Select
    </button>
    
    <div class="zoom-controls">      <button @click="zoomPan.zoomOut()" title="Zoom Out">
        <span>-</span>
      </button>
      <span class="zoom-level">{{ Math.round((zoomPan.zoomLevel.value || 1) * 100) }}%</span>
      <button @click="zoomPan.zoomIn()" title="Zoom In">
        <span>+</span>
      </button>
      <button @click="zoomPan.resetZoom()" title="Reset Zoom">
        <span>Reset</span>
      </button>
      <!-- Add debug test button for zoom functionality -->      <button 
        @click="testZoom" 
        v-if="annotationStore.currentAnnotations && annotationStore.currentAnnotations.length > 0" 
        title="Test Zoom Functionality"
      >
        <span>Test Zoom</span>
      </button>
    </div>
    
    <button 
      @click="detectShapes" 
      :disabled="isDetecting" 
      title="Auto-detect shapes in the image"
    >
      <span v-if="isDetecting">Detecting...</span>
      <span v-else>Detect Shapes</span>
    </button>
    
    <button 
      @click="annotationHistory.undo()" 
      :disabled="!annotationHistory.canUndo" 
      :title="annotationHistory.canUndo ? `Undo ${annotationHistory.getUndoActionDescription()}` : 'Nothing to undo'"
    >
      Undo<span v-if="annotationHistory.canUndo"> ({{ annotationHistory.undoStack.length }})</span>
    </button>
    
    <button 
      @click="annotationHistory.redo()" 
      :disabled="!annotationHistory.canRedo" 
      :title="annotationHistory.canRedo ? `Redo ${annotationHistory.getRedoActionDescription()}` : 'Nothing to redo'"
    >
      Redo<span v-if="annotationHistory.canRedo"> ({{ annotationHistory.redoStack.length }})</span>
    </button>
  </div>
</template>

<script setup>
import { ref, defineProps } from 'vue';
import '../styles/Toolbar.css';

// Define props
const props = defineProps({
  annotationDraw: {
    type: Object,
    required: true
  },
  zoomPan: {
    type: Object,
    required: true
  },
  annotationHistory: {
    type: Object,
    required: true
  },
  annotationStore: {
    type: Object,
    required: true
  },
  detection: {
    type: Object,
    required: true
  }
});

// Local state
const isDetecting = ref(false);

// Test zoom function
function testZoom() {
  if (props.annotationStore.currentAnnotations && props.annotationStore.currentAnnotations.length > 0) {
    console.log('Running zoom test with annotations:', props.annotationStore.currentAnnotations.length);
    props.zoomPan.runAnnotationZoomTest(props.annotationStore.currentAnnotations.length);
  } else {
    console.warn('No annotations available for zoom test');
  }
}

// Detection function
async function detectShapes() {
  isDetecting.value = true;
  try {
    await props.detection.detectShapes();  } finally {
    isDetecting.value = false;
  }
}
</script>

<style scoped>
@import '../styles/Toolbar.css';
</style>
