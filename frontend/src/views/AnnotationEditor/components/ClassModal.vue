<template>
  <div v-if="isVisible" class="modal-overlay">
    <div class="modal-content">
      <h3>Assign Class</h3>
      <input 
        type="text" 
        v-model="localClassName" 
        placeholder="Enter class name" 
        @keyup.enter="confirmClassInput"
        ref="classInputRef"
      />
      <div v-if="projectStore.currentProject?.classes?.length">
        <p>Existing classes:</p>
        <div class="existing-classes">
          <button 
            v-for="cls in projectStore.currentProject.classes" 
            :key="cls" 
            @click="selectExistingClass(cls)"
            :style="{ backgroundColor: getColorForClass(cls) }"
          >
            {{ cls }}
          </button>
        </div>
      </div>
      <div class="modal-buttons">
        <button @click="confirmClassInput" class="confirm-btn">Confirm</button>
        <button @click="cancelClassInput" class="cancel-btn">Cancel</button>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits, watch, nextTick } from 'vue';
import '../styles/ClassModal.css';

// Define props
const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  initialClassName: {
    type: String,
    default: ''
  },
  projectStore: {
    type: Object,
    required: true
  },
  getColorForClass: {
    type: Function,
    required: true
  }
});

// Define emits
const emit = defineEmits(['confirm', 'cancel']);

// Local state
const localClassName = ref('');
const error = ref('');
const classInputRef = ref(null);

// Watch for changes to initial class name and visibility
watch(() => props.initialClassName, (newVal) => {
  localClassName.value = newVal;
});

watch(() => props.isVisible, (isVisible) => {
  if (isVisible) {
    error.value = '';
    // Focus the input when the modal becomes visible
    nextTick(() => {
      if (classInputRef.value) {
        classInputRef.value.focus();
      }
    });
  }
});

// Methods
function confirmClassInput() {
  const className = localClassName.value.trim();
  
  if (!className) {
    error.value = 'Please enter a class name';
    return;
  }
  
  // Validate the class name (optional, based on project requirements)
  if (className.length < 2) {
    error.value = 'Class name must be at least 2 characters long';
    return;
  }
  
  emit('confirm', className);
  reset();
}

function cancelClassInput() {
  emit('cancel');
  reset();
}

function selectExistingClass(className) {
  localClassName.value = className;
}

function reset() {
  localClassName.value = '';
  error.value = '';
}
</script>

<style scoped>
@import '../styles/ClassModal.css';
</style>
