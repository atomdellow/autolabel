<template>
  <div class="training-form">
    <h2>Configure Training</h2>
    
    <form @submit.prevent="submitForm">
      <!-- Training Data Selection -->
      <div class="form-section">
        <h3>Training Data</h3>
            <div class="form-group">
          <label for="projectSelect">Select Project:</label>
          <select 
            id="projectSelect" 
            v-model="trainingConfig.projectId"
            @change="loadProjectData"
            required
          >
            <option value="" disabled>Select a project</option>
            <option 
              v-for="project in projects" 
              :key="project._id" 
              :value="project._id"
            >
              {{ project.name }}
            </option>
          </select>
          <p v-if="!trainingConfig.projectId" class="help-text error">Please select a project to train on</p>
          <p v-else class="help-text">Training will use annotations from the selected project</p>
        </div>

        <div class="form-group">
          <label>JSON Training Data Upload:</label>
          <div class="file-upload">
            <label class="file-upload-label">
              <input 
                type="file" 
                accept=".json" 
                @change="handleJsonUpload" 
                multiple
              >
              <span class="btn-upload">Select JSON Files</span>
            </label>
            <span class="selected-files" v-if="selectedFiles.length">
              {{ selectedFiles.length }} file(s) selected
            </span>
          </div>
          <p class="help-text">Upload JSON files for training (Roboflow format supported)</p>
        </div>
      </div>

      <!-- Model Configuration -->
      <div class="form-section">
        <h3>Model Configuration</h3>
        
        <div class="form-group">
          <label for="modelTypeSelect">Model Type:</label>
          <select id="modelTypeSelect" v-model="trainingConfig.modelType" required>
            <option value="yolov8n">YOLOv8n (Object Detection)</option>
          </select>
        </div>

        <div class="form-group">
          <label for="epochsInput">Epochs:</label>
          <input 
            type="number" 
            id="epochsInput" 
            v-model.number="trainingConfig.epochs" 
            min="1" 
            max="300"
            required
          >
        </div>

        <div class="form-group">
          <label for="batchSizeInput">Batch Size:</label>
          <input 
            type="number" 
            id="batchSizeInput" 
            v-model.number="trainingConfig.batchSize" 
            min="1" 
            max="64"
            required
          >
        </div>

        <div class="form-group">
          <label>Processing Unit:</label>
          <div class="radio-group">
            <label>
              <input type="radio" v-model="trainingConfig.useGPU" :value="true">
              GPU (Faster, requires compatible hardware)
            </label>
            <label>
              <input type="radio" v-model="trainingConfig.useGPU" :value="false">
              CPU (Slower, works on all systems)
            </label>
          </div>
        </div>
      </div>

      <!-- Advanced Options -->
      <div class="form-section">
        <h3>Advanced Options</h3>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="showAdvancedOptions">
            Show Advanced Options
          </label>
        </div>

        <div v-if="showAdvancedOptions" class="advanced-options">
          <div class="form-group">
            <label for="learningRateInput">Learning Rate:</label>
            <input 
              type="number" 
              id="learningRateInput" 
              v-model.number="trainingConfig.learningRate" 
              step="0.0001"
              min="0.0001"
              max="0.1"
            >
          </div>          <div class="form-group">
            <label for="imgSizeInput">Image Size:</label>
            <select id="imgSizeInput" v-model="trainingConfig.imgSize">
              <option value="640x480">640 x 480</option>
              <option value="640x640">640 x 640</option>
              <option value="1280x720">1280 x 720</option>
              <option value="1920x1080">1920 x 1080</option>
              <option value="custom">Custom Size</option>
            </select>
          </div>
          
          <div class="form-group" v-if="trainingConfig.imgSize === 'custom'">
            <div class="custom-size-inputs">
              <div>
                <label for="customWidthInput">Width:</label>
                <input 
                  type="number" 
                  id="customWidthInput" 
                  v-model.number="trainingConfig.customWidth"
                  min="320" 
                  max="1920"
                  step="32"
                />
              </div>
              <div>
                <label for="customHeightInput">Height:</label>
                <input 
                  type="number" 
                  id="customHeightInput" 
                  v-model.number="trainingConfig.customHeight"
                  min="240" 
                  max="1080"
                  step="32"
                />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label for="validationSplitInput">Validation Split (%):</label>
            <input 
              type="number" 
              id="validationSplitInput" 
              v-model.number="trainingConfig.validationSplit" 
              min="10" 
              max="40"
            >
          </div>
        </div>
      </div>

      <div class="form-actions">
        <button 
          type="submit" 
          class="btn-primary" 
          :disabled="trainingInProgress || !isFormValid"
        >
          <span v-if="trainingInProgress">Training in Progress...</span>
          <span v-else>Start Training</span>
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useProjectStore } from '../../store/projectStore';
import trainingService from '../../services/trainingService';
import { useToast } from 'vue-toastification';

// Props
const props = defineProps({
  trainingInProgress: {
    type: Boolean,
    default: false
  }
});

// Emits
const emit = defineEmits(['start-training']);

// Store
const projectStore = useProjectStore();

// Toast
const toast = useToast();

// State
const projects = ref([]);
const selectedFiles = ref([]);
const showAdvancedOptions = ref(false);

// Training configuration
const trainingConfig = reactive({
  projectId: '',
  modelType: 'yolov8n',
  epochs: 50,
  batchSize: 16,
  useGPU: true,
  jsonFiles: [],
  learningRate: 0.001,
  imgSize: '640x480',
  customWidth: 640,
  customHeight: 480,
  validationSplit: 20
});

// Form validation
const isFormValid = computed(() => {
  const hasProject = !!trainingConfig.projectId;
  const hasJsonFiles = selectedFiles.value.length > 0;
  const hasValidEpochs = trainingConfig.epochs > 0;
  
  console.log('Form validation:', { 
    hasProject, 
    hasJsonFiles, 
    hasValidEpochs, 
    projectId: trainingConfig.projectId
  });
  
  return (hasProject || hasJsonFiles) && hasValidEpochs;
});

// Load projects on component mount
onMounted(async () => {
  try {
    await projectStore.loadProjects();
    projects.value = projectStore.allProjects;
  } catch (error) {
    console.error('Failed to load projects:', error);
  }
});

// Load project data
async function loadProjectData() {
  try {
    console.log(`Selected project ID: ${trainingConfig.projectId}`);
    if (!trainingConfig.projectId) {
      console.warn('No project selected yet');
      return;
    }
    
    // Find the selected project in the projects array
    const selectedProject = projects.value.find(p => p._id === trainingConfig.projectId);
    if (selectedProject) {
      console.log(`Found selected project: ${selectedProject.name}`, selectedProject);
    } else {
      console.warn(`Selected project with ID ${trainingConfig.projectId} not found in loaded projects`);
    }
  } catch (error) {
    console.error('Error loading project data:', error);
  }
}

// Handle JSON file uploads
function handleJsonUpload(event) {
  const files = Array.from(event.target.files);
  selectedFiles.value = files;
  trainingConfig.jsonFiles = files;
}

// Submit form
async function submitForm() {
  if (!isFormValid.value) {
    console.error('Form is not valid, cannot submit');
    toast.error('Please complete all required fields before starting training.');
    return;
  }
  
  if (!trainingConfig.projectId) {
    console.error('No project selected, cannot submit form');
    toast.error('Please select a project before starting training.');
    return;
  }
  
  try {
    // First verify prerequisites
    const prerequisiteCheck = await trainingService.verifyTrainingPrerequisites(trainingConfig.projectId);
    const checkResult = prerequisiteCheck.data;
    
    if (!checkResult.canProceed) {
      console.error('Cannot proceed with training due to issues:', checkResult.issues);
      toast.error(`Training cannot proceed due to the following issues:\n${checkResult.issues.join('\n')}`);
      return;
    }
    
    if (checkResult.warnings && checkResult.warnings.length > 0) {
      const proceed = confirm(`Training can proceed but there are warnings:\n${checkResult.warnings.join('\n')}\n\nDo you want to continue?`);
      if (!proceed) {
        return;
      }
    }
    
    console.log('Submitting training configuration:', trainingConfig);
  
  // Create FormData for file upload
  const formData = new FormData();
  
  // Add JSON files to form data
  for (const file of trainingConfig.jsonFiles) {
    formData.append('jsonFiles', file);
  }
  // Add other training parameters
  formData.append('projectId', trainingConfig.projectId);
  formData.append('modelType', trainingConfig.modelType);
  
  // Ensure baseModelName is properly formed
  const baseModelName = trainingConfig.modelType + '.pt';
  formData.append('baseModelName', baseModelName);
  
  // Convert to number and ensure positive values
  const epochs = Math.max(1, parseInt(trainingConfig.epochs) || 50);
  formData.append('epochs', epochs);
  
  const batchSize = Math.max(1, parseInt(trainingConfig.batchSize) || 16);
  formData.append('batchSize', batchSize);
  
  // Convert boolean to string for FormData
  formData.append('useGPU', trainingConfig.useGPU ? 'true' : 'false');
  
  // Add learning rate with bounds checking (typical values between 0.0001 and 0.1)
  const learningRate = Math.min(0.1, Math.max(0.0001, parseFloat(trainingConfig.learningRate) || 0.001));
  formData.append('learningRate', learningRate);
  
  // Handle image size
  if (trainingConfig.imgSize === 'custom') {
    formData.append('imgWidth', trainingConfig.customWidth);
    formData.append('imgHeight', trainingConfig.customHeight);
    formData.append('imgSize', `${trainingConfig.customWidth}x${trainingConfig.customHeight}`);
  } else {
    // Parse width and height from predefined size
    const [width, height] = trainingConfig.imgSize.split('x');
    formData.append('imgWidth', width);
    formData.append('imgHeight', height);
    formData.append('imgSize', trainingConfig.imgSize);  }
  
  // Ensure validation split is between 0.1 and 0.9 (10-90%)
  const validationSplit = Math.min(0.9, Math.max(0.1, (100 - parseInt(trainingConfig.validationSplit)) / 100 || 0.2));
  formData.append('validationSplit', validationSplit);
  formData.append('trainSplit', 1 - validationSplit);
    // Log FormData for debugging
  console.log('FormData entries:');
  for (let [key, value] of formData.entries()) {
    console.log(`${key}: ${value}`);
  }
    // Emit event with form data
  emit('start-training', formData);
  } catch (error) {
    console.error('Error in form submission:', error);
    toast.error(`Error starting training: ${error.message}`);
  }
}
</script>

<style scoped>
.training-form {
  width: 100%;
}

.form-section {
  margin-bottom: 25px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.form-section h3 {
  font-size: 18px;
  margin-bottom: 15px;
  color: #333;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.help-text {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}

.help-text.error {
  color: #d03050;
  font-weight: bold;
}

select,
input[type="number"],
input[type="text"] {
  width: 100%;
  padding: 8px 12px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.radio-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: normal;
}

.checkbox-label {
  display: flex;
  align-items: center;
  font-weight: normal;
}

.checkbox-label input {
  margin-right: 8px;
}

.file-upload {
  display: flex;
  align-items: center;
}

.file-upload-label {
  display: inline-block;
}

.file-upload-label input {
  display: none;
}

.btn-upload {
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px 15px;
  cursor: pointer;
  display: inline-block;
}

.btn-upload:hover {
  background: #e4e4e4;
}

.selected-files {
  margin-left: 10px;
  color: #666;
}

.form-actions {
  margin-top: 25px;
}

.btn-primary {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background-color: #3e8e41;
}

.custom-size-inputs {
  display: flex;
  gap: 10px;
  margin-top: 5px;
}

.custom-size-inputs > div {
  flex: 1;
}

.custom-size-inputs label {
  display: block;
  margin-bottom: 5px;
  font-size: 0.9em;
}

.custom-size-inputs input {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.btn-primary:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.advanced-options {
  margin-top: 15px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #eee;
}
</style>
