<template>
  <div class="classes-section">
    <h4>Classes</h4>
    <ul v-if="projectStore.currentProject?.classes?.length">
      <li 
        v-for="cls in projectStore.currentProject.classes" 
        :key="cls" 
        @click="selectClass(cls)" 
        :style="{ backgroundColor: getColorForClass(cls) }"
      >
        {{ cls }} ({{ annotationSelection.countAnnotationsByClass(cls) }})
      </li>
    </ul>
    <p v-else>No classes defined for this project yet.</p>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import '../styles/ClassesPanel.css';

// Define props
const props = defineProps({
  projectStore: {
    type: Object,
    required: true
  },
  annotationSelection: {
    type: Object,
    required: true
  },
  getColorForClass: {
    type: Function,
    required: true
  }
});

// Define emits
const emit = defineEmits(['classSelected']);

// Methods
function selectClass(className) {
  emit('classSelected', className);
}
</script>

<style scoped>
@import '../styles/ClassesPanel.css';
</style>
