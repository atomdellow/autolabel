<template>
  <div class="layers-section">
    <h4>Layers (Annotations)</h4>
    <div class="layers-controls">
      <button @click="selectAllAnnotations" class="select-all-btn">Select All</button>
      <button @click="deleteSelectedAnnotations" class="delete-selected-btn" :disabled="annotationSelection.selectedAnnotationIds.length === 0">
        Delete Selected ({{ annotationSelection.selectedAnnotationIds.length }})
      </button>
    </div>
    <ul v-if="annotationStore.currentAnnotations.length">
      <li 
        v-for="(ann, index) in annotationStore.currentAnnotations" 
        :key="ann._id"
        @mouseover="highlightAnnotation(ann)" 
        @mouseleave="unhighlightAnnotation"
        :class="{ 
          'highlighted': isHighlighted(ann._id), 
          'editing': isEditing(ann._id),
          'has-history': hasAnnotationHistory(ann._id),
          'selected': annotationSelection.isAnnotationSelected(ann._id)
        }"
        :style="{ borderLeftColor: getColorForClass(ann.label) }"
      >
        <div class="annotation-item">
          <div class="annotation-checkbox">
            <input 
              type="checkbox" 
              :id="'select-' + ann._id" 
              :checked="annotationSelection.isAnnotationSelected(ann._id)"
              @change="toggleAnnotationSelection(ann._id)" 
            />
          </div>
          <span class="annotation-label">
            {{ ann.label }} #{{ index + 1 }}
            <small 
              v-if="hasAnnotationHistory(ann._id)" 
              title="This annotation has undo/redo history" 
              class="history-indicator"
            ></small>
          </span>
          <div class="annotation-buttons">
            <button @click="startEditingAnnotation(ann)" class="edit-ann-btn" title="Edit this annotation">Edit</button>
            <button @click="deleteAnnotation(ann._id)" class="delete-ann-btn" title="Delete this annotation">Delete</button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else>No annotations yet.</p>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, ref } from 'vue';
import '../styles/LayersPanel.css';

// Define props
const props = defineProps({
  annotationStore: {
    type: Object,
    required: true
  },
  annotationSelection: {
    type: Object,
    required: true
  },
  annotationEdit: {
    type: Object,
    required: true
  },
  annotationHistory: {
    type: Object,
    required: true
  },
  getColorForClass: {
    type: Function,
    required: true
  }
});

// Define emits
const emit = defineEmits(['deleteAnnotation', 'deleteSelectedAnnotations']);

// Local state
const highlightedAnnotationId = ref(null);

// Methods
function highlightAnnotation(annotation) {
  highlightedAnnotationId.value = annotation._id;
  emit('highlightAnnotation', annotation);
}

function unhighlightAnnotation() {
  highlightedAnnotationId.value = null;
  emit('unhighlightAnnotation');
}

function isHighlighted(annotationId) {
  return highlightedAnnotationId.value === annotationId;
}

function isEditing(annotationId) {
  return props.annotationEdit.editingAnnotationId === annotationId;
}

function hasAnnotationHistory(annotationId) {
  return props.annotationHistory.hasAnnotationHistory(annotationId);
}

function selectAllAnnotations() {
  props.annotationSelection.selectAllAnnotations();
}

function toggleAnnotationSelection(annotationId) {
  props.annotationSelection.toggleAnnotationSelection(annotationId);
}

function startEditingAnnotation(annotation) {
  props.annotationEdit.startEditingAnnotation(annotation);
}

function deleteAnnotation(annotationId) {
  emit('deleteAnnotation', annotationId);
}

function deleteSelectedAnnotations() {
  emit('deleteSelectedAnnotations');
}
</script>

<style scoped>
@import '../styles/LayersPanel.css';
</style>
