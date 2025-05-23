<template>
  <div class="annotation-editor-view">
    <div class="breadcrumb">
      <router-link :to="{ name: 'Dashboard' }">Dashboard</router-link> >
      <router-link :to="{ name: 'ProjectDetail', params: { projectId: projectId } }">Project: {{ projectStore.currentProject?.name }}</router-link> >
      <span>Annotate: {{ imageStore.getImageById(imageId)?.name }}</span>
    </div>

    <div class="editor-layout">      <div class="toolbar">
        <h3>Tools</h3>        <button @click="setTool('rectangle')" :class="{ active: currentTool === 'rectangle' }">Rectangle</button>
        <button @click="setTool('pan')" :class="{ active: currentTool === 'pan' }">Pan</button>
        <button @click="setTool('select')" :class="{ active: currentTool === 'select' }">Select</button>
          <div class="zoom-controls">          <button @click="zoomOut()" title="Zoom Out">
            <span>-</span>
          </button>
          <span class="zoom-level">{{ Math.round((zoomLevel || 1) * 100) }}%</span>
          <button @click="zoomIn()" title="Zoom In">
            <span>+</span>
          </button>          <button @click="resetZoom()" title="Reset Zoom">
            <span>Reset</span>
          </button>
          <!-- Add debug test button for zoom functionality -->
          <button @click="runAnnotationZoomTest()" v-if="annotationStore.currentAnnotations.length > 0" title="Test Zoom Functionality">
            <span>Test Zoom</span>
          </button>
        </div>
        
        <button @click="detectShapes" :disabled="detectingShapes" title="Auto-detect shapes in the image">
          <span v-if="detectingShapes">Detecting...</span>
          <span v-else>Detect Shapes</span>
        </button>
        <button @click="undo" :disabled="!canUndo" :title="canUndo ? `Undo ${getUndoActionDescription()}` : 'Nothing to undo'">
          Undo<span v-if="canUndo"> ({{ undoStack.length }})</span>
        </button>
        <button @click="redo" :disabled="!canRedo" :title="canRedo ? `Redo ${getRedoActionDescription()}` : 'Nothing to redo'">
          Redo<span v-if="canRedo"> ({{ redoStack.length }})</span>
        </button>
      </div>

      <div class="canvas-container" ref="canvasContainerRef">
        <img ref="imageRef" :src="imageUrl" @load="onImageLoad" :style="imageStyle" alt="Image to annotate" />
        <canvas ref="canvasRef" @mousedown="handleMouseDown" @mousemove="handleMouseMove" @mouseup="handleMouseUp" @mouseleave="handleMouseLeave" :style="canvasStyle"></canvas>
      </div>

      <div class="side-panel">
        <div class="classes-section">
          <h4>Classes</h4>
          <ul v-if="projectStore.currentProject?.classes?.length">
            <li v-for="cls in projectStore.currentProject.classes" :key="cls" @click="selectClass(cls)" :style="{ backgroundColor: getColorForClass(cls) }">
              {{ cls }} ({{ countAnnotationsByClass(cls) }})
            </li>
          </ul>
          <p v-else>No classes defined for this project yet.</p>
        </div>        <div class="layers-section">
          <h4>Layers (Annotations)</h4>
          <div class="layers-controls">
            <button @click="selectAllAnnotations" class="select-all-btn">Select All</button>
            <button @click="deleteSelectedAnnotations" class="delete-selected-btn" :disabled="selectedAnnotationIds.length === 0">
              Delete Selected ({{ selectedAnnotationIds.length }})
            </button>
          </div>
          <ul v-if="annotationStore.currentAnnotations.length">
            <li v-for="(ann, index) in annotationStore.currentAnnotations" :key="ann._id"
                @mouseover="highlightAnnotation(ann)" @mouseleave="unhighlightAnnotation"
                :class="{ 
                  'highlighted': highlightedAnnotationId === ann._id, 
                  'editing': editingAnnotationId === ann._id,
                  'has-history': hasAnnotationHistory(ann._id),
                  'selected': isAnnotationSelected(ann._id)
                }"
                :style="{ borderLeftColor: getColorForClass(ann.label) }">
              <div class="annotation-item">
                <div class="annotation-checkbox">
                  <input type="checkbox" :id="'select-' + ann._id" 
                         :checked="isAnnotationSelected(ann._id)"
                         @change="toggleAnnotationSelection(ann._id)" />
                </div>
                <span class="annotation-label">
                  {{ ann.label }} #{{ index + 1 }}
                  <small v-if="hasAnnotationHistory(ann._id)" title="This annotation has undo/redo history" class="history-indicator">★</small>
                </span>
                <div class="annotation-buttons">
                  <button @click="startEditingAnnotation(ann)" class="edit-ann-btn" title="Edit this annotation">Edit</button>
                  <button @click="deleteExistingAnnotation(ann._id)" class="delete-ann-btn" title="Delete this annotation">Delete</button>
                </div>
              </div>
            </li>
          </ul>
          <p v-else>No annotations yet.</p>
        </div>        <div class="raw-data-section">
          <h4>Raw Annotation Data</h4>
          <button @click="showRawData = !showRawData">{{ showRawData ? 'Hide' : 'Show' }} Raw Data</button>
          <button @click="nameAnnotationsWithLLM" :disabled="namingAnnotations || annotationStore.currentAnnotations.length === 0" 
                  class="name-annotations-btn" :class="{ 'processing': namingAnnotations }">
            <span v-if="!namingAnnotations">Name Annotations with AI</span>
            <span v-else class="naming-status">
              <span class="spinner"></span>
              {{ namingStatus }}
            </span>
          </button>
          <div v-if="namingAnnotations" class="naming-progress">
            Processing {{ annotationStore.currentAnnotations.length }} annotations with AI...
          </div>
          <div v-if="showRawData">
            <div v-if="rawDataError" class="error-message">
              Error displaying raw data: {{ rawDataError }}
            </div>
            <pre v-else>{{ safeStringifiedAnnotations }}</pre>
          </div>
        </div>

        <div class="image-tags-section">
          <h4>Image Tags</h4>
          <div class="tags-display" v-if="currentImageTags.length">
            <span v-for="tag in currentImageTags" :key="tag" class="tag-pill">
              {{ tag }}
              <button @click="removeTag(tag)" class="remove-tag-btn">&times;</button>
            </span>
          </div>
          <p v-else>No tags for this image yet.</p>
          <div class="add-tag-input">
            <input type="text" v-model="newTagInput" @keyup.enter="addTag" placeholder="Add a tag..." />
            <button @click="addTag">Add</button>
          </div>
          <p v-if="tagError" class="error">{{ tagError }}</p>
        </div>

        <!-- Detection Settings Section -->
        <div class="detection-settings-section">
          <h4>Detection Settings</h4>
          <div class="detection-method">
            <label>Detection Method:</label>
            <select v-model="detectionMethod">
              <option value="yolo">YOLO (Machine Learning)</option>
              <option value="opencv">OpenCV Contour Detection</option>
              <option value="ssim">Structural Similarity (SSIM)</option>
            </select>
          </div>
          
          <div class="detection-params" v-if="detectionMethod === 'opencv'">
            <div class="param-group">
              <label>Sensitivity:</label>
              <input type="range" v-model.number="detectionParams.sensitivity" min="0.1" max="0.9" step="0.1" />
              <span>{{ detectionParams.sensitivity }}</span>
            </div>
            <div class="param-group">
              <label>Min Area:</label>
              <input type="number" v-model.number="detectionParams.minArea" min="10" max="10000" step="10" />
            </div>
          </div>
          
          <div class="detection-params" v-if="detectionMethod === 'ssim'">
            <p>Select a reference image to compare with:</p>
            <select v-model="referenceImageId" @change="loadReferenceImage">
              <option value="">None (Select an image)</option>
              <option v-for="img in imageStore.allImages" :key="img._id" :value="img._id">
                {{ img.name }}
              </option>
            </select>
            <div v-if="referenceImagePreview" class="reference-image-preview">
              <img :src="referenceImagePreview" alt="Reference Image" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Class Input Modal -->
    <div v-if="showClassModal" class="modal-overlay">
      <div class="modal-content">        <h3>Assign Class</h3>
        <input type="text" v-model="currentClassName" placeholder="Enter class name" @keyup.enter="confirmClassInput"/>
        <div>
            <p>Existing classes:</p>
            <button v-for="cls in projectStore.currentProject?.classes || []" :key="cls" @click="selectClass(cls)">
                {{ cls }}
            </button>
        </div>
        <button @click="confirmClassInput">Confirm</button>
        <button @click="cancelClassInput">Cancel</button>
        <p v-if="classModalError" class="error">{{ classModalError }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
// Import necessary functions
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';

// Import our stores and services
import { useProjectStore } from '../store/projectStore';
import { useImageStore } from '../store/imageStore';
import { useAnnotationStore } from '../store/annotationStore';
import { detectObjectsInImage } from '../services/detectionService';
import { nameAnnotationsWithLLM as nameWithLLM } from '../services/llmService';

// Component state
const route = useRoute();
const router = useRouter();
const toast = useToast();
const projectStore = useProjectStore();
const imageStore = useImageStore();
const annotationStore = useAnnotationStore();

// Get route params
const projectId = ref(route.params.projectId);
const imageId = ref(route.params.imageId);

// Function to generate a consistent color for a class label
// Define at the top level to ensure it's available everywhere
const getColorForClass = function(className) {
  if (!className) return '#808080'; // Default gray for undefined class
  
  // Predefined color palette for better readability and contrast
  const colorPalette = [
    '#3498db', // Blue
    '#2ecc71', // Green
    '#e74c3c', // Red
    '#f39c12', // Orange
    '#9b59b6', // Purple
    '#1abc9c', // Teal
    '#d35400', // Dark Orange
    '#c0392b', // Dark Red
    '#16a085', // Dark Teal
    '#8e44ad', // Dark Purple
    '#27ae60', // Dark Green
    '#2980b9', // Dark Blue
    '#f1c40f', // Yellow
    '#7f8c8d', // Gray
    '#34495e', // Navy
    '#e67e22'  // Pumpkin
  ];
  
  // Simple string hash function to get consistent index from class name
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = ((hash << 5) - hash) + className.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use absolute value of hash to get positive index
  const index = Math.abs(hash) % colorPalette.length;
  
  return colorPalette[index];
}

// Canvas and image refs
const canvasRef = ref(null);
const imageRef = ref(null);
const canvasContainerRef = ref(null);
let ctx = null;

// Drawing state variables
const drawing = ref(false);
const startX = ref(0);
const startY = ref(0);
const currentX = ref(0);
const currentY = ref(0);
const currentTool = ref('rectangle'); // Default tool
const imageUrl = ref('');
const imageDimensions = ref({
  width: 0,
  height: 0,
  naturalWidth: 0,
  naturalHeight: 0
});
const startPos = ref({ x: 0, y: 0 });
const currentRectRaw = ref(null);
const pendingAnnotationCoordinates = ref(null);
const showClassModal = ref(false);
const currentClassName = ref('');
const classModalError = ref('');

// Panning state
const isPanning = ref(false);
const viewOffset = ref({ x: 0, y: 0 });
const startPanPoint = ref({ x: 0, y: 0 });
const panLastClientPos = ref({ x: 0, y: 0 });

// Zoom state
const zoomLevel = ref(1);
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.1;

// Selection state
const selectedAnnotationIds = ref([]);
const selectedAnnotation = ref(null); // For dragging
const isDraggingAnnotation = ref(false);
const dragStartPos = ref({ x: 0, y: 0 });
const dragStartRect = ref(null);

// Annotation naming state
const namingAnnotations = ref(false);
const namingStatus = ref('');
const namingProgress = ref(0);

// Tags state
const currentImageTags = ref([]);
const newTagInput = ref('');
const tagError = ref('');

// Function to count annotations for a specific class
function countAnnotationsByClass(className) {
  if (!annotationStore.currentAnnotations) return 0;
  return annotationStore.currentAnnotations.filter(ann => ann.label === className).length;
}

// Detection method configuration
const detectionMethod = ref('yolo'); // 'yolo', 'opencv', or 'ssim'
const detectionParams = ref({
  sensitivity: 0.5,   // For OpenCV - edge detection sensitivity (0.1-0.9)
  minArea: 100,       // For OpenCV - minimum contour area to consider
  maxArea: null       // For OpenCV - maximum contour area to consider (null = auto)
});
const referenceImageId = ref(''); // For SSIM comparison
const referenceImagePreview = ref(''); // Preview of reference image for SSIM
const referenceImageData = ref(null); // To store the base64 data of the reference image

const highlightedAnnotationId = ref(null);
const showRawData = ref(false);
const rawDataError = ref(null);

// Computed property for safely stringifying annotations
const safeStringifiedAnnotations = computed(() => {
  try {
    return JSON.stringify(annotationStore.currentAnnotations, (key, value) => {
      // Handle potential circular references or special objects that can't be serialized
      if (key === '_reactiveChains' || key === '_reactiveFlags' || typeof value === 'function') {
        return undefined; // Skip reactivity metadata and functions
      }
      return value;
    }, 2);
  } catch (error) {
    console.error('Error stringifying annotations:', error);
    rawDataError.value = error.message || 'Unknown error';
    return '';
  }
});

// Editing state
const editingAnnotationId = ref(null);
const isResizing = ref(false);
const activeResizeHandle = ref(null); // e.g., 'topLeft', 'bottomRight', 'top', 'left', etc.
const originalAnnotationBeforeEdit = ref(null); // Stores the annotation state when editing began
const resizeStartPos = ref({ x: 0, y: 0 }); // Mouse position when resize starts
const originalResizingAnnotation = ref(null); // Annotation state at the start of a specific resize drag


// Undo/Redo state
const undoStack = ref([]);
const redoStack = ref([]);
const MAX_UNDO_HISTORY = 20; // Maximum number of actions in the undo history
const undoLimitReached = ref(false); // Flag to indicate if the undo history limit has been reached

const detectingShapes = ref(false); // Flag to indicate if shape detection is in progress
const defaultDetectionClass = ref('auto-detected'); // Default class name for auto-detected shapes

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

// Helper functions for undo/redo
function getUndoActionDescription() {
  if (undoStack.value.length === 0) return '';
  
  const lastAction = undoStack.value[undoStack.value.length - 1];
  
  switch (lastAction.type) {
    case 'CREATE':
      return `creation of ${getAnnotationLabel(lastAction.annotationData)}`;
    case 'UPDATE':
      return `update to ${getAnnotationLabel(lastAction.oldData)}`;
    case 'DELETE':
      return `deletion of ${getAnnotationLabel(lastAction.annotationData)}`;
    case 'MULTI_DELETE':
      return `deletion of ${lastAction.annotationData?.length || 0} annotations`;
    default:
      return 'last action';
  }
}

function getRedoActionDescription() {
  if (redoStack.value.length === 0) return '';
  
  const lastAction = redoStack.value[redoStack.value.length - 1];
  
  switch (lastAction.type) {
    case 'CREATE':
      return `creation of ${getAnnotationLabel(lastAction.annotationData)}`;
    case 'UPDATE':
      return `update to ${getAnnotationLabel(lastAction.newData || lastAction.oldData)}`;
    case 'DELETE':
      return `deletion of ${getAnnotationLabel(lastAction.annotationData)}`;
    case 'MULTI_DELETE':
      return `deletion of ${lastAction.annotationData?.length || 0} annotations`;
    default:
      return 'last action';
  }
}

function getAnnotationLabel(annotation) {
  if (!annotation) return 'unknown';
  return `${annotation.label || 'unnamed'} annotation`;
}

// Function to check if an annotation has undo/redo history
function hasAnnotationHistory(annotationId) {
  if (!annotationId) return false;
  
  // Check undo stack for actions relating to this annotation
  const hasUndoHistory = undoStack.value.some(
    action => action.annotationId === annotationId || 
    (action.annotationData && action.annotationData._id === annotationId) ||
    (action.oldData && action.oldData._id === annotationId) ||
    (action.newData && action.newData._id === annotationId)
  );
  
  // Check redo stack for actions relating to this annotation
  const hasRedoHistory = redoStack.value.some(
    action => action.annotationId === annotationId || 
    (action.annotationData && action.annotationData._id === annotationId) ||
    (action.oldData && action.oldData._id === annotationId) ||
    (action.newData && action.newData._id === annotationId)
  );
  
  return hasUndoHistory || hasRedoHistory;
}

// Function to select an annotation class
function selectClass(className) {
  if (!className) return;
  
  // Set the current class name
  currentClassName.value = className;
  
  // If the class modal is open, automatically confirm
  if (showClassModal.value) {
    confirmClassInput();
  }
}

// Function to finish editing an annotation
function finishEditingAnnotation() {
  if (editingAnnotationId.value) {
    // Clear the editing state
    editingAnnotationId.value = null;
    originalAnnotationBeforeEdit.value = null;
    
    // Redraw to remove editing UI
    redrawCanvas();
  }
}

// Computed styles for the canvas and image to handle zooming and panning
const imageStyle = computed(() => ({
  position: 'absolute',
  width: `${imageDimensions.value.width * zoomLevel.value}px`,
  height: `${imageDimensions.value.height * zoomLevel.value}px`,
  transform: `translate(${viewOffset.value.x}px, ${viewOffset.value.y}px)`,
  transformOrigin: 'top left',
  userSelect: 'none',
  pointerEvents: isPanning.value ? 'none' : 'auto'
}));

const canvasStyle = computed(() => ({
  position: 'absolute',
  width: `${imageDimensions.value.width * zoomLevel.value}px`,
  height: `${imageDimensions.value.height * zoomLevel.value}px`,
  transform: `translate(${viewOffset.value.x}px, ${viewOffset.value.y}px)`,
  transformOrigin: 'top left',
  cursor: currentTool.value === 'pan' ? (isPanning.value ? 'grabbing' : 'grab') : 
          currentTool.value === 'select' ? (isDraggingAnnotation.value ? 'grabbing' : 'pointer') : 
          isResizing.value ? 'grabbing' :
          'crosshair',
  zIndex: 10
}));

// Function to add an action to the undo stack and manage its size
function addToUndoStack(action) {
  // Ensure action has a timestamp - use high precision timestamp to avoid ordering issues
  if (!action.timestamp) {
    action.timestamp = Date.now() + (performance.now() / 1000); // Add fractional milliseconds for more precise ordering
  }
  
  // Add action to the end of the stack (newest actions at the end)
  undoStack.value.push(action);
  undoLimitReached.value = false;
  
  // We no longer sort the stack - instead we rely on the natural order of actions
  // being added to the stack chronologically, which is more reliable for undo/redo
  
  // If we exceed the maximum history size, remove the oldest action
  if (undoStack.value.length > MAX_UNDO_HISTORY) {
    undoStack.value.shift(); // Remove the oldest action (at index 0)
    undoLimitReached.value = true;
    console.log(`Undo history limit reached (${MAX_UNDO_HISTORY} actions). Oldest action removed.`);
  }
  
  // Clear the redo stack when a new action is performed
  redoStack.value = [];
  
  console.log(`Added to undo stack: ${action.type} action with ID ${action.annotationId || (action.annotationData && action.annotationData._id) || 'unknown'}`);
}

// Undo/Redo functions
function undo() {
  if (!canUndo.value) return;
  
  // Get the last action from the undo stack
  const action = undoStack.value.pop();
  
  if (!action) return;
  
  console.log('Undoing action:', action);
  
  // Depending on the action type, perform the reverse operation
  switch (action.type) {
    case 'CREATE':
      // If we created an annotation, delete it to undo
      if (action.annotationId) {
        annotationStore.deleteAnnotation(action.annotationId, projectId.value, imageId.value)
          .then(() => {
            toast.info(`Undid creation of ${action.annotationData?.label || 'unknown'} annotation`);
            
            // Add to redo stack
            redoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error undoing annotation creation:', error);
            toast.error('Failed to undo annotation creation');
            
            // Put the action back on the undo stack since it failed
            undoStack.value.push(action);
          });
      }
      break;
      
    case 'UPDATE':
      // If we updated an annotation, restore its previous state
      if (action.annotationId && action.oldData) {
        annotationStore.updateAnnotation(action.oldData, projectId.value, imageId.value)
          .then(() => {
            toast.info(`Undid update to ${action.oldData?.label || 'unknown'} annotation`);
            
            // Add to redo stack
            redoStack.value.push(action);
          })
          .catch(error => {
            console.error('Error undoing annotation update:', error);
            toast.error('Failed to undo annotation update');
            
            // Put the action back on the undo stack since it failed
            undoStack.value.push(action);
          });
      }
      break;
      
    case 'DELETE':
      // If we deleted an annotation, recreate it to undo
      if (action.annotationData) {
        // Remove the _id field when recreating to avoid conflicts
        const { _id, ...annotationWithoutId } = action.annotationData;
        
        annotationStore.createAnnotation(annotationWithoutId, projectId.value, imageId.value)
          .then(createdAnnotation => {
            toast.info(`Undid deletion of ${action.annotationData?.label || 'unknown'} annotation`);
            
            // Update the action with the new annotation ID for redo
            const redoAction = {
              ...action,
              annotationId: createdAnnotation._id
            };
            
            // Add to redo stack
            redoStack.value.push(redoAction);
          })
          .catch(error => {
            console.error('Error undoing annotation deletion:', error);
            toast.error('Failed to undo annotation deletion');
            
            // Put the action back on the undo stack since it failed
            undoStack.value.push(action);
          });
      }
      break;
      
    case 'MULTI_DELETE':
      // If we deleted multiple annotations, recreate them all
      if (action.annotationData && Array.isArray(action.annotationData)) {
        // Create an array of promises for creating each annotation
        const createPromises = action.annotationData.map(annData => {
          // Remove the _id field when recreating
          const { _id, ...annotationWithoutId } = annData;
          return annotationStore.createAnnotation(annotationWithoutId, projectId.value, imageId.value);
        });
        
        Promise.all(createPromises)
          .then(createdAnnotations => {
            toast.info(`Undid deletion of ${createdAnnotations.length} annotations`);
            
            // Update the action with the new annotation IDs for redo
            const redoAction = {
              ...action,
              annotationIds: createdAnnotations.map(ann => ann._id)
            };
            
            // Add to redo stack
            redoStack.value.push(redoAction);
          })
          .catch(error => {
            console.error('Error undoing multiple annotation deletion:', error);
            toast.error('Failed to undo multiple annotation deletion');
            
            // Put the action back on the undo stack since it failed
            undoStack.value.push(action);
          });
      }
      break;
      
    default:
      console.warn('Unknown action type:', action.type);
      break;
  }
}

function redo() {
  if (!canRedo.value) return;
  
  // Get the last action from the redo stack
  const action = redoStack.value.pop();
  
  if (!action) return;
  
  console.log('Redoing action:', action);
  
  // Depending on the action type, re-perform the operation
  switch (action.type) {
    case 'CREATE':
      // If the original action was create, recreate the annotation
      if (action.annotationData) {
        annotationStore.createAnnotation(action.annotationData, projectId.value, imageId.value)
          .then(createdAnnotation => {
            toast.info(`Redid creation of ${action.annotationData?.label || 'unknown'} annotation`);
            
            // Add to undo stack
            addToUndoStack({
              ...action,
              annotationId: createdAnnotation._id
            });
          })
          .catch(error => {
            console.error('Error redoing annotation creation:', error);
            toast.error('Failed to redo annotation creation');
            
            // Put the action back on the redo stack since it failed
            redoStack.value.push(action);
          });
      }
      break;
      
    case 'UPDATE':
      // If the original action was update, reapply the update
      if (action.annotationId && action.newData) {
        annotationStore.updateAnnotation(action.newData, projectId.value, imageId.value)
          .then(() => {
            toast.info(`Redid update to ${action.newData?.label || 'unknown'} annotation`);
            
            // Add to undo stack
            addToUndoStack(action);
          })
          .catch(error => {
            console.error('Error redoing annotation update:', error);
            toast.error('Failed to redo annotation update');
            
            // Put the action back on the redo stack since it failed
            redoStack.value.push(action);
          });
      }
      break;
      
    case 'DELETE':
      // If the original action was delete, delete the annotation again
      if (action.annotationId) {
        annotationStore.deleteAnnotation(action.annotationId, projectId.value, imageId.value)
          .then(() => {
            toast.info(`Redid deletion of ${action.annotationData?.label || 'unknown'} annotation`);
            
            // Add to undo stack
            addToUndoStack(action);
          })
          .catch(error => {
            console.error('Error redoing annotation deletion:', error);
            toast.error('Failed to redo annotation deletion');
            
            // Put the action back on the redo stack since it failed
            redoStack.value.push(action);
          });
      }
      break;
      
    case 'MULTI_DELETE':
      // If the original action was multi-delete, delete all annotations again
      if (action.annotationIds && Array.isArray(action.annotationIds)) {
        // Create an array of promises for deleting each annotation
        const deletePromises = action.annotationIds.map(id => 
          annotationStore.deleteAnnotation(id, projectId.value, imageId.value)
        );
        
        Promise.all(deletePromises)
          .then(() => {
            toast.info(`Redid deletion of ${action.annotationIds.length} annotations`);
            
            // Add to undo stack
            addToUndoStack(action);
          })
          .catch(error => {
            console.error('Error redoing multiple annotation deletion:', error);
            toast.error('Failed to redo multiple annotation deletion');
            
            // Put the action back on the redo stack since it failed
            redoStack.value.push(action);
          });
      }
      break;
      
    default:
      console.warn('Unknown action type:', action.type);
      break;
  }
}

// Functions for the class input modal
function confirmClassInput() {
  if (!currentClassName.value) {
    classModalError.value = 'Please enter a class name';
    return;
  }
  
  // Reset error message
  classModalError.value = '';
  
  // If we have pending annotation coordinates, create the annotation
  if (pendingAnnotationCoordinates.value) {
    const newAnnotation = {
      label: currentClassName.value,
      ...pendingAnnotationCoordinates.value
    };
    
    // Save the annotation to the database
    annotationStore.createAnnotation(newAnnotation, projectId.value, imageId.value)
      .then(createdAnnotation => {
        toast.success(`Created ${currentClassName.value} annotation`);
        
        // Add to undo stack
        addToUndoStack({
          type: 'CREATE',
          timestamp: Date.now(),
          annotationId: createdAnnotation._id,
          annotationData: { ...createdAnnotation }
        });
        
        // Reset pending coordinates
        pendingAnnotationCoordinates.value = null;
      })
      .catch(error => {
        console.error('Error creating annotation:', error);
        toast.error('Failed to create annotation');
      });
  }
  
  // Check if the class name is already in the project's classes
  const currentProject = projectStore.currentProject;
  if (currentProject && (!currentProject.classes || !currentProject.classes.includes(currentClassName.value))) {
    // Add the class to the project if it doesn't exist
    const updatedClasses = [...(currentProject.classes || []), currentClassName.value];
    
    projectStore.updateProject({
      ...currentProject,
      classes: updatedClasses
    })
    .then(() => {
      console.log(`Added new class ${currentClassName.value} to project`);
    })
    .catch(error => {
      console.error('Error updating project classes:', error);
    });
  }
  
  // Close the modal
  showClassModal.value = false;
}

function cancelClassInput() {
  // Reset the state and close the modal
  pendingAnnotationCoordinates.value = null;
  showClassModal.value = false;
  classModalError.value = '';
}

// Functions for annotation highlighting
function highlightAnnotation(annotation) {
  if (annotation && annotation._id) {
    highlightedAnnotationId.value = annotation._id;
    redrawCanvas();
  }
}

function unhighlightAnnotation() {
  highlightedAnnotationId.value = null;
  redrawCanvas();
}

// Convert natural (original image) coordinates to screen coordinates with zoom and offset
function naturalToScreen(x, y, width, height) {
  return {
    x: x * zoomLevel.value + viewOffset.value.x,
    y: y * zoomLevel.value + viewOffset.value.y,
    width: width * zoomLevel.value,
    height: height * zoomLevel.value
  };
}

// Convert screen coordinates to natural (original image) coordinates
function screenToNatural(x, y, width, height) {
  return {
    x: (x - viewOffset.value.x) / zoomLevel.value,
    y: (y - viewOffset.value.y) / zoomLevel.value,
    width: width / zoomLevel.value,
    height: height / zoomLevel.value
  };
}

// Start editing an annotation - enables moving and resizing
function startEditingAnnotation(annotation) {
  if (!annotation) return;
  
  // Store a copy of the annotation before editing begins
  originalAnnotationBeforeEdit.value = { ...annotation };
  
  // Set the editing annotation ID
  editingAnnotationId.value = annotation._id;
  
  // Ensure the annotation is visible on screen
  // If annotation is outside of the visible area, pan to it
  const rect = naturalToScreen(
    annotation.x,
    annotation.y,
    annotation.width,
    annotation.height
  );
  
  // Check if annotation is in the viewport
  const containerWidth = canvasContainerRef.value ? canvasContainerRef.value.offsetWidth : 0;
  const containerHeight = canvasContainerRef.value ? canvasContainerRef.value.offsetHeight : 0;
  
  const isVisible = 
    rect.x >= 0 && 
    rect.y >= 0 && 
    rect.x + rect.width <= containerWidth && 
    rect.y + rect.height <= containerHeight;
  
  if (!isVisible) {
    // Center the annotation in the viewport
    const centerX = rect.x + (rect.width / 2);
    const centerY = rect.y + (rect.height / 2);
    
    viewOffset.value.x = (containerWidth / 2) - centerX;
    viewOffset.value.y = (containerHeight / 2) - centerY;
  }
  
  toast.info(`Editing ${annotation.label} annotation. Drag to move, use handles to resize.`);
  redrawCanvas();
}

// Convert client coordinates to canvas coordinates (taking into account zoom and pan)
function clientToCanvas(clientX, clientY) {
  if (!canvasRef.value) return { x: 0, y: 0 };
  
  const canvasRect = canvasRef.value.getBoundingClientRect();
  
  // Calculate the position relative to the canvas element with zoom
  const x = (clientX - canvasRect.left - viewOffset.value.x) / zoomLevel.value;
  const y = (clientY - canvasRect.top - viewOffset.value.y) / zoomLevel.value;
  
  return { x, y };
}

// Mouse event handlers
function handleMouseDown(event) {
  if (!canvasRef.value) return;
  
  // Get the position in canvas coordinates
  const pos = clientToCanvas(event.clientX, event.clientY);
  
  // Store the starting position
  startX.value = pos.x;
  startY.value = pos.y;
  startPos.value = { x: pos.x, y: pos.y };
  
  // Handle based on the current tool
  switch (currentTool.value) {
    case 'rectangle':
      // Start drawing a new rectangle
      drawing.value = true;
      currentRectRaw.value = {
        x: startX.value,
        y: startY.value,
        width: 0,
        height: 0
      };
      break;
      
    case 'pan':
      // Start panning the canvas
      isPanning.value = true;
      startPanPoint.value = { x: viewOffset.value.x, y: viewOffset.value.y };
      panLastClientPos.value = { x: event.clientX, y: event.clientY };
      break;
      
    case 'select':
      // Check if we clicked on an annotation
      const clickedAnnotation = findAnnotationAtPosition(pos.x, pos.y);
      
      if (clickedAnnotation) {
        // If we're already editing this annotation, check if we clicked on a resize handle
        if (editingAnnotationId.value === clickedAnnotation._id) {
          const handle = findResizeHandleAtPosition(clickedAnnotation, pos.x, pos.y);
          
          if (handle) {
            isResizing.value = true;
            activeResizeHandle.value = handle;
            resizeStartPos.value = { x: pos.x, y: pos.y };
            originalResizingAnnotation.value = { ...clickedAnnotation };
            return;
          }
        }
        
        // Start dragging the annotation
        isDraggingAnnotation.value = true;
        editingAnnotationId.value = clickedAnnotation._id;
        dragStartPos.value = { x: pos.x, y: pos.y };
        dragStartRect.value = {
          x: clickedAnnotation.x,
          y: clickedAnnotation.y,
          width: clickedAnnotation.width,
          height: clickedAnnotation.height
        };
      } else {
        // If we didn't click on any annotation, clear the editing state
        finishEditingAnnotation();
      }
      break;
  }
}

function handleMouseMove(event) {
  if (!canvasRef.value) return;
  
  // Get the position in canvas coordinates
  const pos = clientToCanvas(event.clientX, event.clientY);
  
  // Update current position
  currentX.value = pos.x;
  currentY.value = pos.y;
  
  // Handle based on current state and tool
  if (drawing.value && currentTool.value === 'rectangle') {
    // Calculate width and height of the rectangle being drawn
    const width = pos.x - startX.value;
    const height = pos.y - startY.value;
    
    // Update the current rectangle
    currentRectRaw.value = {
      x: width < 0 ? pos.x : startX.value,
      y: height < 0 ? pos.y : startY.value,
      width: Math.abs(width),
      height: Math.abs(height)
    };
    
    // Redraw to show the user feedback
    redrawCanvas();
  } else if (isPanning.value && currentTool.value === 'pan') {
    // Calculate the pan delta
    const deltaX = event.clientX - panLastClientPos.value.x;
    const deltaY = event.clientY - panLastClientPos.value.y;
    
    // Update view offset
    viewOffset.value = {
      x: startPanPoint.value.x + deltaX,
      y: startPanPoint.value.y + deltaY
    };
    
    // No need to redraw here as the canvas position is updated via CSS transform
  } else if (isDraggingAnnotation.value && currentTool.value === 'select') {
    // Calculate the drag delta
    const deltaX = pos.x - dragStartPos.value.x;
    const deltaY = pos.y - dragStartPos.value.y;
    
    // Find the annotation being dragged
    const annotation = annotationStore.currentAnnotations.find(
      ann => ann._id === editingAnnotationId.value
    );
    
    if (annotation) {
      // Update the annotation position
      annotation.x = dragStartRect.value.x + deltaX;
      annotation.y = dragStartRect.value.y + deltaY;
      
      // Redraw
      redrawCanvas();
    }
  } else if (isResizing.value && currentTool.value === 'select') {
    // Resize the currently selected annotation based on active resize handle
    const annotation = annotationStore.currentAnnotations.find(
      ann => ann._id === editingAnnotationId.value
    );
    
    if (annotation && originalResizingAnnotation.value) {
      const deltaX = pos.x - resizeStartPos.value.x;
      const deltaY = pos.y - resizeStartPos.value.y;
      
      // Apply resize based on which handle is active
      switch (activeResizeHandle.value) {
        case 'topLeft':
          annotation.x = originalResizingAnnotation.value.x + deltaX;
          annotation.y = originalResizingAnnotation.value.y + deltaY;
          annotation.width = originalResizingAnnotation.value.width - deltaX;
          annotation.height = originalResizingAnnotation.value.height - deltaY;
          break;
        case 'topRight':
          annotation.y = originalResizingAnnotation.value.y + deltaY;
          annotation.width = originalResizingAnnotation.value.width + deltaX;
          annotation.height = originalResizingAnnotation.value.height - deltaY;
          break;
        case 'bottomLeft':
          annotation.x = originalResizingAnnotation.value.x + deltaX;
          annotation.width = originalResizingAnnotation.value.width - deltaX;
          annotation.height = originalResizingAnnotation.value.height + deltaY;
          break;
        case 'bottomRight':
          annotation.width = originalResizingAnnotation.value.width + deltaX;
          annotation.height = originalResizingAnnotation.value.height + deltaY;
          break;
        case 'top':
          annotation.y = originalResizingAnnotation.value.y + deltaY;
          annotation.height = originalResizingAnnotation.value.height - deltaY;
          break;
        case 'right':
          annotation.width = originalResizingAnnotation.value.width + deltaX;
          break;
        case 'bottom':
          annotation.height = originalResizingAnnotation.value.height + deltaY;
          break;
        case 'left':
          annotation.x = originalResizingAnnotation.value.x + deltaX;
          annotation.width = originalResizingAnnotation.value.width - deltaX;
          break;
      }
      
      // Ensure width and height are positive
      if (annotation.width < 0) {
        annotation.x = annotation.x + annotation.width;
        annotation.width = Math.abs(annotation.width);
      }
      
      if (annotation.height < 0) {
        annotation.y = annotation.y + annotation.height;
        annotation.height = Math.abs(annotation.height);
      }
      
      // Redraw
      redrawCanvas();
    }
  } else {
    // Just hovering - check if we're hovering over an annotation or handle
    if (currentTool.value === 'select') {
      const hoveredAnnotation = findAnnotationAtPosition(pos.x, pos.y);
      
      if (hoveredAnnotation) {
        highlightAnnotation(hoveredAnnotation);
      } else {
        unhighlightAnnotation();
      }
    }
  }
}

function handleMouseUp(event) {
  if (!canvasRef.value) return;
  
  // Get the position in canvas coordinates
  const pos = clientToCanvas(event.clientX, event.clientY);
  
  // Handle based on current state and tool
  if (drawing.value && currentTool.value === 'rectangle') {
    // Finish drawing the rectangle
    drawing.value = false;
    
    // Check if the rectangle has a minimum size
    if (currentRectRaw.value && 
        currentRectRaw.value.width > 5 && 
        currentRectRaw.value.height > 5) {
      
      // Save the coordinates for annotation creation
      pendingAnnotationCoordinates.value = { ...currentRectRaw.value };
      
      // Show the class input modal
      showClassModal.value = true;
      currentClassName.value = projectStore.currentProject?.classes?.[0] || '';
    }
    
    // Reset the current rectangle
    currentRectRaw.value = null;
  } else if (isPanning.value && currentTool.value === 'pan') {
    // Stop panning
    isPanning.value = false;
  } else if (isDraggingAnnotation.value && currentTool.value === 'select') {
    // Stop dragging
    isDraggingAnnotation.value = false;
    
    // Save the updated annotation to the database
    const annotation = annotationStore.currentAnnotations.find(
      ann => ann._id === editingAnnotationId.value
    );
    
    if (annotation && dragStartRect.value) {
      // Only save if position actually changed
      if (annotation.x !== dragStartRect.value.x || 
          annotation.y !== dragStartRect.value.y) {
        
        // Store original for undo
        const originalAnnotation = {
          ...annotation,
          x: dragStartRect.value.x,
          y: dragStartRect.value.y
        };
        
        // Save to database
        annotationStore.updateAnnotation(annotation, projectId.value, imageId.value)
          .then(() => {
            // Add to undo stack
            addToUndoStack({
              type: 'UPDATE',
              timestamp: Date.now(),
              annotationId: annotation._id,
              oldData: originalAnnotation,
              newData: { ...annotation }
            });
          })
          .catch(error => {
            console.error('Error updating annotation position:', error);
            toast.error('Failed to update annotation position');
            
            // Restore original position on error
            annotation.x = dragStartRect.value.x;
            annotation.y = dragStartRect.value.y;
            redrawCanvas();
          });
      }
    }
    
    // Reset drag state
    dragStartRect.value = null;
  } else if (isResizing.value && currentTool.value === 'select') {
    // Stop resizing
    isResizing.value = false;
    activeResizeHandle.value = null;
    
    // Save the resized annotation
    const annotation = annotationStore.currentAnnotations.find(
      ann => ann._id === editingAnnotationId.value
    );
    
    if (annotation && originalResizingAnnotation.value) {
      // Save to database
      annotationStore.updateAnnotation(annotation, projectId.value, imageId.value)
        .then(() => {
          // Add to undo stack
          addToUndoStack({
            type: 'UPDATE',
            timestamp: Date.now(),
            annotationId: annotation._id,
            oldData: originalResizingAnnotation.value,
            newData: { ...annotation }
          });
        })
        .catch(error => {
          console.error('Error updating annotation size:', error);
          toast.error('Failed to update annotation size');
          
          // Restore original on error
          Object.assign(annotation, originalResizingAnnotation.value);
          redrawCanvas();
        });
    }
    
    // Reset resize state
    originalResizingAnnotation.value = null;
  }
  
  // Redraw to ensure everything is up to date
  redrawCanvas();
}

function handleMouseLeave() {
  // Reset all interactive states
  drawing.value = false;
  isPanning.value = false;
  isDraggingAnnotation.value = false;
  isResizing.value = false;
  
  // Ensure we clean up any temporary UI elements
  currentRectRaw.value = null;
  redrawCanvas();
}

// Helper function to find an annotation at the specified position
function findAnnotationAtPosition(x, y) {
  if (!annotationStore.currentAnnotations) return null;
  
  // Check in reverse order (top-most annotation first)
  for (let i = annotationStore.currentAnnotations.length - 1; i >= 0; i--) {
    const ann = annotationStore.currentAnnotations[i];
    
    // Check if the point is inside the annotation
    if (x >= ann.x && 
        y >= ann.y && 
        x <= ann.x + ann.width && 
        y <= ann.y + ann.height) {
      return ann;
    }
  }
  
  return null;
}

// Helper function to find a resize handle at the given position
function findResizeHandleAtPosition(annotation, x, y) {
  if (!annotation) return null;
  
  const handleSize = 10; // Size of the resize handle
  const halfHandleSize = handleSize / 2;
  
  // Check each of the handles
  // Top-left
  if (Math.abs(x - annotation.x) <= halfHandleSize && 
      Math.abs(y - annotation.y) <= halfHandleSize) {
    return 'topLeft';
  }
  
  // Top-right
  if (Math.abs(x - (annotation.x + annotation.width)) <= halfHandleSize && 
      Math.abs(y - annotation.y) <= halfHandleSize) {
    return 'topRight';
  }
  
  // Bottom-left
  if (Math.abs(x - annotation.x) <= halfHandleSize && 
      Math.abs(y - (annotation.y + annotation.height)) <= halfHandleSize) {
    return 'bottomLeft';
  }
  
  // Bottom-right
  if (Math.abs(x - (annotation.x + annotation.width)) <= halfHandleSize && 
      Math.abs(y - (annotation.y + annotation.height)) <= halfHandleSize) {
    return 'bottomRight';
  }
  
  // Top edge
  if (Math.abs(y - annotation.y) <= halfHandleSize && 
      x > annotation.x + halfHandleSize && 
      x < annotation.x + annotation.width - halfHandleSize) {
    return 'top';
  }
  
  // Right edge
  if (Math.abs(x - (annotation.x + annotation.width)) <= halfHandleSize && 
      y > annotation.y + halfHandleSize && 
      y < annotation.y + annotation.height - halfHandleSize) {
    return 'right';
  }
  
  // Bottom edge
  if (Math.abs(y - (annotation.y + annotation.height)) <= halfHandleSize && 
      x > annotation.x + halfHandleSize && 
      x < annotation.x + annotation.width - halfHandleSize) {
    return 'bottom';
  }
  
  // Left edge
  if (Math.abs(x - annotation.x) <= halfHandleSize && 
      y > annotation.y + halfHandleSize && 
      y < annotation.y + annotation.height - halfHandleSize) {
    return 'left';
  }
  
  return null;
}

// Function to change the current drawing tool
function setTool(tool) {
  if (['rectangle', 'pan', 'select'].includes(tool)) {
    // Clear any active drawing or interaction state
    drawing.value = false;
    isPanning.value = false;
    isDraggingAnnotation.value = false;
    isResizing.value = false;
    
    // Set the new tool
    currentTool.value = tool;
    
    console.log(`Tool set to: ${tool}`);
    toast.info(`Switched to ${tool} tool`);
  }
}

// Tag handling functions
function addTag() {
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
  imageStore.updateImageTags(imageId.value, updatedTags)
    .then(() => {
      // Update local state
      currentImageTags.value = updatedTags;
      
      // Reset input and error
      newTagInput.value = '';
      tagError.value = '';
      
      toast.success(`Added tag: ${tag}`);
    })
    .catch(error => {
      console.error('Error adding tag:', error);
      tagError.value = 'Failed to add tag';
    });
}

function removeTag(tag) {
  if (!tag) return;
  
  // Remove the tag from the current image
  const updatedTags = currentImageTags.value.filter(t => t !== tag);
  
  // Save to the database
  imageStore.updateImageTags(imageId.value, updatedTags)
    .then(() => {
      // Update local state
      currentImageTags.value = updatedTags;
      
      toast.success(`Removed tag: ${tag}`);
    })
    .catch(error => {
      console.error('Error removing tag:', error);
      toast.error('Failed to remove tag');
    });
}

// Function to check if an annotation is selected
function isAnnotationSelected(annotationId) {
  return selectedAnnotationIds.value.includes(annotationId);
}

// Function to toggle selection of an annotation
function toggleAnnotationSelection(annotationId) {
  if (isAnnotationSelected(annotationId)) {
    // Remove from selected annotations
    selectedAnnotationIds.value = selectedAnnotationIds.value.filter(id => id !== annotationId);
  } else {
    // Add to selected annotations
    selectedAnnotationIds.value.push(annotationId);
  }
}

// Function to select all annotations
function selectAllAnnotations() {
  if (!annotationStore.currentAnnotations) return;
  
  // If all are already selected, deselect all instead
  if (selectedAnnotationIds.value.length === annotationStore.currentAnnotations.length) {
    selectedAnnotationIds.value = [];
  } else {
    // Select all annotations
    selectedAnnotationIds.value = annotationStore.currentAnnotations.map(ann => ann._id);
  }
}

// Function to delete an existing annotation
function deleteExistingAnnotation(annotationId) {
  if (!annotationId) return;
  
  // Find the annotation to delete
  const annotationToDelete = annotationStore.currentAnnotations.find(
    ann => ann._id === annotationId
  );
  
  if (!annotationToDelete) return;
  
  // Delete the annotation from the database
  annotationStore.deleteAnnotation(annotationId, projectId.value, imageId.value)
    .then(() => {
      toast.success(`Deleted ${annotationToDelete.label} annotation`);
      
      // Add to undo stack
      addToUndoStack({
        type: 'DELETE',
        timestamp: Date.now(),
        annotationId: annotationId,
        annotationData: { ...annotationToDelete }
      });
      
      // Deselect if it was selected
      if (isAnnotationSelected(annotationId)) {
        selectedAnnotationIds.value = selectedAnnotationIds.value.filter(id => id !== annotationId);
      }
      
      // Clear editing state if it was being edited
      if (editingAnnotationId.value === annotationId) {
        editingAnnotationId.value = null;
      }
    })
    .catch(error => {
      console.error('Error deleting annotation:', error);
      toast.error('Failed to delete annotation');
    });
}

// Function to delete all selected annotations
function deleteSelectedAnnotations() {
  if (selectedAnnotationIds.value.length === 0) return;
  
  // Store the annotations for undo functionality
  const annotationsToDelete = annotationStore.currentAnnotations.filter(ann => 
    selectedAnnotationIds.value.includes(ann._id)
  );
  
  // Add a single undo action for all deleted annotations
  addToUndoStack({
    type: 'MULTI_DELETE',
    timestamp: Date.now(),
    annotationIds: [...selectedAnnotationIds.value],
    annotationData: annotationsToDelete.map(ann => ({ ...ann }))
  });
  
  // Delete each annotation from the database
  const deletePromises = selectedAnnotationIds.value.map(id => 
    annotationStore.deleteAnnotation(id, projectId.value, imageId.value)
  );
  
  Promise.all(deletePromises)
    .then(() => {
      toast.success(`Deleted ${selectedAnnotationIds.value.length} annotations`);
      
      // Clear selection
      selectedAnnotationIds.value = [];
    })
    .catch(error => {
      console.error('Error deleting multiple annotations:', error);
      toast.error('Failed to delete annotations');
    });
}

// Function to detect shapes in the image using the selected method
function detectShapes() {
  if (detectingShapes.value) return;
  
  detectingShapes.value = true;
  
  // Determine the detection parameters based on the method
  const params = {
    method: detectionMethod.value,
    sensitivity: detectionParams.value.sensitivity,
    minArea: detectionParams.value.minArea,
    maxArea: detectionParams.value.maxArea
  };
  
  // If using SSIM comparison, include the reference image
  if (detectionMethod.value === 'ssim' && referenceImageData.value) {
    params.referenceImage = referenceImageData.value;
  }
  
  // Get the current image
  const currentImage = imageStore.getImageById(imageId.value);
  if (!currentImage || !currentImage.url) {
    toast.error('No image to detect shapes in');
    detectingShapes.value = false;
    return;
  }
  
  // Call the detection service
  detectObjectsInImage(currentImage.url, params)
    .then(detectedObjects => {
      if (!detectedObjects || detectedObjects.length === 0) {
        toast.info('No shapes detected');
        return;
      }
      
      // Convert the detected objects to annotations
      const newAnnotations = detectedObjects.map(obj => ({
        x: obj.x,
        y: obj.y,
        width: obj.width,
        height: obj.height,
        label: obj.label || defaultDetectionClass.value
      }));
      
      // Ask the user if they want to add the detected annotations
      if (confirm(`Add ${newAnnotations.length} detected shapes as annotations?`)) {
        // Create a promise for each annotation
        const createPromises = newAnnotations.map(ann => 
          annotationStore.createAnnotation(ann, projectId.value, imageId.value)
        );
        
        Promise.all(createPromises)
          .then(createdAnnotations => {
            toast.success(`Added ${createdAnnotations.length} auto-detected annotations`);
            
            // Add to undo stack as a batch operation
            const undoAction = {
              type: 'MULTI_CREATE',
              timestamp: Date.now(),
              annotationIds: createdAnnotations.map(ann => ann._id),
              annotationData: createdAnnotations.map(ann => ({ ...ann }))
            };
            
            addToUndoStack(undoAction);
          })
          .catch(error => {
            console.error('Error creating annotations:', error);
            toast.error('Failed to create annotations');
          });
      }
    })
    .catch(error => {
      console.error('Error detecting shapes:', error);
      toast.error(`Failed to detect shapes: ${error.message || 'Unknown error'}`);
    })
    .finally(() => {
      detectingShapes.value = false;
    });
}

// Function to name annotations using the LLM service
function nameAnnotationsWithLLM() {
  if (namingAnnotations.value || annotationStore.currentAnnotations.length === 0) return;
  
  namingAnnotations.value = true;
  namingStatus.value = 'Preparing annotations...';
  namingProgress.value = 0;
  
  // Get the current image
  const currentImage = imageStore.getImageById(imageId.value);
  if (!currentImage || !currentImage.url) {
    toast.error('No image to analyze');
    namingAnnotations.value = false;
    return;
  }
  
  // Call the LLM service
  nameWithLLM(
    currentImage.url, 
    annotationStore.currentAnnotations, 
    projectId.value, 
    imageId.value,
    // Progress callback
    (status, progress) => {
      namingStatus.value = status;
      namingProgress.value = progress;
    }
  )
    .then(namedAnnotations => {
      if (!namedAnnotations || namedAnnotations.length === 0) {
        toast.info('No annotations were named');
        return;
      }
      
      toast.success(`Named ${namedAnnotations.length} annotations using AI`);
      
      // Add to undo stack (in this case, as individual updates)
      namedAnnotations.forEach(namedAnn => {
        // Find the original annotation
        const originalAnn = annotationStore.currentAnnotations.find(
          ann => ann._id === namedAnn._id
        );
        
        if (originalAnn && originalAnn.label !== namedAnn.label) {
          // Add to undo stack
          addToUndoStack({
            type: 'UPDATE',
            timestamp: Date.now(),
            annotationId: namedAnn._id,
            oldData: { ...originalAnn },
            newData: { ...namedAnn }
          });
        }
      });
    })
    .catch(error => {
      console.error('Error naming annotations:', error);
      toast.error(`Failed to name annotations: ${error.message || 'Unknown error'}`);
    })
    .finally(() => {
      namingAnnotations.value = false;
      namingStatus.value = '';
      namingProgress.value = 0;
    });
}

// Function to load a reference image for SSIM comparison
function loadReferenceImage() {
  if (!referenceImageId.value) {
    referenceImagePreview.value = '';
    referenceImageData.value = null;
    return;
  }
  
  // Get the image URL from the store
  const refImage = imageStore.getImageById(referenceImageId.value);
  
  if (refImage) {
    // Set the preview image
    referenceImagePreview.value = refImage.url || '';
    
    // Fetch the image data for the detection service
    fetch(refImage.url)
      .then(response => response.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => {
          referenceImageData.value = reader.result;
        };
        reader.readAsDataURL(blob);
      })
      .catch(error => {
        console.error('Error loading reference image data:', error);
        toast.error('Failed to load reference image data');
        referenceImageData.value = null;
      });
  } else {
    referenceImagePreview.value = '';
    referenceImageData.value = null;
  }
}

// Function for the image load event
function onImageLoad() {
  if (!imageRef.value || !canvasRef.value) return;
  
  // Store the image dimensions
  imageDimensions.value = {
    width: imageRef.value.width,
    height: imageRef.value.height,
    naturalWidth: imageRef.value.naturalWidth,
    naturalHeight: imageRef.value.naturalHeight
  };
  
  // Set canvas size to match the natural image size
  canvasRef.value.width = imageRef.value.naturalWidth;
  canvasRef.value.height = imageRef.value.naturalHeight;
  
  // Get the 2D rendering context
  ctx = canvasRef.value.getContext('2d');
  
  // Draw any existing annotations
  redrawCanvas();
}

// Function to redraw the canvas with all annotations
function redrawCanvas() {
  if (!canvasRef.value || !ctx) return;
  
  // Clear the canvas
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  
  // Draw all annotations with proper scaling for zoom
  if (annotationStore.currentAnnotations) {
    annotationStore.currentAnnotations.forEach(annotation => {
      // Determine if this annotation is highlighted, selected, or being edited
      const isHighlighted = annotation._id === highlightedAnnotationId.value;
      const isSelected = selectedAnnotationIds.value.includes(annotation._id);
      const isEditing = annotation._id === editingAnnotationId.value;
      
      // Draw the annotation with the appropriate styling
      drawAnnotation(annotation, isHighlighted, isSelected, isEditing);
    });
  }
  
  // Draw the current rectangle if we're in the middle of drawing
  if (drawing.value && currentRectRaw.value) {
    drawRectangle(
      currentRectRaw.value.x,
      currentRectRaw.value.y,
      currentRectRaw.value.width,
      currentRectRaw.value.height,
      'rgba(0, 150, 255, 0.5)',
      'rgba(0, 150, 255, 1)'
    );
  }
}

// Function to draw a rectangle on the canvas
function drawRectangle(x, y, width, height, fillColor, strokeColor) {
  if (!ctx) return;
  
  ctx.fillStyle = fillColor || 'rgba(255, 0, 0, 0.2)';
  ctx.strokeStyle = strokeColor || 'rgba(255, 0, 0, 1)';
  ctx.lineWidth = 2;
  
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
}

// Function to draw an annotation with appropriate styling
function drawAnnotation(annotation, isHighlighted, isSelected, isEditing) {
  if (!ctx || !annotation) return;
  
  const { x, y, width, height, label } = annotation;
  
  // Choose colors based on annotation state
  let fillColor = `${getColorForClass(label)}40`; // 25% opacity
  let strokeColor = getColorForClass(label);
  let lineWidth = 2;
  
  // Adjust styling for different states
  if (isHighlighted) {
    fillColor = `${getColorForClass(label)}80`; // 50% opacity
    lineWidth = 3;
  }
  
  if (isSelected) {
    strokeColor = '#FFA500'; // Orange for selected
    lineWidth = 3;
  }
  
  if (isEditing) {
    strokeColor = '#FFD700'; // Gold for editing
    lineWidth = 4;
  }
  
  // Draw the rectangle
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  
  // Draw label
  ctx.font = '14px Arial';
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  
  const textX = x + 5;
  const textY = y - 5;
  
  ctx.strokeText(label, textX, textY);
  ctx.fillText(label, textX, textY);
  
  // If we're editing this annotation, draw resize handles
  if (isEditing) {
    drawResizeHandles(x, y, width, height);
  }
}

// Function to draw resize handles for an annotation being edited
function drawResizeHandles(x, y, width, height) {
  if (!ctx) return;
  
  const handleSize = 10;
  const halfHandleSize = handleSize / 2;
  
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  
  // Draw handles at each corner and on each edge
  // Top-left
  drawHandle(x - halfHandleSize, y - halfHandleSize, handleSize);
  
  // Top-right
  drawHandle(x + width - halfHandleSize, y - halfHandleSize, handleSize);
  
  // Bottom-left
  drawHandle(x - halfHandleSize, y + height - halfHandleSize, handleSize);
  
  // Bottom-right
  drawHandle(x + width - halfHandleSize, y + height - halfHandleSize, handleSize);
  
  // Top center
  drawHandle(x + width / 2 - halfHandleSize, y - halfHandleSize, handleSize);
  
  // Right center
  drawHandle(x + width - halfHandleSize, y + height / 2 - halfHandleSize, handleSize);
  
  // Bottom center
  drawHandle(x + width / 2 - halfHandleSize, y + height - halfHandleSize, handleSize);
  
  // Left center
  drawHandle(x - halfHandleSize, y + height / 2 - halfHandleSize, handleSize);
}

// Function to draw a single resize handle
function drawHandle(x, y, size) {
  if (!ctx) return;
  
  ctx.fillRect(x, y, size, size);
  ctx.strokeRect(x, y, size, size);
}

// Function to zoom in
function zoomIn() {
  if (zoomLevel.value < MAX_ZOOM) {
    zoomLevel.value = Math.min(zoomLevel.value + ZOOM_STEP, MAX_ZOOM);
    console.log(`Zoomed in to ${zoomLevel.value}x`);
    redrawCanvas();
  }
}

// Function to zoom out
function zoomOut() {
  if (zoomLevel.value > MIN_ZOOM) {
    zoomLevel.value = Math.max(zoomLevel.value - ZOOM_STEP, MIN_ZOOM);
    console.log(`Zoomed out to ${zoomLevel.value}x`);
    redrawCanvas();
  }
}

// Function to reset zoom
function resetZoom() {
  zoomLevel.value = 1;
  viewOffset.value = { x: 0, y: 0 };
  console.log('Zoom reset to 1x');
  redrawCanvas();
}

// Function to test annotation zoom functionality
function runAnnotationZoomTest() {
  // Simple test function to verify zoom functionality with annotations
  if (annotationStore.currentAnnotations.length === 0) {
    toast.error('No annotations to test with');
    return;
  }
  
  const testSteps = [
    { zoom: 1.5, message: 'Testing zoom at 1.5x' },
    { zoom: 2.0, message: 'Testing zoom at 2.0x' },
    { zoom: 0.5, message: 'Testing zoom at 0.5x' },
    { zoom: 1.0, message: 'Returning to normal zoom' }
  ];
  
  let stepIndex = 0;
  
  const runStep = () => {
    if (stepIndex >= testSteps.length) {
      toast.success('Zoom test completed');
      return;
    }
    
    const step = testSteps[stepIndex];
    zoomLevel.value = step.zoom;
    toast.info(step.message);
    
    // Move to next step after a short delay
    setTimeout(() => {
      stepIndex++;
      runStep();
    }, 1000);
  };
  
  runStep();
}

// Lifecycle hooks and watchers
onMounted(async () => {
  console.log('AnnotationEditorView mounted');
  
  // Load the project data
  await projectStore.loadProject(projectId.value);
  
  // Load the image data
  await imageStore.loadImage(imageId.value);
  
  // Load existing annotations
  await annotationStore.loadAnnotations(projectId.value, imageId.value);
  
  // Set the image URL
  const currentImage = imageStore.getImageById(imageId.value);
  if (currentImage && currentImage.url) {
    imageUrl.value = currentImage.url;
    
    // Load image tags
    currentImageTags.value = currentImage.tags || [];
  }
  
  // Add event listeners for keyboard shortcuts
  window.addEventListener('keydown', handleKeyDown);
  
  // Initialize the canvas once the page has loaded
  nextTick(() => {
    if (imageRef.value && imageRef.value.complete) {
      onImageLoad();
    }
  });
});

onUnmounted(() => {
  // Remove event listeners
  window.removeEventListener('keydown', handleKeyDown);
});

// Handle keyboard shortcuts
function handleKeyDown(event) {
  // Escape - cancel current action or close modal
  if (event.key === 'Escape') {
    if (showClassModal.value) {
      cancelClassInput();
    } else if (drawing.value) {
      drawing.value = false;
      currentRectRaw.value = null;
      redrawCanvas();
    } else if (isPanning.value) {
      isPanning.value = false;
    } else if (isDraggingAnnotation.value) {
      isDraggingAnnotation.value = false;
      
      // Restore original position
      if (dragStartRect.value && editingAnnotationId.value) {
        const annotation = annotationStore.currentAnnotations.find(
          ann => ann._id === editingAnnotationId.value
        );
        
        if (annotation) {
          annotation.x = dragStartRect.value.x;
          annotation.y = dragStartRect.value.y;
        }
      }
      
      dragStartRect.value = null;
      redrawCanvas();
    } else if (isResizing.value) {
      isResizing.value = false;
      activeResizeHandle.value = null;
      
      // Restore original size
      if (originalResizingAnnotation.value && editingAnnotationId.value) {
        const annotation = annotationStore.currentAnnotations.find(
          ann => ann._id === editingAnnotationId.value
        );
        
        if (annotation) {
          Object.assign(annotation, originalResizingAnnotation.value);
        }
      }
      
      originalResizingAnnotation.value = null;
      redrawCanvas();
    } else if (editingAnnotationId.value) {
      finishEditingAnnotation();
    }
  }
  
  // Delete key - delete selected annotation(s)
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (selectedAnnotationIds.value.length > 0) {
      if (confirm(`Delete ${selectedAnnotationIds.value.length} selected annotation(s)?`)) {
        deleteSelectedAnnotations();
      }
    } else if (editingAnnotationId.value) {
      const annotation = annotationStore.currentAnnotations.find(
        ann => ann._id === editingAnnotationId.value
      );
      
      if (annotation && confirm(`Delete ${annotation.label} annotation?`)) {
        deleteExistingAnnotation(annotation._id);
      }
    }
  }
  
  // Keyboard shortcuts for tools (r=rectangle, p=pan, s=select)
  if (event.key === 'r') {
    setTool('rectangle');
  } else if (event.key === 'p') {
    setTool('pan');
  } else if (event.key === 's') {
    setTool('select');
  }
  
  // Undo/Redo shortcuts
  if (event.ctrlKey || event.metaKey) {
    if (event.key === 'z') {
      if (event.shiftKey) {
        // Ctrl+Shift+Z or Cmd+Shift+Z for Redo
        if (canRedo.value) {
          event.preventDefault();
          redo();
        }
      } else {
        // Ctrl+Z or Cmd+Z for Undo
        if (canUndo.value) {
          event.preventDefault();
          undo();
        }
      }
    } else if (event.key === 'y') {
      // Ctrl+Y or Cmd+Y for Redo
      if (canRedo.value) {
        event.preventDefault();
        redo();
      }
    }
  }
}
</script>

<style scoped>
.annotation-editor-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

.breadcrumb {
  padding: 10px;
  background-color: #f8f8f8;
  border-bottom: 1px solid #ddd;
}

.breadcrumb a {
  color: #3498db;
  text-decoration: none;
}

.breadcrumb a:hover {
  text-decoration: underline;
}

.editor-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.toolbar {
  padding: 10px;
  background-color: #fff;
  border-right: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  width: 200px;
}

.toolbar h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
  color: #333;
}

.toolbar button {
  margin-bottom: 10px;
  padding: 10px;
  font-size: 14px;
  color: #333;
  background-color: #f1f1f1;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: background-color 0.3s;
}

.toolbar button:hover {
  background-color: #e1e1e1;
}

.toolbar button.active {
  background-color: #3498db;
  color: white;
  border-color: #2980b9;
}

.canvas-container {
  position: relative;
  flex: 1;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f9f9f9;
  border: 1px solid #ddd;
}

canvas {
  position: absolute;
  top: 0;
  left: 0;
  cursor: crosshair;
}

.side-panel {
  width: 300px;
  padding: 10px;
  background-color: #fff;
  border-left: 1px solid #ddd;
  display: flex;
  flex-direction: column;
}

.classes-section,
.layers-section,
.raw-data-section,
.image-tags-section,
.detection-settings-section {
  margin-bottom: 20px;
}

h4 {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #333;
}

ul {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 8px;
  margin-bottom: 5px;
  background-color: #f9f9f9;
  border: 1px solid #ddd;
  cursor: pointer;
  transition: background-color 0.3s;
}

li:hover {
  background-color: #f1f1f1;
}

.annotation-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.annotation-checkbox {
  margin-right: 10px;
}

.annotation-label {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.annotation-buttons {
  display: flex;
  gap: 5px;
}

.edit-ann-btn,
.delete-ann-btn {
  padding: 5px 10px;
  font-size: 12px;
  color: #fff;
  background-color: #3498db;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s;
}

.edit-ann-btn:hover,
.delete-ann-btn:hover {
  background-color: #2980b9;
}

.error-message {
  color: #e74c3c;
  background-color: #f9d6d5;
  padding: 10px;
  border: 1px solid #e74c3c;
  border-radius: 4px;
  margin-bottom: 10px;
}

.tag-pill {
  display: inline-block;
  padding: 5px 10px;
  font-size: 12px;
  color: #fff;
  background-color: #3498db;
  border-radius: 12px;
  margin-right: 5px;
  margin-bottom: 5px;
  transition: background-color 0.3s;
}

.tag-pill:hover {
  background-color: #2980b9;
}

.add-tag-input {
  display: flex;
  gap: 5px;
}

.add-tag-input input {
  flex: 1;
  padding: 8px;
  font-size: 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.add-tag-input button {
  padding: 8px 12px;
  font-size: 14px;
  color: #fff;
  background-color: #3498db;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.add-tag-input button:hover {
  background-color: #2980b9;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: #fff;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  max-width: 400px;
  width: 100%;
}

.modal-content h3 {
  margin: 0 0 15px 0;
  font-size: 18px;
  color: #333;
}

.modal-content input {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 10px;
}

.modal-content button {
  padding: 10px;
  font-size: 14px;
  color: #fff;
  background-color: #3498db;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

.modal-content button:hover {
  background-color: #2980b9;
}

.processing {
  position: relative;
}

.processing .spinner {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.6);
  border-top: 2px solid #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
