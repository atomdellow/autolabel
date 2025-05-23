// composable for managing image tags
import { ref, computed } from 'vue';
import { useToast } from 'vue-toastification';

export function useTagManagement(imageStore) {
  const currentImageTags = ref([]);
  const newTagInput = ref('');
  const tagError = ref('');
  const toast = useToast();

  // Initialize tags for an image
  function initializeTagsForImage(imageId) {
    const currentImage = imageStore.getImageById(imageId);
    if (currentImage) {
      currentImageTags.value = currentImage.tags || [];
    }
    return currentImageTags.value;
  }

  // Add a new tag
  function addTag(imageId) {
    if (!newTagInput.value) {
      tagError.value = 'Please enter a tag';
      return;
    }
    
    const tag = newTagInput.value.trim();
    
    // Check if tag already exists
    if (currentImageTags.value.includes(tag)) {
      tagError.value = 'Tag already exists';
      return;
    }
    
    // Add the tag to the current image
    const updatedTags = [...currentImageTags.value, tag];
    
    // Save to the database through the image store
    return imageStore.updateImageTags(imageId, updatedTags)
      .then(() => {
        // Update local state
        currentImageTags.value = updatedTags;
        
        // Reset input and error
        newTagInput.value = '';
        tagError.value = '';
        
        toast.success(`Added tag: ${tag}`);
        return updatedTags;
      })
      .catch(error => {
        console.error('Error adding tag:', error);
        tagError.value = 'Failed to add tag';
        throw error;
      });
  }

  // Remove a tag
  function removeTag(tag, imageId) {
    if (!tag) return;
    
    // Remove the tag from the current image
    const updatedTags = currentImageTags.value.filter(t => t !== tag);
    
    // Save to the database
    return imageStore.updateImageTags(imageId, updatedTags)
      .then(() => {
        // Update local state
        currentImageTags.value = updatedTags;
        
        toast.success(`Removed tag: ${tag}`);
        return updatedTags;
      })
      .catch(error => {
        console.error('Error removing tag:', error);
        toast.error('Failed to remove tag');
        throw error;
      });
  }

  // Clear all tag-related state
  function resetTagState() {
    currentImageTags.value = [];
    newTagInput.value = '';
    tagError.value = '';
  }

  return {
    // State
    currentImageTags,
    newTagInput,
    tagError,

    // Methods
    initializeTagsForImage,
    addTag,
    removeTag,
    resetTagState
  };
}
