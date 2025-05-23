// Helper function to validate MongoDB ObjectId
function isValidObjectId(id) {
  if (!id) return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

// Use this function in TrainingView.vue to validate projectId before starting training
async function validateProjectId(projectId) {
  if (!projectId) {
    throw new Error('No project selected for training');
  }
  
  if (!isValidObjectId(projectId)) {
    throw new Error(`Invalid project ID format: ${projectId}`);
  }
  
  return true;
}

export { isValidObjectId, validateProjectId };
