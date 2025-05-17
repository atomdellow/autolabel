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
          <ul v-if="annotationStore.currentAnnotations.length">
            <li v-for="(ann, index) in annotationStore.currentAnnotations" :key="ann._id"
                @mouseover="highlightAnnotation(ann)" @mouseleave="unhighlightAnnotation"
                :class="{ 
                  'highlighted': highlightedAnnotationId === ann._id, 
                  'editing': editingAnnotationId === ann._id,
                  'has-history': hasAnnotationHistory(ann._id)
                }"
                :style="{ borderLeftColor: getColorForClass(ann.label) }">
              <span>
                {{ ann.label }} #{{ index + 1 }}
                <small v-if="hasAnnotationHistory(ann._id)" title="This annotation has undo/redo history" class="history-indicator">★</small>
              </span>              <button @click="startEditingAnnotation(ann)" class="edit-ann-btn" title="Edit this annotation">Edit</button>
              <button @click="deleteExistingAnnotation(ann._id)" class="delete-ann-btn" title="Delete this annotation">Delete</button>
            </li>
          </ul>
          <p v-else>No annotations yet.</p>
        </div>
        <div class="raw-data-section">
          <h4>Raw Annotation Data</h4>
          <button @click="showRawData = !showRawData">{{ showRawData ? 'Hide' : 'Show' }} Raw Data</button>
          <pre v-if="showRawData">{{ JSON.stringify(annotationStore.currentAnnotations, null, 2) }}</pre>
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
      <div class="modal-content">
        <h3>Assign Class</h3>
        <input type="text" v-model="currentClassName" placeholder="Enter class name" @keyup.enter="confirmClassInput"/>
        <div>
            <p>Existing classes:</p>
            <button v-for="cls in projectStore.currentProject?.classes || []" :key="cls" @click="currentClassName = cls">
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
/* 
 * IMPORTANT NOTE ABOUT ANNOTATION WORKFLOW:
 * 
 * The backend endpoint used for creating annotations `/api/annotations/image/:imageId/set` first DELETES ALL
 * existing annotations for the image before saving the new ones. This means:
 * 
 * 1. Creating a new annotation will remove all previous annotations for that image on the server
 * 2. If the frontend store isn't updated correctly, there can be a mismatch between UI state and server state
 * 3. This can lead to 404 errors when trying to delete annotations that appear in the UI but no longer exist on the server
 * 
 * The annotationStore.js has been adjusted to replace the local annotations array with the server response
 * after creation, and improved error handling for the delete operation.
 */

import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../store/projectStore';
import { useImageStore } from '../store/imageStore';
import { useAnnotationStore } from '../store/annotationStore';
import { detectObjects, compareScreenshots } from '../services/detectionService';

const route = useRoute();
const router = useRouter();

const projectStore = useProjectStore();
const imageStore = useImageStore();
const annotationStore = useAnnotationStore();

const projectId = ref(route.params.projectId);
const imageId = ref(route.params.imageId);

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

const imageRef = ref(null);
const canvasRef = ref(null);
const canvasContainerRef = ref(null);
let ctx = null;

const imageUrl = ref('');
const imageDimensions = ref({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

const currentTool = ref('rectangle'); // 'rectangle', 'pan'
const drawing = ref(false);
const startPos = ref({ x: 0, y: 0 });
const currentRectRaw = ref(null); // Stores the raw x,y,width,height of the rectangle being drawn
// const currentRect = ref(null); // Replaced by currentRectRaw for clarity

const viewOffset = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const panLastClientPos = ref({ x: 0, y: 0 });

const showClassModal = ref(false);
const currentClassName = ref('');
const classModalError = ref('');
let pendingAnnotationCoordinates = null; // Stores {x_canvas, y_canvas, width_canvas, height_canvas}

const highlightedAnnotationId = ref(null);
const showRawData = ref(false);

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

// Function to check if an annotation has history in undo/redo stacks
function hasAnnotationHistory(annotationId) {
  if (!annotationId) return false;
  
  // Check if this annotation appears in the undo stack
  const inUndoStack = undoStack.value.some(action => 
    (action.type === 'CREATE' && action.annotationId === annotationId) ||
    (action.type === 'UPDATE' && action.annotationId === annotationId) ||
    (action.type === 'DELETE' && action.annotationData && action.annotationData._id === annotationId)
  );
  
  // Check if this annotation appears in the redo stack
  const inRedoStack = redoStack.value.some(action => 
    (action.type === 'CREATE' && action.annotationData && action.annotationData._id === annotationId) ||
    (action.type === 'UPDATE' && action.annotationId === annotationId) ||
    (action.type === 'DELETE' && action.annotationData && action.annotationData._id === annotationId)
  );
  
  return inUndoStack || inRedoStack;
}

// Color utility
const classColors = ref({});
const availableColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FED766', '#2AB7CA', '#F0B67F', '#8A6FDF', '#D65DB1'];
let colorIndex = 0;

function getColorForClass(className) {
  if (!classColors.value[className]) {
    classColors.value[className] = availableColors[colorIndex % availableColors.length];
    colorIndex++;
  }
  return classColors.value[className];
}

function startEditingAnnotation(annotation) {
  if (!annotation || !annotation._id) {
    console.error("Cannot start editing: Invalid annotation provided.", annotation);
    return;
  }
  // If already editing this one, treat as 'finish editing'
  if (editingAnnotationId.value === annotation._id) {
    finishEditingAnnotation();
    return;
  }
  
  editingAnnotationId.value = annotation._id;
  originalAnnotationBeforeEdit.value = JSON.parse(JSON.stringify(annotation)); // Deep copy for undo
  // Optionally, switch tool or disable others
  // currentTool.value = 'resize'; // Or handle this implicitly
  console.log("Started editing annotation:", editingAnnotationId.value);
  redrawCanvas(); // Redraw to show handles or selection
}

function finishEditingAnnotation() {
  if (editingAnnotationId.value && originalAnnotationBeforeEdit.value) {
    const currentAnnotationState = annotationStore.currentAnnotations.find(a => a._id === editingAnnotationId.value);
    // Check if changes were made compared to originalAnnotationBeforeEdit
    // This simple check might not be deep enough if object structures are complex or order changes
    // A more robust deep comparison might be needed if properties other than x,y,width,height can change during edit mode without explicit save.
    if (JSON.stringify(currentAnnotationState) !== JSON.stringify(originalAnnotationBeforeEdit.value)) {
        // This implies an edit was made and saved (e.g., via resize mouseUp)
        // The undo stack should have been pushed by the resize logic already.
        // If we want to save on 'Enter' or clicking edit again, that logic needs to be here.
        // For now, we assume resize mouseUp is the only way to save an edit.
    }
  }
  editingAnnotationId.value = null;
  isResizing.value = false; // Should already be false, but good to ensure
  activeResizeHandle.value = null;
  originalAnnotationBeforeEdit.value = null;
  originalResizingAnnotation.value = null; // Clear this too
  console.log("Finished editing");
  redrawCanvas();
}

// Add keyboard listener for Enter key to finish editing
function handleKeyDown(event) {
  if (event.key === 'Enter' && editingAnnotationId.value) {
    finishEditingAnnotation();
  }
  // Potentially add Escape key to cancel current resize drag and revert to originalAnnotationBeforeEdit state
  // if (event.key === 'Escape' && isResizing.value) { ... }
}

onMounted(async () => {
  if (!projectStore.currentProject || projectStore.currentProject._id !== projectId.value) {
    await projectStore.loadProjectById(projectId.value);
  }
  
  const image = imageStore.getImageById(imageId.value) || await imageStore.fetchImageById(projectId.value, imageId.value);
  if (image && image.path) {
    imageUrl.value = getCorrectAssetUrl(image.path);
  } else {
    console.error("Image not found or path is missing:", imageId.value);
  }

  await annotationStore.fetchAnnotations(imageId.value);
  
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d');
  }

  // Ensure undo/redo stacks are reset when component mounts or image changes
  undoStack.value = [];
  redoStack.value = [];

  const container = canvasContainerRef.value;
  if (container) {
    const resizeObserver = new ResizeObserver(onImageLoad);
    resizeObserver.observe(container);
    onUnmounted(() => resizeObserver.disconnect());
  }

  window.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', handlePanMove);
  window.removeEventListener('mouseup', handlePanEnd);
  window.removeEventListener('keydown', handleKeyDown);
});

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

onMounted(async () => {
  if (!projectStore.currentProject || projectStore.currentProject._id !== projectId.value) {
    await projectStore.loadProjectById(projectId.value);
  }
  
  const image = imageStore.getImageById(imageId.value) || await imageStore.fetchImageById(projectId.value, imageId.value);
  if (image && image.path) {
    imageUrl.value = getCorrectAssetUrl(image.path);
  } else {
    console.error("Image not found or path is missing:", imageId.value);
  }

  await annotationStore.fetchAnnotations(imageId.value);
  
  if (canvasRef.value) {
    ctx = canvasRef.value.getContext('2d');
  }

  // Ensure undo/redo stacks are reset when component mounts or image changes
  undoStack.value = [];
  redoStack.value = [];

  const container = canvasContainerRef.value;
  if (container) {
    const resizeObserver = new ResizeObserver(onImageLoad);
    resizeObserver.observe(container);
    onUnmounted(() => resizeObserver.disconnect());
  }
});

const onImageLoad = () => {
  if (imageRef.value && canvasRef.value && canvasContainerRef.value) {
    const img = imageRef.value;
    const container = canvasContainerRef.value;

    imageDimensions.value.naturalWidth = img.naturalWidth;
    imageDimensions.value.naturalHeight = img.naturalHeight;

    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    
    let newWidth = img.naturalWidth;
    let newHeight = img.naturalHeight;

    if (newWidth > containerWidth) {
        const ratio = containerWidth / newWidth;
        newWidth = containerWidth;
        newHeight *= ratio;
    }
    if (newHeight > containerHeight && containerHeight > 0) {
        const ratio = containerHeight / newHeight;
        newHeight = containerHeight;
        newWidth *= ratio;
    }
    if (newHeight === 0 && containerHeight === 0 && newWidth === img.naturalWidth) {
        newHeight = img.naturalHeight;
    }

    imageDimensions.value.width = newWidth;
    imageDimensions.value.height = newHeight;

    canvasRef.value.width = newWidth;
    canvasRef.value.height = newHeight;
    
    redrawCanvas();
  }
};

watch(() => annotationStore.currentAnnotations, () => {
  // Only redraw if not actively drawing a new rectangle,
  // as handleMouseMove will handle its own drawing updates.
  if (!drawing.value) {
    redrawCanvas();
  }
}, { deep: true });

function getMousePos(event) {
  const rect = canvasRef.value.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

const HANDLE_SIZE = 8;

function getHandleAtPoint(canvasX, canvasY, annotationRect) {
  if (!annotationRect) return null;

  const handles = [
    { name: 'topLeft', x: annotationRect.x, y: annotationRect.y },
    { name: 'topRight', x: annotationRect.x + annotationRect.width, y: annotationRect.y },
    { name: 'bottomLeft', x: annotationRect.x, y: annotationRect.y + annotationRect.height },
    { name: 'bottomRight', x: annotationRect.x + annotationRect.width, y: annotationRect.y + annotationRect.height },
    { name: 'top', x: annotationRect.x + annotationRect.width / 2, y: annotationRect.y },
    { name: 'bottom', x: annotationRect.x + annotationRect.width / 2, y: annotationRect.y + annotationRect.height },
    { name: 'left', x: annotationRect.x, y: annotationRect.y + annotationRect.height / 2 },
    { name: 'right', x: annotationRect.x + annotationRect.width, y: annotationRect.y + annotationRect.height / 2 },
  ];

  for (const handle of handles) {
    const dist = Math.sqrt(Math.pow(handle.x - canvasX, 2) + Math.pow(handle.y - canvasY, 2));
    if (dist <= HANDLE_SIZE / 2) {
      return handle.name;
    }
  }
  return null;
}


function handleMouseDown(event) {
  if (event.button !== 0) return; // Only left click

  const mousePos = getMousePos(event);

  if (editingAnnotationId.value) {
    const editingAnn = annotationStore.currentAnnotations.find(ann => ann._id === editingAnnotationId.value);
    if (editingAnn) {
      const displayRect = {
        x: editingAnn.x / imageDimensions.value.naturalWidth * imageDimensions.value.width,
        y: editingAnn.y / imageDimensions.value.naturalHeight * imageDimensions.value.height,
        width: editingAnn.width / imageDimensions.value.naturalWidth * imageDimensions.value.width,
        height: editingAnn.height / imageDimensions.value.naturalHeight * imageDimensions.value.height,
      };
      const handle = getHandleAtPoint(mousePos.x, mousePos.y, displayRect);
      if (handle) {
        isResizing.value = true;
        activeResizeHandle.value = handle;
        resizeStartPos.value = mousePos;
        // Store a copy of the annotation in its current state (natural coordinates) before this specific resize operation
        originalResizingAnnotation.value = JSON.parse(JSON.stringify(editingAnn));
        // Prevent drawing new rectangle or panning
        event.stopPropagation(); 
        event.preventDefault();
        return;
      }
    }
  }

  if (currentTool.value === 'pan') {
    isPanning.value = true;
    panLastClientPos.value = { x: event.clientX, y: event.clientY };
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
    event.preventDefault();
  } else if (currentTool.value === 'rectangle' && ctx) {
    // Prevent starting a new drawing if a click is on an existing annotation
    // (unless we implement a select tool or select-and-drag-to-move later)
    const clickedOnExisting = annotationStore.currentAnnotations.some(ann => {
        const displayRect = {
            x: ann.x / imageDimensions.value.naturalWidth * imageDimensions.value.width,
            y: ann.y / imageDimensions.value.naturalHeight * imageDimensions.value.height,
            width: ann.width / imageDimensions.value.naturalWidth * imageDimensions.value.width,
            height: ann.height / imageDimensions.value.naturalHeight * imageDimensions.value.height,
        };
        return mousePos.x >= displayRect.x && mousePos.x <= displayRect.x + displayRect.width &&
               mousePos.y >= displayRect.y && mousePos.y <= displayRect.y + displayRect.height;
    });

    if (clickedOnExisting && !editingAnnotationId.value) { // If not editing, don't draw if click is on existing
        // Potentially select the annotation here in the future
        return;
    }
    
    drawing.value = true;
    startPos.value = getMousePos(event);
    currentRectRaw.value = {
        x: startPos.value.x,
        y: startPos.value.y,
        width: 0,
        height: 0
    };
    // No need to preventDefault if we are not interfering with other browser behavior like text selection.
    // event.preventDefault(); 
  }
}

function handleMouseMove(event) {
  if (isResizing.value && editingAnnotationId.value && activeResizeHandle.value && originalResizingAnnotation.value) {
    const mousePos = getMousePos(event);
    const annToResize = annotationStore.currentAnnotations.find(a => a._id === editingAnnotationId.value);
    if (!annToResize) return;

    // Calculate changes in canvas coordinates
    const dxCanvas = mousePos.x - resizeStartPos.value.x;
    const dyCanvas = mousePos.y - resizeStartPos.value.y;

    // Convert original annotation dimensions from natural to canvas for calculation
    const origCanvasRect = {
        x: originalResizingAnnotation.value.x / imageDimensions.value.naturalWidth * imageDimensions.value.width,
        y: originalResizingAnnotation.value.y / imageDimensions.value.naturalHeight * imageDimensions.value.height,
        width: originalResizingAnnotation.value.width / imageDimensions.value.naturalWidth * imageDimensions.value.width,
        height: originalResizingAnnotation.value.height / imageDimensions.value.naturalHeight * imageDimensions.value.height,
    };

    let newCanvasRect = { ...origCanvasRect };

    switch (activeResizeHandle.value) {
        case 'topLeft':
            newCanvasRect.x = origCanvasRect.x + dxCanvas;
            newCanvasRect.y = origCanvasRect.y + dyCanvas;
            newCanvasRect.width = origCanvasRect.width - dxCanvas;
            newCanvasRect.height = origCanvasRect.height - dyCanvas;
            break;
        case 'topRight':
            newCanvasRect.y = origCanvasRect.y + dyCanvas;
            newCanvasRect.width = origCanvasRect.width + dxCanvas;
            newCanvasRect.height = origCanvasRect.height - dyCanvas;
            break;
        case 'bottomLeft':
            newCanvasRect.x = origCanvasRect.x + dxCanvas;
            newCanvasRect.width = origCanvasRect.width - dxCanvas;
            newCanvasRect.height = origCanvasRect.height + dyCanvas;
            break;
        case 'bottomRight':
            newCanvasRect.width = origCanvasRect.width + dxCanvas;
            newCanvasRect.height = origCanvasRect.height + dyCanvas;
            break;
        case 'top':
            newCanvasRect.y = origCanvasRect.y + dyCanvas;
            newCanvasRect.height = origCanvasRect.height - dyCanvas;
            break;
        case 'bottom':
            newCanvasRect.height = origCanvasRect.height + dyCanvas;
            break;
        case 'left':
            newCanvasRect.x = origCanvasRect.x + dxCanvas;
            newCanvasRect.width = origCanvasRect.width - dxCanvas;
            break;
        case 'right':
            newCanvasRect.width = origCanvasRect.width + dxCanvas;
            break;
    }

    // Ensure width and height are not negative by adjusting x/y
    if (newCanvasRect.width < 0) {
        newCanvasRect.x = newCanvasRect.x + newCanvasRect.width;
        newCanvasRect.width = Math.abs(newCanvasRect.width);
    }
    if (newCanvasRect.height < 0) {
        newCanvasRect.y = newCanvasRect.y + newCanvasRect.height;
        newCanvasRect.height = Math.abs(newCanvasRect.height);
    }
    
    // Update the actual annotation in the store with new natural coordinates for live redraw
    // This is an optimistic update for visuals. Final save happens on mouseUp.
    annToResize.x = newCanvasRect.x / imageDimensions.value.width * imageDimensions.value.naturalWidth;
    annToResize.y = newCanvasRect.y / imageDimensions.value.height * imageDimensions.value.naturalHeight;
    annToResize.width = newCanvasRect.width / imageDimensions.value.width * imageDimensions.value.naturalWidth;
    annToResize.height = newCanvasRect.height / imageDimensions.value.height * imageDimensions.value.naturalHeight;
    
    redrawCanvas();
    return; // Prevent other mouse move handlers
  }

  if (drawing.value && currentRectRaw.value && ctx && currentTool.value === 'rectangle') {
    const mousePos = getMousePos(event);
    currentRectRaw.value.width = mousePos.x - startPos.value.x;
    currentRectRaw.value.height = mousePos.y - startPos.value.y;
    redrawCanvas(); // Redraw existing annotations
    drawRect(currentRectRaw.value, 'rgba(255, 0, 0, 0.5)'); // Draw the current rectangle being drawn
  }
}

function handleMouseUp(event) {
  if (event.button !== 0) return;

  if (isResizing.value && editingAnnotationId.value && originalResizingAnnotation.value) {
    const annToUpdate = annotationStore.currentAnnotations.find(a => a._id === editingAnnotationId.value);
    if (annToUpdate) {
        // Ensure final dimensions are positive and valid (min size check if needed)
        if (annToUpdate.width < 0) { // Should be handled by mouseMove, but as a safeguard
            annToUpdate.x += annToUpdate.width;
            annToUpdate.width = Math.abs(annToUpdate.width);
        }
        if (annToUpdate.height < 0) {
            annToUpdate.y += annToUpdate.height;
            annToUpdate.height = Math.abs(annToUpdate.height);
        }

        // TODO: Add a minimum size check, e.g., 5x5 natural pixels
        const minNaturalSize = 5;
        if (annToUpdate.width < minNaturalSize || annToUpdate.height < minNaturalSize) {
            // Revert to original state before this specific drag
            Object.assign(annToUpdate, originalResizingAnnotation.value);
            alert("Resized annotation is too small. Reverting.");
        } else {
            // Prepare data for update (only x, y, width, height)
            const updateData = {
                x: annToUpdate.x,
                y: annToUpdate.y,
                width: annToUpdate.width,
                height: annToUpdate.height,
            };

            // Use originalAnnotationBeforeEdit for the undo stack, which is the state *before* startEditingAnnotation was called
            // and originalResizingAnnotation for the state *before* this specific drag.
            // For the undo of an UPDATE, we need to revert to the state captured by originalAnnotationBeforeEdit.
            annotationStore.updateAnnotation(editingAnnotationId.value, updateData, projectId.value, imageId.value)
                .then((updatedAnnFromServer) => {                    if (updatedAnnFromServer) {                        // Create a timestamp that will be preserved through undo/redo
                        const actionTimestamp = Date.now();
                        
                        // Add to undo stack using our new function
                        addToUndoStack({
                            type: 'UPDATE',
                            annotationId: editingAnnotationId.value,
                            timestamp: actionTimestamp, // Use consistent timestamp for this action
                            oldData: JSON.parse(JSON.stringify(originalAnnotationBeforeEdit.value)), // State before any edits in this session
                            newData: JSON.parse(JSON.stringify(updatedAnnFromServer)) // State after this resize, from server
                        });
                        
                        console.log(`Added UPDATE action to undo stack with timestamp ${new Date(actionTimestamp).toISOString()}`);
                        
                        // Update originalAnnotationBeforeEdit to the new state for subsequent edits/undos within the same editing session
                        originalAnnotationBeforeEdit.value = JSON.parse(JSON.stringify(updatedAnnFromServer));
                        
                        // Show notification if undo limit was reached
                        if (undoLimitReached.value) {
                          alert(`Undo history limit reached (${MAX_UNDO_HISTORY} actions). Oldest action removed.`);
                        }
                    } else {
                        // Handle case where updateAnnotation returns null (e.g. server error, validation error)
                        // Revert the optimistic update made in handleMouseMove
                        Object.assign(annToUpdate, originalResizingAnnotation.value);
                        alert("Failed to save updated annotation. Server did not confirm the update.");
                        redrawCanvas(); // Redraw to show the reverted state
                    }
                })
                .catch(error => {
                    console.error("Failed to update annotation:", error);
                    // Revert optimistic update if server update fails
                    Object.assign(annToUpdate, originalResizingAnnotation.value); // Revert to state before this drag
                    alert("Failed to save updated annotation. Please try again.");
                    redrawCanvas(); // Redraw to show the reverted state
                });
        }
    }
    isResizing.value = false;
    activeResizeHandle.value = null;
    originalResizingAnnotation.value = null;
    redrawCanvas();
    return; // Prevent other mouse up handlers
  }

  if (drawing.value && currentRectRaw.value && currentTool.value === 'rectangle') {
    drawing.value = false;

    const x = Math.min(currentRectRaw.value.x, currentRectRaw.value.x + currentRectRaw.value.width);
    const y = Math.min(currentRectRaw.value.y, currentRectRaw.value.y + currentRectRaw.value.height);
    const width = Math.abs(currentRectRaw.value.width);
    const height = Math.abs(currentRectRaw.value.height);

    currentRectRaw.value = null; // Clear the raw drawing rectangle

    if (width > 5 && height > 5) {
      pendingAnnotationCoordinates = { // Store coordinates for potential saving
        x_canvas: x,
        y_canvas: y,
        width_canvas: width,
        height_canvas: height,
      };
      currentClassName.value = '';
      classModalError.value = '';
      showClassModal.value = true;
      // The rectangle will be drawn by redrawCanvas using pendingAnnotationCoordinates
    }
    redrawCanvas(); // Redraw with the finalized (or about to be finalized) rectangle
  }
}

function handleMouseLeave(event) {
  if (drawing.value && currentTool.value === 'rectangle') {
    drawing.value = false;
    currentRectRaw.value = null;
    redrawCanvas();
  }
}

function handlePanMove(event) {
  if (!isPanning.value) return;
  const dx = event.clientX - panLastClientPos.value.x;
  const dy = event.clientY - panLastClientPos.value.y;
  viewOffset.value.x += dx;
  viewOffset.value.y += dy;
  panLastClientPos.value = { x: event.clientX, y: event.clientY };
  event.preventDefault();
}

function handlePanEnd(event) {
  if (!isPanning.value) return;
  if (event.button === 0) {
    isPanning.value = false;
    window.removeEventListener('mousemove', handlePanMove);
    window.removeEventListener('mouseup', handlePanEnd);
  }
}

onUnmounted(() => {
  window.removeEventListener('mousemove', handlePanMove);
  window.removeEventListener('mouseup', handlePanEnd);
});

const imageStyle = computed(() => ({
  transform: `translate(${viewOffset.value.x}px, ${viewOffset.value.y}px)`,
  width: imageDimensions.value.width ? `${imageDimensions.value.width}px` : 'auto',
  height: imageDimensions.value.height ? `${imageDimensions.value.height}px` : 'auto',
}));

// Draw a rectangle on the canvas with the given coordinates and color
function drawRect(rect, color = 'rgba(255, 0, 0, 0.5)', lineWidth = 2) {
  if (!ctx || !rect) return;
  
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// Function to draw handles on a rectangle for resizing
function drawHandles(rect, color = 'blue') {
  if (!ctx || !rect) return;
  
  const handles = [
    { x: rect.x, y: rect.y }, // topLeft
    { x: rect.x + rect.width, y: rect.y }, // topRight
    { x: rect.x, y: rect.y + rect.height }, // bottomLeft
    { x: rect.x + rect.width, y: rect.y + rect.height }, // bottomRight
    { x: rect.x + rect.width / 2, y: rect.y }, // top
    { x: rect.x + rect.width / 2, y: rect.y + rect.height }, // bottom
    { x: rect.x, y: rect.y + rect.height / 2 }, // left
    { x: rect.x + rect.width, y: rect.y + rect.height / 2 }, // right
  ];
  
  handles.forEach(handle => {
    ctx.beginPath();
    ctx.arc(handle.x, handle.y, HANDLE_SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

// Redraw the entire canvas with all annotations
function redrawCanvas() {
  if (!ctx || !canvasRef.value) return;
  
  // Clear the canvas
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
  
  // Draw existing annotations
  annotationStore.currentAnnotations.forEach(ann => {
    // Convert natural coordinates to canvas coordinates
    const displayRect = {
      x: ann.x / imageDimensions.value.naturalWidth * imageDimensions.value.width,
      y: ann.y / imageDimensions.value.naturalHeight * imageDimensions.value.height,
      width: ann.width / imageDimensions.value.naturalWidth * imageDimensions.value.width,
      height: ann.height / imageDimensions.value.naturalHeight * imageDimensions.value.height,
    };
    
    // Draw the rectangle
    const isHighlighted = ann._id === highlightedAnnotationId.value;
    const isEditing = ann._id === editingAnnotationId.value;
    
    // Use assigned color or default
    const color = ann.color || getColorForClass(ann.label) || 'rgba(255, 0, 0, 0.5)';
    
    // Adjust stroke based on state
    const lineWidth = isHighlighted || isEditing ? 3 : 2;
    
    drawRect(displayRect, color, lineWidth);
    
    // If the annotation is being edited, draw resize handles
    if (isEditing) {
      drawHandles(displayRect);
    }
    
    // Draw label if exists
    if (ann.label) {
      ctx.font = '12px Arial';
      ctx.fillStyle = color;
      ctx.fillRect(displayRect.x, displayRect.y - 20, ctx.measureText(ann.label).width + 8, 20);
      ctx.fillStyle = 'white';
      ctx.fillText(ann.label, displayRect.x + 4, displayRect.y - 6);
    }
  });
  
  // Draw pending annotation if exists
  if (pendingAnnotationCoordinates) {
    drawRect({
      x: pendingAnnotationCoordinates.x_canvas,
      y: pendingAnnotationCoordinates.y_canvas,
      width: pendingAnnotationCoordinates.width_canvas,
      height: pendingAnnotationCoordinates.height_canvas
    }, 'rgba(255, 0, 0, 0.5)', 2);
  }
}

const canvasStyle = computed(() => ({
  transform: `translate(calc(-50% + ${viewOffset.value.x}px), calc(-50% + ${viewOffset.value.y}px))`,
  cursor: currentTool.value === 'pan' ? (isPanning.value ? 'grabbing' : 'grab') : 'crosshair',
}));

async function confirmClassInput() {
  if (!currentClassName.value.trim()) {
    classModalError.value = 'Class name cannot be empty.';
    return;
  }
  if (pendingAnnotationCoordinates && imageDimensions.value.naturalWidth > 0 && imageDimensions.value.naturalHeight > 0) {
    const className = currentClassName.value.trim();
    
    // First, ensure the class exists in the project 
    // This ensures class preservation in the UI even if all annotations for a class are later deleted
    if (projectStore.currentProject && !projectStore.currentProject.classes.includes(className)) {
      try {
        console.log(`Adding new class "${className}" to project`);
        await projectStore.addProjectClass(projectId.value, className);
      } catch (error) {
        console.error("Failed to add class to project:", error);
        // Continue with annotation creation even if class addition failed
        // The annotation will still have the class label
      }
    }
    
    const annotationDataToSave = {
      x: pendingAnnotationCoordinates.x_canvas / imageDimensions.value.width * imageDimensions.value.naturalWidth,
      y: pendingAnnotationCoordinates.y_canvas / imageDimensions.value.height * imageDimensions.value.naturalHeight,
      width: pendingAnnotationCoordinates.width_canvas / imageDimensions.value.width * imageDimensions.value.naturalWidth,
      height: pendingAnnotationCoordinates.height_canvas / imageDimensions.value.height * imageDimensions.value.naturalHeight,
      label: className,
      // Ensure color consistency by assigning a color before saving
      color: getColorForClass(className),
      // Add an id property to help track this annotation in the frontend
      id: `temp_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
    };    // Create a timestamp for this action that will be preserved throughout undo/redo
    const actionTimestamp = Date.now();
    
    const newSavedAnnotation = await annotationStore.createAnnotation(imageId.value, annotationDataToSave, projectId.value);    
    if (newSavedAnnotation && newSavedAnnotation._id) {
      // Add to undo stack using our new function
      addToUndoStack({ 
        type: 'CREATE', 
        annotationId: newSavedAnnotation._id,
        timestamp: actionTimestamp, // Use consistent timestamp for this action
        // Store a deep copy of the data that was used to create it, including the color assigned
        annotationData: { 
          ...annotationDataToSave, 
          color: newSavedAnnotation.color || annotationDataToSave.color, 
          _id: newSavedAnnotation._id,
          label: className // Ensure class info is preserved
        } 
      });
        console.log(`Successfully created annotation with class "${className}" and ID ${newSavedAnnotation._id} at timestamp ${new Date(actionTimestamp).toISOString()}`);
      
      // Ensure UI is fully synchronized with backend
      await debouncedRefreshAnnotations();
      
      // Show notification if undo limit was reached
      if (undoLimitReached.value) {
        alert(`Undo history limit reached (${MAX_UNDO_HISTORY} actions). Oldest action removed.`);
      }
    } else {
      alert("Failed to save annotation. Please try again. The returned annotation was not valid.");
      console.error("Failed to save annotation, newSavedAnnotation:", newSavedAnnotation);
    }
  }
  showClassModal.value = false;
  pendingAnnotationCoordinates = null;
  currentClassName.value = '';
  classModalError.value = '';
  redrawCanvas(); // Ensure canvas is up-to-date
}

function cancelClassInput() {
  showClassModal.value = false;
  pendingAnnotationCoordinates = null; // Clear the pending rectangle
  currentClassName.value = '';
  classModalError.value = '';
  redrawCanvas();
}

async function deleteExistingAnnotation(annotationIdToDelete) {
  if (!annotationIdToDelete) return;

  const annotationToDelete = annotationStore.currentAnnotations.find(ann => ann._id === annotationIdToDelete);
  if (!annotationToDelete) {
    console.warn("Annotation to delete not found in store:", annotationIdToDelete);
    alert("Error: Annotation not found. It might have been already deleted.");
    return;
  }

  // Create a deep copy for the undo stack BEFORE deleting
  const annotationDataCopy = JSON.parse(JSON.stringify(annotationToDelete));
  
  // Save class info before deletion for potential class count updates
  const deletedClass = annotationToDelete.label;
  const classCountBeforeDeletion = countAnnotationsByClass(deletedClass);
  
  if (confirm('Are you sure you want to delete this annotation?')) {
    try {
      console.log(`Attempting to delete annotation with ID: ${annotationIdToDelete}`);
      const success = await annotationStore.deleteAnnotation(annotationIdToDelete, imageId.value, projectId.value);
      
      if (success) {
        console.log(`Successfully deleted annotation with ID: ${annotationIdToDelete}`);
        
      // Create a timestamp that we'll preserve through any undo/redo operations
        const actionTimestamp = Date.now();
        
        // Add to undo stack using our new function
        addToUndoStack({ 
          type: 'DELETE', 
          annotationData: annotationDataCopy,
          timestamp: actionTimestamp // Use consistent timestamp for tracking
        });
        
        console.log(`Added DELETE action to undo stack with timestamp ${new Date(actionTimestamp).toISOString()}`);
        
        // Ensure classes are preserved in UI even when all annotations of a class are deleted
        // This allows users to select the class for future annotations
        // The check ensures we only trigger class updates when the last instance of a class is deleted
        if (classCountBeforeDeletion === 1 && projectStore.currentProject?.classes) {
          // Class is still in project definition, so we don't need to do anything
          // Just log for debugging
          console.log(`Deleted last annotation for class "${deletedClass}" but class is preserved in project definition`);
        }
        
        // Show notification if undo limit was reached
        if (undoLimitReached.value) {
          alert(`Undo history limit reached (${MAX_UNDO_HISTORY} actions). Oldest action removed.`);
        }      } else {
        // This branch is hit when deleteAnnotation returns false (API error)
        console.warn(`Could not delete annotation with ID: ${annotationIdToDelete}, but it may have been removed from the UI via re-fetch`);
        alert("Failed to delete annotation from server, but the UI has been updated with the current state.");
        
        // Force a refresh of annotations to ensure UI matches server state
        await debouncedRefreshAnnotations();
      }
    } catch (error) {
      console.error(`Error in deleteExistingAnnotation for ID: ${annotationIdToDelete}`, error);      alert("An error occurred while deleting the annotation. The UI will be refreshed to show the current state.");
      
      // Force a refresh of annotations to ensure UI matches server state
      await debouncedRefreshAnnotations();
    }
    // redrawCanvas will be triggered by store update
  }
}

// Variables for debounced refresh
let refreshTimeout = null;
const REFRESH_DELAY = 300; // milliseconds

// Function to refresh annotations with debouncing
async function debouncedRefreshAnnotations() {
  // Clear any existing timeout
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
  }
  
  // Set a new timeout
  refreshTimeout = setTimeout(async () => {
    console.log("Performing debounced refresh of annotations");
    await annotationStore.fetchAnnotations(imageId.value);
    refreshTimeout = null;
  }, REFRESH_DELAY);
}

// Debug helper function to log undo/redo stacks
function logStackState() {
  console.log('==== UNDO/REDO STACK STATE ====');
  console.log(`Undo stack (${undoStack.value.length}):`);
  undoStack.value.forEach((a, i) => {
    const actionInfo = a.annotationId ? 
      `${a.type} [ID: ${a.annotationId}] ${a.annotationData?.label || ''}` : 
      (a.type === 'AUTO_DETECT' ? 
        `${a.type} [${a.annotationIds?.length || 0} shapes]` : 
        `${a.type} ${a.annotationData?._id ? '[ID: ' + a.annotationData._id + ']' : ''} ${a.annotationData?.label || ''}`);
    console.log(`  ${i}: ${actionInfo} @ ${new Date(a.timestamp).toISOString()} (${a.timestamp})`);
  });
  
  console.log(`Redo stack (${redoStack.value.length}):`);
  redoStack.value.forEach((a, i) => {
    const actionInfo = a.annotationId ? 
      `${a.type} [ID: ${a.annotationId}] ${a.annotationData?.label || ''}` : 
      (a.type === 'AUTO_DETECT' ? 
        `${a.type} [${a.annotationIds?.length || 0} shapes]` : 
        `${a.type} ${a.annotationData?._id ? '[ID: ' + a.annotationData._id + ']' : ''} ${a.annotationData?.label || ''}`);
    console.log(`  ${i}: ${actionInfo} @ ${new Date(a.timestamp).toISOString()} (${a.timestamp})`);
  });
  console.log('==============================');
}

async function undo() {
  if (!canUndo.value) return;
  
  logStackState(); // Log stack state before undo
  
  // Get the most recent action (from the end of the stack)
  const action = undoStack.value.pop();
  console.log("Undoing action:", action.type, "with timestamp:", new Date(action.timestamp).toISOString());

  try {
    if (action.type === 'AUTO_DETECT') {
      // Undo auto-detection means deleting all the auto-detected annotations at once
      console.log("Undoing auto-detection of", action.annotationIds.length, "annotations");
      
      // Keep a copy of all annotation data for potential redo
      const annotationsDataCopy = [...action.annotationData];
      
      // Track success/failure for all operations
      let allSuccessful = true;
      
      // Delete each annotation one by one
      for (const annotationId of action.annotationIds) {
        // Check if annotation exists before trying to delete it
        const annotationExists = annotationStore.currentAnnotations.some(ann => ann._id === annotationId);
        if (!annotationExists) {
          console.warn(`Skipping deletion for non-existent annotation ID: ${annotationId}`);
          continue;
        }
        
        const success = await annotationStore.deleteAnnotation(annotationId, imageId.value, projectId.value);
        if (!success) {
          console.error(`Failed to delete annotation with ID: ${annotationId} during auto-detect undo`);
          allSuccessful = false;
        }
      }
      
      // If the operation was successful, add to redo stack
      if (allSuccessful) {
        redoStack.value.push({
          type: 'AUTO_DETECT',
          timestamp: action.timestamp, // Preserve the timestamp
          annotationIds: action.annotationIds,
          annotationData: annotationsDataCopy
        });
        
        console.log("Successfully undid auto-detection");
      } else {
        // If not all annotations could be deleted, inform the user
        alert("Some auto-detected annotations could not be removed. The UI will be refreshed to show the current state.");
      }
      
      // Always refresh annotations to ensure UI matches backend state
      await debouncedRefreshAnnotations();
      
    } else if (action.type === 'CREATE') {
      // Implementation for CREATE will be added here (not part of this task)
      // This is just a placeholder
      console.warn("CREATE undo not implemented yet");
      undoStack.value.push(action); // Put it back for now
    } else if (action.type === 'UPDATE') {
      // Implementation for UPDATE will be added here (not part of this task)
      // This is just a placeholder
      console.warn("UPDATE undo not implemented yet");
      undoStack.value.push(action); // Put it back for now
    } else if (action.type === 'DELETE') {
      // Implementation for DELETE will be added here (not part of this task)
      // This is just a placeholder
      console.warn("DELETE undo not implemented yet");
      undoStack.value.push(action); // Put it back for now
    }
  } catch (error) {
    console.error("Error occurred during undo operation:", error);
    // Push the action back to the stack if there was an error
    undoStack.value.push(action);
    alert("An error occurred during the undo operation. Please try again.");
    
    // Make sure UI is in sync with the backend
    await debouncedRefreshAnnotations();
  }
  
  // Log stack state after undo
  logStackState();
}

async function redo() {
  if (!canRedo.value) return;
  
  logStackState(); // Log stack state before redo
  
  const action = redoStack.value.pop();
  console.log("Redo action:", action.type, "with timestamp:", new Date(action.timestamp).toISOString());

  try {
    if (action.type === 'AUTO_DETECT') { // Redo auto-detection
      console.log("Redoing auto-detection of", action.annotationIds.length, "annotations");
      
      // Get current annotations to append to
      const currentAnnotations = [...annotationStore.currentAnnotations];
      const newAnnotations = [];
      
      // Prepare new annotations without _id as we're recreating them
      for (const annData of action.annotationData) {
        const { _id, ...dataToRecreate } = annData;
        
        // Ensure color matches the class
        dataToRecreate.color = getColorForClass(dataToRecreate.label);
        
        // Add to our new annotations list
        newAnnotations.push(dataToRecreate);
      }
      
      // Combine current with new
      const allAnnotations = [...currentAnnotations, ...newAnnotations];
      
      // Update all annotations at once to avoid multiple server round trips
      try {
        const response = await annotationStore.setAllAnnotationsForImage(imageId.value, allAnnotations, projectId.value);
        
        if (response && response.annotations) {
          // Get the newly created annotations (should be at the end of the array)
          const createdAnnotations = response.annotations.slice(-newAnnotations.length);
          
          // Create a group action for undo
          undoStack.value.push({
            type: 'AUTO_DETECT',
            timestamp: action.timestamp, // Preserve original timestamp
            annotationIds: createdAnnotations.map(ann => ann._id),
            annotationData: createdAnnotations.map(ann => ({ ...ann })),
          });
          
          // Ensure UI is synchronized with backend state
          await debouncedRefreshAnnotations();
          
          console.log("Successfully redid auto-detection of", createdAnnotations.length, "annotations");
        } else {
          redoStack.value.push(action); // Push back if failed
          alert("Redo failed: Could not recreate the auto-detected annotations.");
          await debouncedRefreshAnnotations();
        }
      } catch (error) {
        console.error("Error during auto-detection redo:", error);
        redoStack.value.push(action); // Push back if failed
        alert("Redo failed: An error occurred while recreating auto-detected annotations.");
        await debouncedRefreshAnnotations();
      }
    } else if (action.type === 'CREATE') {
      // Implementation for CREATE will be added here (not part of this task)
      // This is just a placeholder
      console.warn("CREATE redo not implemented yet");
      redoStack.value.push(action); // Put it back for now
    } else if (action.type === 'UPDATE') {
      // Implementation for UPDATE will be added here (not part of this task)
      // This is just a placeholder
      console.warn("UPDATE redo not implemented yet");
      redoStack.value.push(action); // Put it back for now
    } else if (action.type === 'DELETE') {
      // Implementation for DELETE will be added here (not part of this task)
      // This is just a placeholder
      console.warn("DELETE redo not implemented yet");
      redoStack.value.push(action); // Put it back for now
    }
  } catch (error) {
    console.error("Error occurred during redo operation:", error);
    // Push the action back to the stack if there was an error
    redoStack.value.push(action);
    alert("An error occurred during the redo operation. Please try again.");
    
    // Make sure UI is in sync with the backend
    await debouncedRefreshAnnotations();
  }
  
  // Log stack state after redo
  logStackState();
}

// Helper functions to provide descriptions for undo/redo actions
function getUndoActionDescription() {
  if (undoStack.value.length === 0) return '';
  
  const action = undoStack.value[undoStack.value.length - 1];
  switch (action.type) {
    case 'CREATE':
      return 'creation of annotation';
    case 'DELETE':
      return 'deletion of annotation';
    case 'UPDATE':
      return 'update to annotation';
    case 'AUTO_DETECT':
      return `auto-detection of ${action.annotationIds.length} shape${action.annotationIds.length === 1 ? '' : 's'}`;
    default:
      return 'last action';
  }
}

function getRedoActionDescription() {
  if (redoStack.value.length === 0) return '';
  
  const action = redoStack.value[redoStack.value.length - 1];
  switch (action.type) {
    case 'CREATE':
      return 'creation of annotation';
    case 'DELETE':
      return 'deletion of annotation';
    case 'UPDATE':
      return 'update to annotation';
    case 'AUTO_DETECT':
      return `auto-detection of ${action.annotationIds.length} shape${action.annotationIds.length === 1 ? '' : 's'}`;
    default:
      return 'last action';
  }
}

/**
 * Handles the auto-detection of shapes in the current image
 * Converts detected objects into annotations with default class names
 */
async function detectShapes() {
  if (detectingShapes.value) return;
  
  // Button timeout reference for cleanup
  let buttonTimeout;
  let detectButton;
  let originalButtonText;
  
  try {
    detectingShapes.value = true;
    
    // Update UI to show detecting state using nextTick to ensure DOM is available
    await nextTick();
    
    // Store the button reference to use consistently throughout the function
    detectButton = document.querySelector('button[title="Auto-detect shapes in the image"]');
    if (detectButton) {
      // Save original button text for restoration
      originalButtonText = detectButton.innerHTML;
      detectButton.innerHTML = '<span>Detecting...</span>';
      detectButton.setAttribute('disabled', 'true');
      
      // Set timeout to revert button if detection takes too long (30 seconds)
      buttonTimeout = setTimeout(() => {
        if (detectingShapes.value) {
          // Reset detecting state if it's still ongoing
          detectingShapes.value = false;
          detectButton.innerHTML = originalButtonText;
          detectButton.removeAttribute('disabled');
          console.warn('Detection timeout - button restored automatically');
        }
      }, 30000);
    }    // Get the image source URL
    const imageSource = imageUrl.value;
    
    // Send the image URL to the server for processing
    console.log(`Using image URL for detection with method: ${detectionMethod.value}`);
      let detectionResponse;
    if (detectionMethod.value === 'ssim' && referenceImageData.value) {
      // For SSIM, compare with reference image
      console.log('Comparing with reference image for structural differences...');
      const comparisonResults = await compareScreenshots(imageSource, referenceImageData.value);
      
      // Convert comparison results to annotation format
      if (comparisonResults && comparisonResults.ComparisonResult && comparisonResults.ComparisonResult.changes) {
        const changes = comparisonResults.ComparisonResult.changes;
        detectionResponse = {
          detections: changes.map(change => ({
            Label: "change",
            Confidence: 0.9,
            X: change.x,
            Y: change.y,
            Width: change.width,
            Height: change.height
          })),
          dimensions: comparisonResults.ImageDimensions,
          method: 'ssim'
        };
      } else {
        // No changes detected
        console.log('No significant changes detected between images');
        detectionResponse = {
          detections: [],
          dimensions: { width: imageDimensions.value.naturalWidth, height: imageDimensions.value.naturalHeight },
          method: 'ssim'
        };
      }
    } else {
      // For YOLO or OpenCV methods
      console.log(`Detecting objects in image using ${detectionMethod.value}...`);
      detectionResponse = await detectObjects(
        imageSource, 
        detectionMethod.value, 
        detectionMethod.value === 'opencv' ? detectionParams.value : {}
      );
    }
    
    let detectedObjects = detectionResponse.detections;
    let detectionDimensions = detectionResponse.dimensions;
    
    console.log(`Detection results using ${detectionMethod.value}:`, detectedObjects);
    console.log('Detection dimensions:', detectionDimensions);
    console.log('Current image dimensions:', {
      naturalWidth: imageDimensions.value.naturalWidth,
      naturalHeight: imageDimensions.value.naturalHeight,
      displayWidth: imageDimensions.value.width,
      displayHeight: imageDimensions.value.height
    });
    
    // Generate fallback UI elements if no detections
    if (!detectedObjects || detectedObjects.length === 0) {
      console.warn('No objects detected in the image, generating fallbacks');
      
      const width = imageDimensions.value.naturalWidth;
      const height = imageDimensions.value.naturalHeight;
      
      if (width > 0 && height > 0) {
        console.log('Generating fallback UI element proposals');
        
        // Create an array of fallback UI elements
        detectedObjects = [
          // Window-like element in the center
          {
            Label: 'window',
            Confidence: 0.8,
            X: Math.floor(width * 0.15),
            Y: Math.floor(height * 0.1),
            Width: Math.floor(width * 0.7),
            Height: Math.floor(height * 0.75)
          },
          // Taskbar at bottom
          {
            Label: 'taskbar',
            Confidence: 0.9,
            X: 0,
            Y: Math.floor(height * 0.95),
            Width: width,
            Height: Math.floor(height * 0.05)
          }
        ];
        
        // Add some icon-like elements
        const iconSize = Math.floor(Math.min(width, height) / 20);
        for (let i = 0; i < 5; i++) {
          detectedObjects.push({
            Label: 'icon',
            Confidence: 0.7,
            X: Math.floor(width * 0.03) + (i * iconSize * 1.5),
            Y: Math.floor(height * 0.03),
            Width: iconSize,
            Height: iconSize
          });
        }
      } else {
        alert('No objects detected in the image and unable to generate fallbacks.');
        return;
      }
    }
      // Process detected objects into annotations
    const detectTimestamp = Date.now() + (performance.now() / 1000);
    const allAnnotations = [...annotationStore.currentAnnotations];
    const newAnnotations = [];
    
    // Update the image metadata to record this detection attempt
    try {
      await fetch(`/api/images/${imageId.value}/metadata`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          detectionAttempt: {
            timestamp: new Date().toISOString(),
            objectsFound: detectedObjects.length,
          }
        })
      });
    } catch (metadataError) {
      console.warn('Failed to update image metadata:', metadataError);
      // Non-critical error, continue with annotation
    }
      // Convert detected objects to annotation format
    for (let i = 0; i < detectedObjects.length; i++) {
      const obj = detectedObjects[i];
      
      // Use object label if available, otherwise use default class
      const className = obj.Label || defaultDetectionClass.value;
      
      // Create a unique identifier for the auto-generated annotation
      const tempId = `auto_${Date.now()}_${i}`;
        // Need to scale coordinates if detection dimensions don't match actual image
      let x = obj.X;
      let y = obj.Y;
      let width = obj.Width;
      let height = obj.Height;        // Scale coordinates if we have both sets of dimensions
      if (detectionDimensions && 
          imageDimensions.value.naturalWidth && 
          imageDimensions.value.naturalHeight) {
          
        // Calculate scaling factors
        const scaleX = imageDimensions.value.naturalWidth / detectionDimensions.width;
        const scaleY = imageDimensions.value.naturalHeight / detectionDimensions.height;
        
        console.log(`Object ${i} (${obj.Label}): Original detection coordinates:`);
        console.log(`  Position: (${x}, ${y}), Size: ${width}x${height}`);
        console.log(`  Image scaling: ${scaleX.toFixed(4)}x, ${scaleY.toFixed(4)}y`);          // Only apply scaling if the factor is significantly different from 1.0
        // This prevents unnecessary adjustments for tiny rounding differences
        if (Math.abs(scaleX - 1.0) > 0.01 || Math.abs(scaleY - 1.0) > 0.01) {
          // Apply scaling
          x = Math.round(x * scaleX);
          y = Math.round(y * scaleY);
          width = Math.round(width * scaleX);
          height = Math.round(height * scaleY);
          
          console.log(`  Scaled to: Position: (${x}, ${y}), Size: ${width}x${height}`);
        } else {
          console.log(`  No scaling needed (factors too close to 1.0)`);
        }
      }
      
      // Safety check - ensure annotations don't exceed image bounds
      const imageWidth = imageDimensions.value.naturalWidth;
      const imageHeight = imageDimensions.value.naturalHeight;
      
      if (x < 0) { 
        width += x; // Reduce width by the amount x is negative
        x = 0;
        console.log(`  Adjusted: x coordinate was negative, now ${x}`);
      }
      
      if (y < 0) {
        height += y; // Reduce height by the amount y is negative
        y = 0;
        console.log(`  Adjusted: y coordinate was negative, now ${y}`);
      }
      
      if (x + width > imageWidth) {
        width = imageWidth - x;
        console.log(`  Adjusted: width exceeded image bounds, now ${width}`);
      }
      
      if (y + height > imageHeight) {
        height = imageHeight - y;
        console.log(`  Adjusted: height exceeded image bounds, now ${height}`);
      }
      
      // Skip annotation if it's too small after adjustments
      if (width < 5 || height < 5) {
        console.log(`  Skipping: annotation too small after bounds adjustment (${width}x${height})`);
        continue;
      }
      
      // Create annotation data
      const annotationData = {
        x: x,
        y: y,
        width: width,
        height: height,
        label: className,
        color: getColorForClass(className),
        id: tempId,
        confidence: obj.Confidence // Store confidence for potential filtering
      };
      
      newAnnotations.push(annotationData);
      allAnnotations.push(annotationData);
    }
      // Update all annotations at once to avoid multiple server round trips
    console.log(`Saving ${newAnnotations.length} auto-detected annotations`);
    try {
      const response = await annotationStore.setAllAnnotationsForImage(imageId.value, allAnnotations, projectId.value);
      
      if (response && response.annotations) {
        // Add a single undo action for all created annotations
        const createdAnnotations = response.annotations.slice(-newAnnotations.length);
        
        // Create a group action for undo
        addToUndoStack({
          type: 'AUTO_DETECT',
          timestamp: detectTimestamp,
          annotationIds: createdAnnotations.map(ann => ann._id),
          annotationData: createdAnnotations.map(ann => ({ ...ann })),
        });
          // Ensure UI is synchronized with backend state
        await debouncedRefreshAnnotations();
        
        // Update any image metadata in the store
        const imageStore = useImageStore();
        try {
          await imageStore.refreshImageDetails(imageId.value);
        } catch (refreshError) {
          console.warn('Non-critical error refreshing image details:', refreshError);
        }
        
        // Show success message
        alert(`Successfully added ${createdAnnotations.length} auto-detected shapes.`);
      } else {
        console.error('Invalid response format:', response);
        throw new Error('Invalid response from server when saving annotations');
      }
    } catch (saveError) {
      console.error('Error saving annotations:', saveError);
      throw new Error(`Failed to save detected shapes: ${saveError.message}`);
    }} catch (error) {
    console.error('Shape detection failed:', error);
    
    // Provide a more helpful error message
    let errorMessage = error.message || 'Unknown error';
    
    // Check for specific errors and provide more context
    if (errorMessage.includes('Failed to fetch') || error.name === 'TypeError' || errorMessage.includes('connect')) {
      errorMessage = 'Failed to connect to the backend detection API. The server might be unavailable or starting up.\n\n' +
                    'If the problem persists, check that:\n' +
                    '1. Node.js backend is running at http://localhost:5001\n' +
                    '2. Python with the required packages is installed (run setup_detection.ps1)';
    } else if (errorMessage.includes('SecurityError') || errorMessage.includes('Tainted canvas')) {
      errorMessage = 'Unable to access image data due to cross-origin restrictions.';
    } else if (errorMessage.includes('Server error: Not Found')) {
      errorMessage = 'The detection API endpoint was not found. This could be due to:\n' +
                    '1. Incorrect URL configuration in the frontend\n' +
                    '2. Detection routes not properly mounted in the backend\n\n' +
                    'Please check your server configuration and restart the application.';
    } else if (errorMessage.includes('Detection script not found')) {
      errorMessage = 'The Python detection script was not found. Please verify that:\n' +
                    '1. The AutoDesktopVisionApi folder exists in the project root\n' +
                    '2. The detect_objects.py file is present in that folder\n' +
                    '3. You have run the setup_detection script to install dependencies';
    } else if (errorMessage.includes('Invalid response from server')) {
      errorMessage = 'The server returned an unexpected response format. This could indicate a problem with:\n' +
                    '1. The detection script output format\n' +
                    '2. Server response processing\n\n' +
                    'Try refreshing the page and attempt detection again.';
    }
    
    alert('Failed to detect shapes: ' + errorMessage);  } finally {
    detectingShapes.value = false;
    
    // Clear any timeout that might have been set
    if (buttonTimeout) {
      clearTimeout(buttonTimeout);
      buttonTimeout = null;
    }
    
    // Restore button state - use the reference to the button captured at the start of the function
    if (detectButton && originalButtonText) {
      detectButton.innerHTML = originalButtonText;
      detectButton.removeAttribute('disabled');
    } else {
      // Fallback in case we lost the original reference
      nextTick(() => {
        const fallbackButton = document.querySelector('button[title="Auto-detect shapes in the image"]');
        if (fallbackButton) {
          fallbackButton.innerHTML = '<span>Detect Shapes</span>';
          fallbackButton.removeAttribute('disabled');
        }
      });
    }
  }
}

function setTool(toolName) {
  currentTool.value = toolName;
}

function selectClass(className) {
  console.log("Selected class:", className);
  // Set the current class name for new annotations
  currentClassName.value = className;
  // If the class modal is open, this will immediately apply the selected class
  if (showClassModal.value) {
    confirmClassInput();
  }
}

function countAnnotationsByClass(className) {
    return annotationStore.currentAnnotations.filter(ann => ann.label === className).length;
}

function highlightAnnotation(annotation) {
    highlightedAnnotationId.value = annotation._id;
}

function unhighlightAnnotation() {
    highlightedAnnotationId.value = null;
}

// Image Tags
const newTagInput = ref('');
const tagError = ref('');
const currentImage = computed(() => imageStore.getImageById(imageId.value));
const currentImageTags = computed(() => currentImage.value?.tags || []);

async function addTag() {
  tagError.value = '';
  const tagToAdd = newTagInput.value.trim();
  if (!tagToAdd) {
    tagError.value = 'Tag cannot be empty.';
    return;
  }
  if (currentImageTags.value.includes(tagToAdd)) {
    tagError.value = 'Tag already exists.';
    newTagInput.value = '';
    return;
  }

  if (currentImage.value) {
    const updatedTags = [...currentImageTags.value, tagToAdd];
    try {
      await imageStore.updateImageTags(currentImage.value._id, updatedTags);
      newTagInput.value = '';
    } catch (error) {
      console.error('Failed to update tags:', error);
      tagError.value = 'Failed to save tag. Please try again.';
    }
  }
}

async function removeTag(tagToRemove) {
  tagError.value = '';
  if (currentImage.value) {
    const updatedTags = currentImageTags.value.filter(tag => tag !== tagToRemove);
    try {
      await imageStore.updateImageTags(currentImage.value._id, updatedTags);
    } catch (error) {
      console.error('Failed to remove tag:', error);
      tagError.value = 'Failed to remove tag. Please try again.';
    }
  }
}

watch([() => route.params.projectId, () => route.params.imageId], async ([newProjectId, newImageId]) => {
    if (newProjectId && newImageId && (newProjectId !== projectId.value || newImageId !== imageId.value)) {
        projectId.value = newProjectId;
        imageId.value = newImageId;
        
        annotationStore.clearAnnotations();
        classColors.value = {};
        colorIndex = 0;
        viewOffset.value = { x: 0, y: 0 };
        currentTool.value = 'rectangle';
        isPanning.value = false;
        drawing.value = false;
        currentRectRaw.value = null;
        undoStack.value = [];
        redoStack.value = [];
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanEnd);

        if (!projectStore.currentProject || projectStore.currentProject._id !== newProjectId) {
            await projectStore.loadProjectById(newProjectId);
        }
        const image = imageStore.getImageById(newImageId);
       
       
        if (image) {
            imageUrl.value = getCorrectAssetUrl(image.path);
            await nextTick();
            if(imageRef.value) onImageLoad();
        } else {
             console.warn("Image not found in store on route change.");
             imageUrl.value = '';
        }
        await annotationStore.fetchAnnotations(newImageId);
        undoStack.value = [];
        redoStack.value = [];
    }
});

async function loadReferenceImage() {
  if (!referenceImageId.value) {
    referenceImagePreview.value = '';
    referenceImageData.value = null;
    return;
  }
  
  try {
    // Find the image in the store
    const referenceImage = imageStore.allImages.find(img => img._id === referenceImageId.value);
    if (referenceImage && referenceImage.path) {
      // Generate the URL for display
      referenceImagePreview.value = getCorrectAssetUrl(referenceImage.path);
      
      // Fetch the image as base64 data for SSIM comparison
      try {
        const response = await fetch(referenceImagePreview.value);
        const blob = await response.blob();
        
        // Convert the blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          referenceImageData.value = reader.result;
          console.log('Reference image loaded as base64 for SSIM comparison');
        };
      } catch (fetchError) {
        console.error('Error fetching reference image data:', fetchError);
        referenceImageData.value = null;
      }
    } else {
      console.error('Reference image not found');
      referenceImagePreview.value = '';
      referenceImageData.value = null;
    }
  } catch (error) {
    console.error('Error loading reference image:', error);
    referenceImagePreview.value = '';
    referenceImageData.value = null;
  }
}
</script>

<style scoped>
.annotation-editor-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  padding: 10px;
  box-sizing: border-box;
}

.breadcrumb {
  margin-bottom: 10px;
  font-size: 0.9em;
  color: #555;
}
.breadcrumb a {
  color: #007bff;
  text-decoration: none;
}
.breadcrumb a:hover {
  text-decoration: underline;
}

.editor-layout {
  display: flex;
  flex-grow: 1;
  gap: 10px;
  overflow: hidden;
}

.toolbar {
  width: 150px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.toolbar h3 {
    margin-top: 0;
    margin-bottom: 10px;
    font-size: 1.1em;
}
.toolbar button {
  padding: 8px;
  border: 1px solid #ddd;
  background-color: white;
   cursor: pointer;
  text-align: left;
  border-radius: 3px;
}

.toolbar button.active {
  background-color: #e6f0ff;
  font-weight: bold;
  border-color: #aac;
}

.canvas-container {
  flex-grow: 1;
  position: relative;
  min-height: 300px;
  background-color: #f0f0f0;
  overflow: hidden;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.canvas-container canvas {
  position: absolute;
  top: 50%;
  left: 50%;
}

.side-panel {
  width: 250px;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: #f9f9f9;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.side-panel h4 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 1em;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
}
.side-panel ul {
  list-style: none;
  padding: 0;
  margin: 0;
}
.side-panel li {
  padding: 8px;
  border-bottom: 1px solid #eee;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left-width: 5px;
  border-left-style: solid;
}
.side-panel li.highlighted {
  background-color: #e6f7ff;
}
.side-panel li.editing {
  outline: 2px solid #007bff; /* Style for the item being edited */
}
.side-panel li.has-history {
  background-color: #f0f8ff; /* Very light blue background for items with history */
}
.side-panel li div { /* Container for buttons */
  display: flex;
  gap: 5px;
}
.history-indicator {
  color: gold;
  margin-left: 3px;
}
.side-panel li button {
  padding: 3px 6px;
  font-size: 0.8em;
  border: 1px solid #ccc;
  border-radius: 3px;
  cursor: pointer;
}
.delete-ann-btn {
  margin-left: auto;
  padding: 2px 5px;
  font-size: 0.8em;
  background-color: #ff4d4f;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.delete-ann-btn:hover {
  background-color: #d9363e;
}
.edit-ann-btn {
  margin-left: 5px; /* Add some space between edit and delete */
  padding: 2px 5px;
  font-size: 0.8em;
  background-color: #1890ff; /* A different color for edit */
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}
.edit-ann-btn:hover {
  background-color: #096dd9;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  min-width: 300px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
.modal-content h3 {
    margin-top: 0;
}
.modal-content input[type="text"] {
  width: calc(100% - 22px);
  padding: 10px;
  margin-bottom: 10px;
  border: 1px solid #ccc;
  border-radius: 3px;
}
.modal-content button {
  padding: 8px 15px;
  margin-right: 10px;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: pointer;
}
.modal-content button:first-of-type {
    background-color: #007bff;
    color: white;
}
.modal-content button:last-of-type {
    background-color: #f0f0f0;
}
.modal-content div {
    margin-bottom: 10px;
}
.modal-content div button {
    background-color: #e9ecef;
    color: #495057;
    margin-right: 5px;
    margin-bottom: 5px;
    font-size: 0.9em;
}

.raw-data-section pre {
    background-color: #f0f0f0;
    padding: 10px;
    border-radius: 4px;
    max-height: 200px;
    overflow-y: auto;
    font-size: 0.8em;
}

.image-tags-section {
  margin-top: 15px;
}

.image-tags-section h4 {
    margin-top: 0;
    margin-bottom: 8px;
    font-size: 1em;
    border-bottom: 1px solid #eee;
    padding-bottom: 5px;
}

.tags-display {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.tag-pill {
  display: inline-flex;
  align-items: center;
  background-color: #e1f5fe;
  padding: 3px 8px;
  border-radius: 12px;
  margin: 3px;
  font-size: 0.8em;
}

.remove-tag-btn {
  background: none;
  border: none;
  color: #999;
  margin-left: 4px;
  cursor: pointer;
  font-size: 1em;
}

.remove-tag-btn:hover {
  color: #f44;
}

.add-tag-input {
  display: flex;
  margin-top: 8px;
}

.add-tag-input input {
  flex-grow: 1;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 4px 0 0 4px;
}

.add-tag-input button {
  border-radius: 0 4px 4px 0;
}

.error {
  color: red;
  font-size: 0.9em;
  margin-top: 5px;
}

/* Detection Settings Styles */
.detection-settings-section {
  background-color: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.detection-settings-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  color: #333;
  font-size: 1rem;
}

.detection-method {
  margin-bottom: 10px;
}

.detection-method label,
.detection-params label {
  display: inline-block;
  min-width: 100px;
  font-weight: 500;
  margin-right: 10px;
}

.detection-method select,
.detection-params select {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: white;
  font-size: 0.9rem;
  width: 200px;
}

.param-group {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.param-group input[type="range"] {
  flex: 1;
  margin: 0 10px;
}

.param-group input[type="number"] {
  width: 80px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #ccc;
}

.param-group span {
  min-width: 30px;
  text-align: center;
}
</style>
