<template>
  <div class="annotation-importer">
    <h2>Import Annotations</h2>
    
    <div class="import-container">
      <div class="file-upload-section">
        <h3>Upload JSON Files</h3>
        <p class="description">
          Import annotation data from JSON files. Supports Roboflow format and other common annotation formats.
        </p>
        
        <div class="upload-zone" @drop.prevent="onFileDrop" @dragover.prevent="onDragOver" @dragenter.prevent="onDragEnter" @dragleave.prevent="onDragLeave" :class="{ 'drag-over': isDragging }">
          <div class="upload-icon">
            <i class="icon-upload"></i>
          </div>
          <div class="upload-text">
            <p>Drag and drop JSON files here</p>
            <p>OR</p>
            <label class="upload-button">
              <input type="file" accept=".json" multiple @change="onFileSelect" />
              Browse Files
            </label>
          </div>
        </div>
        
        <div v-if="selectedFiles.length > 0" class="selected-files">
          <h4>Selected Files ({{ selectedFiles.length }})</h4>
          <ul class="file-list">
            <li v-for="(file, index) in selectedFiles" :key="index" class="file-item">
              <span class="file-name">{{ file.name }}</span>
              <span class="file-size">{{ formatFileSize(file.size) }}</span>
              <button class="btn-remove" @click="removeFile(index)" title="Remove file">
                <i class="icon-remove"></i>
              </button>
            </li>
          </ul>
          
          <div class="import-options">
            <h4>Import Options</h4>
            
            <div class="option-group">
              <label class="option-label">
                <input type="checkbox" v-model="importOptions.overwriteExisting" />
                Overwrite existing annotations with the same ID
              </label>
            </div>
            
            <div class="option-group">
              <label class="option-label">Select Project:</label>
              <select v-model="importOptions.projectId">
                <option value="" disabled>Select a project</option>
                <option v-for="project in projects" :key="project._id" :value="project._id">
                  {{ project.name }}
                </option>
              </select>
            </div>
            
            <div class="option-group">
              <label class="option-label">
                <input type="checkbox" v-model="showAdvancedOptions" />
                Show Advanced Options
              </label>
            </div>
            
            <div v-if="showAdvancedOptions" class="advanced-options">
              <div class="option-group">
                <label class="option-label">
                  <input type="checkbox" v-model="importOptions.createMissingImages" />
                  Create placeholders for missing images
                </label>
              </div>
              
              <div class="option-group">
                <label class="option-label">
                  <input type="checkbox" v-model="importOptions.skipValidation" />
                  Skip validation (faster but may cause errors)
                </label>
              </div>
              
              <div class="option-group">
                <label class="option-label">Format Type:</label>
                <select v-model="importOptions.formatType">
                  <option value="auto">Auto-detect</option>
                  <option value="roboflow">Roboflow</option>
                  <option value="coco">COCO</option>
                  <option value="yolo">YOLO</option>
                  <option value="voc">Pascal VOC</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="import-actions">
            <button 
              class="btn-clear" 
              @click="clearFiles" 
              :disabled="isImporting"
            >
              Clear All
            </button>
            <button 
              class="btn-import" 
              @click="importFiles" 
              :disabled="!canImport || isImporting"
            >
              <span v-if="isImporting">Importing...</span>
              <span v-else>Import Annotations</span>
            </button>
          </div>
        </div>
      </div>
      
      <div class="import-history-section" v-if="importHistory.length > 0">
        <h3>Import History</h3>
        
        <div class="history-list">
          <div v-for="(item, index) in importHistory" :key="index" class="history-item">
            <div class="history-header">
              <span class="history-date">{{ formatDate(item.date) }}</span>
              <span 
                class="history-status" 
                :class="{
                  'status-success': item.status === 'success',
                  'status-error': item.status === 'error',
                  'status-warning': item.status === 'partial'
                }"
              >
                {{ getStatusText(item.status) }}
              </span>
            </div>
            
            <div class="history-details">
              <div class="history-info">
                <span>Files: {{ item.fileCount }}</span>
                <span>Annotations: {{ item.annotationCount }}</span>
                <span>Project: {{ item.projectName }}</span>
              </div>
              
              <div v-if="item.status === 'error'" class="history-error">
                {{ item.errorMessage }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useToast } from 'vue-toastification';
import { useProjectStore } from '../../store/projectStore';

// Toast setup
const toast = useToast();

// Props and emits
const emit = defineEmits(['import-annotations']);

// Store
const projectStore = useProjectStore();

// Component state
const isDragging = ref(false);
const selectedFiles = ref([]);
const importOptions = ref({
  projectId: '',
  overwriteExisting: false,
  createMissingImages: false,
  skipValidation: false,
  formatType: 'auto'
});
const showAdvancedOptions = ref(false);
const isImporting = ref(false);
const projects = ref([]);
const importHistory = ref([]);

// Computed properties
const canImport = computed(() => {
  return selectedFiles.value.length > 0 && importOptions.value.projectId;
});

// Lifecycle hooks
onMounted(async () => {
  try {
    await projectStore.loadProjects();
    projects.value = projectStore.allProjects;
    
    // Load import history from local storage
    const savedHistory = localStorage.getItem('annotationImportHistory');
    if (savedHistory) {
      importHistory.value = JSON.parse(savedHistory);
    }
  } catch (error) {
    console.error('Error initializing annotation importer:', error);
  }
});

// File drag and drop handlers
function onDragEnter() {
  isDragging.value = true;
}

function onDragLeave() {
  isDragging.value = false;
}

function onDragOver() {
  isDragging.value = true;
}

function onFileDrop(event) {
  isDragging.value = false;
  const files = Array.from(event.dataTransfer.files).filter(file => file.name.endsWith('.json'));
  
  if (files.length === 0) {
    toast.warning('Only JSON files can be imported.');
    return;
  }
  
  addFiles(files);
}

function onFileSelect(event) {
  const files = Array.from(event.target.files);
  addFiles(files);
}

function addFiles(files) {
  // Check if files are all JSON
  const nonJsonFiles = files.filter(file => !file.name.endsWith('.json'));
  
  if (nonJsonFiles.length > 0) {
    toast.warning(`${nonJsonFiles.length} files skipped - only JSON files are supported.`);
  }
  
  const jsonFiles = files.filter(file => file.name.endsWith('.json'));
  selectedFiles.value.push(...jsonFiles);
}

function removeFile(index) {
  selectedFiles.value.splice(index, 1);
}

function clearFiles() {
  selectedFiles.value = [];
}

async function importFiles() {
  if (selectedFiles.value.length === 0 || !importOptions.value.projectId) {
    toast.warning('Please select files and a project before importing');
    return;
  }
  
  isImporting.value = true;
  
  try {
    const formData = new FormData();
    
    // Add files to form data
    selectedFiles.value.forEach(file => {
      formData.append('files', file);
    });
    
    // Add options
    Object.entries(importOptions.value).forEach(([key, value]) => {
      formData.append(key, value);
    });
    
    // Emit event for parent to handle
    const result = await emit('import-annotations', formData);
    
    // Add to history
    const historyEntry = {
      date: new Date().toISOString(),
      fileCount: selectedFiles.value.length,
      annotationCount: result?.annotationCount || 0,
      projectName: projects.value.find(p => p._id === importOptions.value.projectId)?.name || 'Unknown',
      status: result?.success ? (result.partial ? 'partial' : 'success') : 'error',
      errorMessage: result?.error || ''
    };
    
    importHistory.value.unshift(historyEntry);
    
    // Save to local storage
    localStorage.setItem('annotationImportHistory', JSON.stringify(importHistory.value.slice(0, 10)));
    
    // Show notification
    if (result?.success) {
      toast.success(`Successfully imported ${result.annotationCount} annotations`);
      clearFiles();
    } else {
      toast.error(`Failed to import annotations: ${result?.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error importing annotations:', error);
    toast.error(`Failed to import annotations: ${error.message}`);
  } finally {
    isImporting.value = false;
  }
}

// Utility functions
function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return 'Unknown';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusText(status) {
  switch (status) {
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    case 'partial':
      return 'Partial Success';
    default:
      return 'Unknown';
  }
}
</script>

<style scoped>
.annotation-importer {
  width: 100%;
}

h2 {
  margin-bottom: 20px;
}

h3 {
  margin-bottom: 15px;
  font-size: 18px;
}

h4 {
  margin: 15px 0 10px;
  font-size: 16px;
}

.description {
  margin-bottom: 15px;
  color: #666;
}

.import-container {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

@media (min-width: 1100px) {
  .import-container {
    display: grid;
    grid-template-columns: 3fr 2fr;
    gap: 30px;
  }
}

.upload-zone {
  border: 2px dashed #ccc;
  border-radius: 8px;
  padding: 30px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #f8f9fa;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
}

.upload-zone.drag-over {
  border-color: #0d6efd;
  background-color: rgba(13, 110, 253, 0.05);
}

.upload-icon {
  margin-bottom: 15px;
}

.upload-text {
  text-align: center;
}

.upload-text p {
  margin: 5px 0;
  color: #666;
}

.upload-button {
  display: inline-block;
  background-color: #0d6efd;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  margin-top: 10px;
  cursor: pointer;
}

.upload-button:hover {
  background-color: #0b5ed7;
}

.upload-button input {
  display: none;
}

.file-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
  background-color: #f8f9fa;
  border-radius: 8px;
  overflow: hidden;
}

.file-item {
  padding: 10px 15px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid #e9ecef;
}

.file-item:last-child {
  border-bottom: none;
}

.file-name {
  flex: 1;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-size {
  margin: 0 15px;
  font-size: 12px;
  color: #6c757d;
  white-space: nowrap;
}

.btn-remove {
  background: none;
  border: none;
  color: #dc3545;
  cursor: pointer;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-remove:hover {
  color: #bd2130;
}

.import-options {
  margin-top: 20px;
  border-top: 1px solid #e9ecef;
  padding-top: 10px;
}

.option-group {
  margin-bottom: 10px;
}

.option-label {
  display: block;
  margin-bottom: 5px;
}

.option-label input[type="checkbox"] {
  margin-right: 8px;
}

.option-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
}

.advanced-options {
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  margin-top: 10px;
}

.import-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 20px;
}

.btn-clear,
.btn-import {
  padding: 8px 16px;
  border-radius: 4px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.btn-clear {
  background-color: #f1f3f5;
  color: #495057;
}

.btn-clear:hover:not(:disabled) {
  background-color: #e9ecef;
}

.btn-import {
  background-color: #0d6efd;
  color: white;
}

.btn-import:hover:not(:disabled) {
  background-color: #0b5ed7;
}

.btn-import:disabled,
.btn-clear:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e9ecef;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.history-date {
  font-size: 14px;
  color: #495057;
}

.history-status {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 20px;
}

.status-success {
  background-color: #d1e7dd;
  color: #0f5132;
}

.status-error {
  background-color: #f8d7da;
  color: #842029;
}

.status-warning {
  background-color: #fff3cd;
  color: #664d03;
}

.history-details {
  font-size: 13px;
}

.history-info {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  color: #6c757d;
}

.history-error {
  margin-top: 8px;
  color: #842029;
  font-size: 12px;
  background-color: rgba(248, 215, 218, 0.5);
  padding: 5px 10px;
  border-radius: 4px;
}

/* Icon styles */
.icon-upload {
  display: inline-block;
  width: 48px;
  height: 48px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%230d6efd'%3E%3Cpath d='M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
}

.icon-remove {
  display: inline-block;
  width: 16px;
  height: 16px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23dc3545'%3E%3Cpath d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'/%3E%3C/svg%3E");
  background-size: contain;
  background-repeat: no-repeat;
}
</style>
