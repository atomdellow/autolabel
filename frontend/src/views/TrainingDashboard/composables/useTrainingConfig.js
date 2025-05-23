import { ref, computed } from 'vue';

/**
 * Composable for managing training configuration
 * @param {Object} trainingStore - The training store
 * @returns {Object} - Training configuration state and methods
 */
export function useTrainingConfig(trainingStore) {
  // Initialize with values from the store
  const trainingConfig = ref({
    baseModelName: trainingStore.trainingConfig.baseModelName,
    epochs: trainingStore.trainingConfig.epochs,
    batchSize: trainingStore.trainingConfig.batchSize,
    imgSize: trainingStore.trainingConfig.imgSize,
    trainSplit: trainingStore.trainingConfig.trainSplit
  });

  /**
   * Update configuration values
   * @param {Object} newConfig - New configuration values to apply
   */
  function updateTrainingConfig(newConfig) {
    // Update local state
    trainingConfig.value = { ...trainingConfig.value, ...newConfig };
    
    // Update store state
    trainingStore.setTrainingConfig(trainingConfig.value);
  }

  // Available base models (could be fetched from an API)
  const availableBaseModels = computed(() => [
    { id: 'yolov8n.pt', name: 'YOLOv8 Nano', description: 'Fast, lightweight model (3.4M parameters)' },
    { id: 'yolov8s.pt', name: 'YOLOv8 Small', description: 'Balanced speed/accuracy (11.5M parameters)' },
    { id: 'yolov8m.pt', name: 'YOLOv8 Medium', description: 'Better accuracy, slower (26.2M parameters)' },
    { id: 'yolov8l.pt', name: 'YOLOv8 Large', description: 'High accuracy, slower (44.1M parameters)' },
    { id: 'yolov8x.pt', name: 'YOLOv8 XLarge', description: 'Best accuracy, slowest (69.4M parameters)' }
  ]);

  return {
    trainingConfig,
    updateTrainingConfig,
    availableBaseModels
  };
}
