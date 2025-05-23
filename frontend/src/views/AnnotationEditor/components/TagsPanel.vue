<template>
  <div class="tags-section">
    <h4>Tags</h4>
    <div v-if="tagManagement.currentImageTags.value.length > 0" class="tags-display">
      <div v-for="tag in tagManagement.currentImageTags.value" :key="tag" class="tag-pill">
        {{ tag }}
        <button @click="removeTag(tag)" class="remove-tag-btn">&times;</button>
      </div>
    </div>
    <p v-else>No tags yet. Add some below.</p>
    
    <div class="add-tag-input">
      <input 
        type="text" 
        v-model="tagManagement.newTagInput.value" 
        placeholder="Enter new tag" 
        @keyup.enter="addTag"
      />
      <button @click="addTag">Add</button>
    </div>
    <p v-if="tagManagement.tagError.value" class="error">{{ tagManagement.tagError.value }}</p>
  </div>
</template>

<script setup>
import { defineProps } from 'vue';
import '../styles/TagPanel.css';

// Define props
const props = defineProps({
  tagManagement: {
    type: Object,
    required: true
  },
  imageId: {
    type: String,
    required: true
  }
});

// Methods
function addTag() {
  props.tagManagement.addTag(props.imageId);
}

function removeTag(tag) {
  props.tagManagement.removeTag(tag, props.imageId);
}
</script>

<style scoped>
@import '../styles/TagPanel.css';
</style>
