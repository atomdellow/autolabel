import { ref, watch } from 'vue';

/**
 * Composable for handling model selection functionality
 * @param {Object} trainingStore - The training store
 * @returns {Object} - Model selection state and functions
 */
export function useModelSelection(trainingStore) {
  // Selected model state
  const selectedModel = ref(null);

  /**
   * Select a model by ID
   * @param {string} modelId - The model ID to select
   */
  function selectModel(modelId) {
    const model = trainingStore.trainedModels.find(m => m._id === modelId);
    if (model) {
      selectedModel.value = model;
    }
  }

  /**
   * Reset the selected model
   */
  function resetSelectedModel() {
    selectedModel.value = null;
  }

  // Watch for changes in the trainedModels array
  // If the current selection is no longer available, reset it
  watch(() => trainingStore.trainedModels, (newModels) => {
    if (selectedModel.value && !newModels.some(m => m._id === selectedModel.value._id)) {
      resetSelectedModel();
    }
  });

  return {
    selectedModel,
    selectModel,
    resetSelectedModel
  };
}
