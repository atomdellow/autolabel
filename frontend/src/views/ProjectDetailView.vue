<template>  <div class="project-detail-view" v-if="projectStore.currentProject">
    <BreadcrumbNav>
      <router-link to="/dashboard">Dashboard</router-link> &gt;
      <span>{{ projectStore.currentProject.name }}</span>
    </BreadcrumbNav>
    <h1>{{ projectStore.currentProject.name }}</h1>
    <p>{{ projectStore.currentProject.description }}</p>
    <p><small>Model Type: {{ projectStore.currentProject.modelType }}</small></p>
    <p><small>Created: {{ new Date(projectStore.currentProject.createdAt).toLocaleDateString() }}</small></p>

    <div class="image-upload-section card">
      <h2>Upload Images</h2>
      <input type="file" multiple @change="handleFileSelect" accept="image/jpeg, image/png" />
      <button @click="handleImageUpload" :disabled="!selectedFiles.length || imageStore.isLoading">
        {{ imageStore.isLoading ? 'Uploading...' : 'Upload Selected' }}
      </button>
      <p v-if="imageStore.imageError" class="error">{{ imageStore.imageError }}</p>
      <p v-if="uploadSuccessMessage" class="success">{{ uploadSuccessMessage }}</p>
    </div>

    <!-- Training Configuration Section -->
    <div class="training-config-section card">
      <h2>Training Configuration</h2>
      <form @submit.prevent="handleStartTraining">
        <div class="form-group">
          <label for="baseModelName">Base Model:</label>
          <input type="text" id="baseModelName" v-model="trainingStore.trainingConfig.baseModelName">
        </div>
        <div class="form-group">
          <label for="epochs">Epochs:</label>
          <input type="number" id="epochs" v-model.number="trainingStore.trainingConfig.epochs" min="1">
        </div>
        <div class="form-group">
          <label for="batchSize">Batch Size:</label>
          <input type="number" id="batchSize" v-model.number="trainingStore.trainingConfig.batchSize" min="1">
        </div>
        <div class="form-group">
          <label for="imgSize">Image Size (px):</label>
          <input type="number" id="imgSize" v-model.number="trainingStore.trainingConfig.imgSize" min="32" step="32">
        </div>
        <div class="form-group">
          <label for="trainSplit">Train/Validation Split (Train %):</label>
          <input type="number" id="trainSplit" v-model.number="trainingStore.trainingConfig.trainSplit" min="0.1" max="0.9" step="0.05">
        </div>
        <!-- Add more config fields as needed -->
      </form>
    </div>

    <!-- Model Training Section -->
    <div class="training-section card">
      <h2>Model Training</h2>
      <button @click="handleStartTraining" :disabled="trainingStore.isTrainingActive || trainingStore.isStartingTraining || imageStore.annotatedImages.length === 0">
        {{ trainingStore.isStartingTraining ? 'Initiating...' : (trainingStore.isTrainingActive ? 'Training in Progress...' : 'Start Training') }}
      </button>
      <p v-if="!imageStore.annotatedImages.length && !imageStore.isLoading && !projectStore.isLoading">
        You need at least one annotated image to start training.
      </p>
      
      <div v-if="trainingStore.startTrainingError" class="error">
        Error starting training: {{ trainingStore.startTrainingError }}
      </div>
  
      <div v-if="trainingStore.currentTrainingJob && trainingStore.currentTrainingJob.status !== 'idle'" class="training-status">
        <h3>Current Training Job</h3>
        <p><strong>Status:</strong> {{ trainingStore.currentTrainingJob.status }}</p>
        <p v-if="trainingStore.currentTrainingJob.startTime"><strong>Start Time:</strong> {{ new Date(trainingStore.currentTrainingJob.startTime).toLocaleString() }}</p>
        <p v-if="trainingStore.currentTrainingJob.endTime"><strong>End Time:</strong> {{ new Date(trainingStore.currentTrainingJob.endTime).toLocaleString() }}</p>
        <p v-if="trainingStore.isTrainingActive"><strong>Progress:</strong> {{ trainingStore.currentTrainingJob.progress }}%</p>
        
        <div v-if="trainingStore.currentTrainingJob.logs && trainingStore.currentTrainingJob.logs.length">
          <h4>Logs:</h4>
          <pre class="logs-output">{{ trainingStore.formattedLogs }}</pre>
        </div>
        <p v-if="trainingStore.statusError" class="error">Error fetching status: {{ trainingStore.statusError }}</p>
      </div>
    </div>

    <!-- Trained Models Section -->
    <div class="trained-models-section card">
      <h2>Trained Models</h2>
      <button @click="handleRefreshModels" :disabled="trainingStore.isLoadingModels"> 
        {{ trainingStore.isLoadingModels ? 'Refreshing...' : 'Refresh Model List' }}
      </button>
      <p v-if="trainingStore.modelsError" class="error">{{ trainingStore.modelsError }}</p>
      <div v-if="trainingStore.isLoadingModels && !trainingStore.trainedModels.length">Loading models...</div>
      <ul v-else-if="trainingStore.trainedModels.length" class="model-list">
        <li v-for="model in trainingStore.trainedModels" :key="model.name" class="model-item">
          <p><strong>{{ model.name }}</strong></p>
          <p>Size: {{ (model.size / (1024*1024)).toFixed(2) }} MB</p>
          <p>Created: {{ new Date(model.createdAt).toLocaleString() }}</p>
          <!-- Add download or use model button here later -->
        </li>
      </ul>
      <p v-else-if="!trainingStore.isLoadingModels">No trained models found for this project.</p>
    </div>

    <div class="image-lists">
      <section class="unannotated-images card">
        <h2>Unannotated Images ({{ imageStore.unannotatedImages.length }})</h2>
        <div v-if="imageStore.isLoading">Loading images...</div>
        <ul v-else-if="imageStore.unannotatedImages.length" class="image-grid">
          <li v-for="image in imageStore.unannotatedImages" :key="image._id" class="image-item">
            <img :src="getImageUrl(image.path)" :alt="image.name" class="thumbnail" />
            <p>{{ image.name }}</p>
            <div class="actions">
              <router-link :to="{ name: 'AnnotationEditor', params: { projectId: projectStore.currentProject._id, imageId: image._id } }">
                <button>Annotate</button>
              </router-link>
              <button @click="handleDeleteImage(image._id)" class="delete-button" :disabled="imageStore.isLoading">Delete</button>
            </div>
          </li>
        </ul>
        <p v-else>No unannotated images.</p>
      </section>

      <section class="annotated-images card">
        <h2>Annotated Images ({{ imageStore.annotatedImages.length }})</h2>
        <div v-if="imageStore.isLoading">Loading images...</div>
        <ul v-else-if="imageStore.annotatedImages.length" class="image-grid">
          <li v-for="image in imageStore.annotatedImages" :key="image._id" class="image-item">
            <img :src="getImageUrl(image.path)" :alt="image.name" class="thumbnail" />
            <p>{{ image.name }}</p>
            <div class="actions">
              <router-link :to="{ name: 'AnnotationEditor', params: { projectId: projectStore.currentProject._id, imageId: image._id } }">
                <button>View/Edit Annotations</button>
              </router-link>
              <button @click="handleDeleteImage(image._id)" class="delete-button" :disabled="imageStore.isLoading">Delete</button>
            </div>
          </li>
        </ul>
        <p v-else>No annotated images yet. Annotate some images to see them here.</p>
      </section>
    </div>
  </div>
  <div v-else-if="projectStore.isLoading">Loading project details...</div>
  <div v-else>
    <p>Project not found or error loading project.</p>
    <router-link to="/dashboard">Go to Dashboard</router-link>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../store/projectStore';
import { useImageStore } from '../store/imageStore';
import { useTrainingStore } from '../store/trainingStore';
import BreadcrumbNav from '../components/BreadcrumbNav.vue';

const route = useRoute();
const router = useRouter();
const projectStore = useProjectStore();
const imageStore = useImageStore();
const trainingStore = useTrainingStore();

const projectId = ref(route.params.projectId);
const selectedFiles = ref([]);
const uploadSuccessMessage = ref('');
let statusPollInterval = null;

const getCorrectAssetUrl = (imagePath) => {
  let serverBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
  if (serverBaseUrl.endsWith('/api')) {
    serverBaseUrl = serverBaseUrl.substring(0, serverBaseUrl.length - '/api'.length);
  }
  if (serverBaseUrl.endsWith('/')) {
      serverBaseUrl = serverBaseUrl.slice(0, -1);
  }
  let normalizedImagePath = imagePath;
  if (normalizedImagePath && !normalizedImagePath.startsWith('/')) {
    normalizedImagePath = '/' + normalizedImagePath;
  } else if (!normalizedImagePath) {
    return '';
  }
  return `${serverBaseUrl}${normalizedImagePath}`;
};

const getImageUrl = getCorrectAssetUrl;

const startStatusPolling = (currentProjectId, jobId) => {
  stopStatusPolling();
  statusPollInterval = setInterval(async () => {
    if (!projectStore.currentProject || !trainingStore.isTrainingActive) {
      stopStatusPolling();
      // Optionally refresh models if training just finished/failed
      if (projectStore.currentProject?._id) {
        await trainingStore.fetchTrainedModels(projectStore.currentProject._id);
      }
      return;
    }
    await trainingStore.fetchTrainingStatus(currentProjectId, jobId);
  }, 5000); // Poll every 5 seconds
};

const stopStatusPolling = () => {
  if (statusPollInterval) {
    clearInterval(statusPollInterval);
    statusPollInterval = null;
  }
};

onMounted(async () => {
  await projectStore.loadProjectById(projectId.value);
  if (projectStore.currentProject) {
    await imageStore.fetchImages(projectId.value);
    await trainingStore.fetchTrainedModels(projectId.value);
    trainingStore.clearTrainingState(); // Clear any previous job state, but keep config

    // Check if there was an active job for this project (e.g. from backend state if implemented)
    // For now, we assume if store has an active job status, try to get its details
    // This part might need more robust handling with backend persisting job states
    await trainingStore.fetchTrainingStatus(projectId.value); 
    if (trainingStore.isTrainingActive && trainingStore.currentTrainingJob.jobId) {
      startStatusPolling(projectId.value, trainingStore.currentTrainingJob.jobId);
    }

  } else {
    console.error("Project not found after loading.");
  }
});

watch(() => route.params.projectId, async (newId) => {
  if (newId && newId !== projectId.value) {
    stopStatusPolling();
    projectId.value = newId;
    projectStore.clearCurrentProject();
    imageStore.clearImages();
    trainingStore.clearTrainingState(); // Clear state for new project
    await projectStore.loadProjectById(newId);
    if (projectStore.currentProject) {
      await imageStore.fetchImages(newId);
      await trainingStore.fetchTrainedModels(newId);
      // Similar to onMounted, check for active job status for the new project
      await trainingStore.fetchTrainingStatus(newId);
      if (trainingStore.isTrainingActive && trainingStore.currentTrainingJob.jobId) {
        startStatusPolling(newId, trainingStore.currentTrainingJob.jobId);
      }
    }
  }
});

// Watch for changes in training job status to start/stop polling
watch(() => trainingStore.currentTrainingJob.jobId, (newJobId) => {
  if (newJobId && trainingStore.isTrainingActive && projectStore.currentProject?._id) {
    startStatusPolling(projectStore.currentProject._id, newJobId);
  } else if (!trainingStore.isTrainingActive) {
    stopStatusPolling();
  }
});
watch(() => trainingStore.isTrainingActive, (isActive) => {
  if(isActive && trainingStore.currentTrainingJob.jobId && projectStore.currentProject?._id) {
    startStatusPolling(projectStore.currentProject._id, trainingStore.currentTrainingJob.jobId);
  } else if (!isActive) {
    stopStatusPolling();
    // Refresh models when training stops
    if (projectStore.currentProject?._id) {
        trainingStore.fetchTrainedModels(projectStore.currentProject._id);
    }
  }
});


onUnmounted(() => {
  stopStatusPolling();
});

const handleFileSelect = (event) => {
  selectedFiles.value = Array.from(event.target.files);
  uploadSuccessMessage.value = '';
  imageStore.clearError();
};

const handleImageUpload = async () => {
  if (!selectedFiles.value.length || !projectStore.currentProject?._id) return;
  
  try {
    console.log(`Uploading ${selectedFiles.value.length} image(s) for project ${projectStore.currentProject._id}`);
    
    // Create a FormData object to hold the files
    const formData = new FormData();
    
    // Append each file to the FormData object
    for (const file of selectedFiles.value) {
      console.log(`Adding file to FormData: ${file.name}, size: ${file.size}, type: ${file.type}`);
      formData.append('image', file); // 'image' should match the field name expected by the backend
    }
    
    // Pass the FormData object to the store method
    const success = await imageStore.uploadImage(projectStore.currentProject._id, formData);
    
    if (success) {
      uploadSuccessMessage.value = `${selectedFiles.value.length} image(s) uploaded successfully!`;
      selectedFiles.value = [];
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput) fileInput.value = '';
    } else {
      console.error('Upload failed but no error was thrown:', imageStore.error);
      uploadSuccessMessage.value = `Upload failed: ${imageStore.error || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Error during image upload:', error);
    uploadSuccessMessage.value = `Upload failed: ${error.message || 'Unknown error'}`;
  }
};

const handleDeleteImage = async (imageId) => {
  if (confirm('Are you sure you want to delete this image? This will also remove its annotations.') && projectStore.currentProject?._id) {
    await imageStore.deleteImage(imageId, projectStore.currentProject._id);
  }
};

const handleStartTraining = async () => {
  if (!projectStore.currentProject?._id) return;
  // Training config is already bound to the store's state
  // trainingStore.setTrainingConfig(...) // This is done via v-model now
  await trainingStore.startTraining(projectStore.currentProject._id);
  // Polling will be initiated by the watcher on trainingStore.isTrainingActive and jobId
};

const handleRefreshModels = async () => {
  if (!projectStore.currentProject?._id) return;
  await trainingStore.fetchTrainedModels(projectStore.currentProject._id);
};

</script>

<style scoped>
.project-detail-view {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
  overflow-y: auto;
  position: relative;
  z-index: 1;
  height: calc(100vh - 120px); /* Account for navbar (100px) and some margins */
  min-height: 400px;
}

.card {
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 25px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  overflow: visible;
}

.card h2 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}

.image-upload-section input[type="file"] {
  margin-right: 10px;
  margin-bottom: 10px;
}

.image-upload-section button,
.training-config-section button, /* Added */
.training-section button,
.trained-models-section button { /* Added */
  padding: 10px 15px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.2s;
  margin-top: 10px; /* Added for spacing */
}

.image-upload-section button:hover,
.training-config-section button:hover, /* Added */
.training-section button:hover,
.trained-models-section button:hover { /* Added */
  background-color: #0056b3;
}

.image-upload-section button:disabled,
.training-config-section button:disabled, /* Added */
.training-section button:disabled,
.trained-models-section button:disabled { /* Added */
  background-color: #ccc;
  cursor: not-allowed;
}

.image-lists {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
}

.image-grid {
  list-style: none;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 10px; /* Add space for scrollbar */
  margin-bottom: 10px;
}

.image-item {
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 10px;
  text-align: center;
  background-color: #f9f9f9;
}

.thumbnail {
  width: 100%;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 8px;
  border: 1px solid #ddd;
}

.image-item p {
  font-size: 0.9em;
  margin-bottom: 10px;
  word-break: break-all;
}

.actions button {
  padding: 6px 10px;
  font-size: 0.85em;
  margin-right: 5px;
  background-color: #5cb85c;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.actions button:hover {
  background-color: #4cae4c;
}

.delete-button {
  background-color: #d9534f !important;
}
.delete-button:hover {
  background-color: #c9302c !important;
}
.delete-button:disabled {
  background-color: #ccc !important;
}

.error {
  color: red;
  margin-top: 10px;
  font-size: 0.9em;
}
.success {
  color: green;
  margin-top: 10px;
  font-size: 0.9em;
}

/* Styles for new sections */
.training-config-section .form-group {
  margin-bottom: 15px;
}
.training-config-section label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
.training-config-section input[type="text"],
.training-config-section input[type="number"] {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.training-status h3 {
  margin-top: 20px;
  margin-bottom: 10px;
}
.training-status p {
  margin: 5px 0;
}
.logs-output {
  background-color: #f5f5f5;
  border: 1px solid #eee;
  padding: 10px;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap; /* Allows wrapping long lines */
  word-break: break-all;
  font-family: monospace;
  font-size: 0.9em;
  border-radius: 4px;
  margin-top: 10px;
  width: calc(100% - 20px); /* Adjust for padding */
}

.model-list {
  list-style: none;
  padding: 0;
}
.model-item {
  background-color: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 4px;
  padding: 15px;
  margin-bottom: 10px;
}
.model-item p {
  margin: 5px 0;
}
</style>
