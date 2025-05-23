<template>
  <div class="raw-data-section">
    <h4>Raw Data</h4>
    <div class="raw-data-controls">
      <button @click="exportAnnotationsAsJson" class="export-btn">Export Annotations (JSON)</button>
      <button @click="copyAnnotationsToClipboard" class="copy-btn">Copy to Clipboard</button>
      <button @click="importAnnotationsClick" class="import-btn">Import Annotations (JSON)</button>
      <input 
        type="file" 
        ref="fileInput" 
        style="display: none;" 
        accept=".json" 
        @change="handleFileSelected" 
      />
    </div>
    <div v-if="showImportOptions" class="import-options">
      <h5>Import Options</h5>
      <div class="form-row">
        <label>Format:</label>
        <select v-model="importFormat">
          <option value="default">Default (autolabel)</option>
          <option value="roboflow">Roboflow</option>
        </select>
      </div>
      <div class="form-row">
        <label>Merge Strategy:</label>
        <select v-model="mergeStrategy">
          <option value="replace">Replace Existing</option>
          <option value="append">Add to Existing</option>
        </select>
      </div>
      <div class="button-row">
        <button @click="cancelImport" class="cancel-btn">Cancel</button>
        <button @click="confirmImport" class="confirm-btn" :disabled="!selectedFile">Confirm Import</button>
      </div>
    </div>
    <pre v-if="annotationString" class="raw-data-preview">{{ annotationString }}</pre>
    <p v-else>No annotations to display.</p>
    <p v-if="copySuccess" class="success-message">{{ copySuccess }}</p>
    <p v-if="importStatus" :class="importStatus.type">{{ importStatus.message }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useToast } from 'vue-toastification';
import '../styles/RawDataPanel.css';

// Define props
const props = defineProps({
  annotationStore: {
    type: Object,
    required: true
  },
  imageStore: {
    type: Object,
    required: true
  },
  imageId: {
    type: String,
    required: true
  }
});

// Define emits
const emit = defineEmits(['import-complete']);

// Local state
const copySuccess = ref('');
const fileInput = ref(null);
const selectedFile = ref(null);
const showImportOptions = ref(false);
const importFormat = ref('default');
const mergeStrategy = ref('replace');
const importStatus = ref(null);
const toast = useToast();

// Computed properties
const annotationString = computed(() => {
  if (!props.annotationStore.currentAnnotations || props.annotationStore.currentAnnotations.length === 0) {
    return '';
  }
  
  return JSON.stringify(props.annotationStore.currentAnnotations, null, 2);
});

// Methods
function exportAnnotationsAsJson() {
  if (!props.annotationStore.currentAnnotations || props.annotationStore.currentAnnotations.length === 0) {
    return;
  }
  
  const dataStr = JSON.stringify(props.annotationStore.currentAnnotations, null, 2);
  const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
  
  const imageName = props.imageStore.getImageById(props.imageId)?.name || 'annotations';
  const exportFileDefaultName = `${imageName}_annotations.json`;
  
  const linkElement = document.createElement('a');
  linkElement.setAttribute('href', dataUri);
  linkElement.setAttribute('download', exportFileDefaultName);
  linkElement.click();
}

function copyAnnotationsToClipboard() {
  if (!props.annotationStore.currentAnnotations || props.annotationStore.currentAnnotations.length === 0) {
    return;
  }
  
  const dataStr = JSON.stringify(props.annotationStore.currentAnnotations, null, 2);
  
  navigator.clipboard.writeText(dataStr)
    .then(() => {
      copySuccess.value = 'Copied to clipboard!';
      setTimeout(() => {
        copySuccess.value = '';
      }, 2000);
    })
    .catch(err => {
      console.error('Failed to copy: ', err);
    });
}

function importAnnotationsClick() {
  // Trigger file input click
  fileInput.value.click();
}

function handleFileSelected(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  selectedFile.value = file;
  showImportOptions.value = true;
}

function cancelImport() {
  selectedFile.value = null;
  showImportOptions.value = false;
  fileInput.value.value = ''; // Clear the file input
}

function confirmImport() {
  if (!selectedFile.value) {
    toast.error('No file selected');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const jsonContent = JSON.parse(e.target.result);
      const annotations = Array.isArray(jsonContent) ? jsonContent 
                        : jsonContent.annotations ? jsonContent.annotations 
                        : null;
      
      if (!annotations) {
        toast.error('Invalid JSON format: Could not find annotations array');
        importStatus.value = {
          type: 'error-message',
          message: 'Invalid JSON format'
        };
        return;
      }
      
      importStatus.value = {
        type: 'info-message',
        message: 'Importing annotations...'
      };
      
      // Get the project ID from the current image
      const currentImage = props.imageStore.getImageById(props.imageId);
      const projectId = currentImage?.project;
      
      const result = await props.annotationStore.importAnnotationsFromJson(
        props.imageId,
        annotations,
        importFormat.value,
        mergeStrategy.value,
        projectId
      );
      
      if (result) {
        importStatus.value = {
          type: 'success-message',
          message: `Successfully imported ${result.annotations.length} annotations`
        };
        toast.success(`Successfully imported ${result.annotations.length} annotations`);
        emit('import-complete');
        
        // Reset the import form
        cancelImport();
      } else {
        importStatus.value = {
          type: 'error-message',
          message: 'Failed to import annotations'
        };
        toast.error('Failed to import annotations');
      }
    } catch (error) {
      console.error('Error parsing or importing JSON:', error);
      importStatus.value = {
        type: 'error-message',
        message: 'Error: ' + (error.message || 'Failed to process file')
      };
      toast.error('Error: ' + (error.message || 'Failed to process file'));
    }
  };
  
  reader.onerror = () => {
    importStatus.value = {
      type: 'error-message',
      message: 'Error reading file'
    };
    toast.error('Error reading file');
  };
  
  reader.readAsText(selectedFile.value);
}
</script>

<style scoped>
@import '../styles/RawDataPanel.css';
</style>
