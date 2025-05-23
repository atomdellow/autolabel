<template>
  <div class="toolbar">
    <div class="toolbar-title">
      Training Dashboard
    </div>
    
    <div class="toolbar-actions">
      <button 
        class="btn btn-primary" 
        @click="$emit('start-training')" 
        :disabled="!canStartTraining"
      >
        Start Training
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  trainingConfig: {
    type: Object,
    required: true
  },
  canStartTraining: {
    type: Boolean,
    default: false
  }
});

defineEmits(['start-training']);
</script>

<style scoped>
.toolbar {
  padding: 10px 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
}

.toolbar-title {
  font-size: 1.2rem;
  font-weight: 600;
  margin-right: auto;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
}
</style>
