<template>
  <div class="annotation-editor-view">
    <div class="breadcrumb">
      <router-link :to="{ name: 'Dashboard' }">Dashboard</router-link> >
      <router-link :to="{ name: 'ProjectDetail', params: { projectId: projectId } }">Project: {{ projectStore.currentProject?.name }}</router-link> >
      <span>Annotate: {{ imageStore.getImageById(imageId)?.name }}</span>
    </div>

    <div class="editor-layout">
      <div class="toolbar">
        <h3>Tools</h3>
        <button @click="setTool('rectangle')" :class="{ active: currentTool === 'rectangle' }">Rectangle</button>
        <button @click="setTool('pan')" :class="{ active: currentTool === 'pan' }">Pan</button>
        <button @click="undo" :disabled="!canUndo">Undo</button>
        <button @click="redo" :disabled="!canRedo">Redo</button>
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
        </div>

        <div class="layers-section">
          <h4>Layers (Annotations)</h4>
          <ul v-if="annotationStore.currentAnnotations.length">
            <li v-for="(ann, index) in annotationStore.currentAnnotations" :key="ann._id"
                @mouseover="highlightAnnotation(ann)" @mouseleave="unhighlightAnnotation"
                :class="{ 'highlighted': highlightedAnnotationId === ann._id }"
                :style="{ borderLeftColor: getColorForClass(ann.label) }">
              <span>{{ ann.label }} #{{ index + 1 }}</span>
              <button @click="deleteExistingAnnotation(ann._id)" class="delete-ann-btn">Delete</button>
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
import { ref, onMounted, computed, watch, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useProjectStore } from '../store/projectStore';
import { useImageStore } from '../store/imageStore';
import { useAnnotationStore } from '../store/annotationStore';

const route = useRoute();
const router = useRouter();

const projectStore = useProjectStore();
const imageStore = useImageStore();
const annotationStore = useAnnotationStore();

const projectId = ref(route.params.projectId);
const imageId = ref(route.params.imageId);

const imageRef = ref(null);
const canvasRef = ref(null);
const canvasContainerRef = ref(null);
let ctx = null;

const imageUrl = ref('');
const imageDimensions = ref({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

const currentTool = ref('rectangle'); // 'rectangle', 'pan'
const drawing = ref(false);
const startPos = ref({ x: 0, y: 0 });
const currentRect = ref(null); // { x, y, width, height }

const viewOffset = ref({ x: 0, y: 0 });
const isPanning = ref(false);
const panLastClientPos = ref({ x: 0, y: 0 });

const showClassModal = ref(false);
const currentClassName = ref('');
const classModalError = ref('');
let pendingAnnotation = null;

const highlightedAnnotationId = ref(null);
const showRawData = ref(false);

// Undo/Redo state
const undoStack = ref([]);
const redoStack = ref([]);

const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);

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

  const container = canvasContainerRef.value;
  if (container) {
    const resizeObserver = new ResizeObserver(onImageLoad);
    resizeObserver.observe(container);
    onUnmounted(() => resizeObserver.disconnect());
  }

  undoStack.value = [];
  redoStack.value = [];
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
  redrawCanvas();
}, { deep: true });

function getMousePos(event) {
  const rect = canvasRef.value.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function handleMouseDown(event) {
  if (event.button !== 0) return;

  if (currentTool.value === 'pan') {
    isPanning.value = true;
    panLastClientPos.value = { x: event.clientX, y: event.clientY };
    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanEnd);
    event.preventDefault();
  } else if (currentTool.value === 'rectangle' && ctx) {
    drawing.value = true;
    startPos.value = getMousePos(event);
    currentRect.value = { 
        x: startPos.value.x, 
        y: startPos.value.y, 
        width: 0, 
        height: 0 
    };
    event.preventDefault();
  }
}

function handleMouseMove(event) {
  if (drawing.value && currentRect.value && ctx && currentTool.value === 'rectangle') {
    const mousePos = getMousePos(event);
    currentRect.value.width = mousePos.x - startPos.value.x;
    currentRect.value.height = mousePos.y - startPos.value.y;
    redrawCanvas();
    drawRect(currentRect.value, 'rgba(255, 0, 0, 0.5)');
  }
}

function handleMouseUp(event) {
  if (event.button !== 0) return;

  if (drawing.value && currentRect.value && currentTool.value === 'rectangle') {
    drawing.value = false;

    const x = Math.min(currentRect.value.x, currentRect.value.x + currentRect.value.width);
    const y = Math.min(currentRect.value.y, currentRect.value.y + currentRect.value.height);
    const width = Math.abs(currentRect.value.width);
    const height = Math.abs(currentRect.value.height);

    if (width > 5 && height > 5) {
      pendingAnnotation = {
        x_canvas: x,
        y_canvas: y,
        width_canvas: width,
        height_canvas: height,
      };
      currentClassName.value = '';
      classModalError.value = '';
      showClassModal.value = true;
    }
    currentRect.value = null;
    redrawCanvas();
  }
}

function handleMouseLeave(event) {
  if (drawing.value && currentTool.value === 'rectangle') {
    drawing.value = false;
    currentRect.value = null;
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

const canvasStyle = computed(() => ({
  transform: `translate(calc(-50% + ${viewOffset.value.x}px), calc(-50% + ${viewOffset.value.y}px))`,
  cursor: currentTool.value === 'pan' ? (isPanning.value ? 'grabbing' : 'grab') : 'crosshair',
}));

async function confirmClassInput() {
  if (!currentClassName.value.trim()) {
    classModalError.value = 'Class name cannot be empty.';
    return;
  }
  if (pendingAnnotation && imageDimensions.value.naturalWidth > 0 && imageDimensions.value.naturalHeight > 0) {
    const annotationData = {
      x: pendingAnnotation.x_canvas / imageDimensions.value.width * imageDimensions.value.naturalWidth,
      y: pendingAnnotation.y_canvas / imageDimensions.value.height * imageDimensions.value.naturalHeight,
      width: pendingAnnotation.width_canvas / imageDimensions.value.width * imageDimensions.value.naturalWidth,
      height: pendingAnnotation.height_canvas / imageDimensions.value.height * imageDimensions.value.naturalHeight,
      label: currentClassName.value.trim(),
      color: getColorForClass(currentClassName.value.trim()),
    };

    const newSavedAnnotation = await annotationStore.createAnnotation(imageId.value, annotationData, projectId.value);

    if (newSavedAnnotation) {
      const className = newSavedAnnotation.label;
      if (projectStore.currentProject && !projectStore.currentProject.classes.includes(className)) {
        try {
          await projectStore.addProjectClass(projectId.value, className);
        } catch (error) {
          console.error("Failed to add class to project:", error);
        }
      }
    } else {
      alert("Failed to save annotation. Please try again.");
    }
  }
  showClassModal.value = false;
  pendingAnnotation = null;
  currentClassName.value = '';
  classModalError.value = '';
}

function cancelClassInput() {
  showClassModal.value = false;
  pendingAnnotation = null;
  currentClassName.value = '';
  classModalError.value = '';
  redrawCanvas();
}

async function deleteExistingAnnotation(annotationIdToDelete) {
  if (!annotationIdToDelete) return;

  const annotationToDelete = annotationStore.currentAnnotations.find(ann => ann._id === annotationIdToDelete);
  if (!annotationToDelete) {
    console.warn("Annotation to delete not found in store");
    return;
  }

  if (confirm('Are you sure you want to delete this annotation?')) {
    const success = await annotationStore.deleteAnnotation(annotationIdToDelete, imageId.value, projectId.value);
    if (!success) {
      alert("Failed to delete annotation from server.");
    }
  }
}

async function undo() {
  if (!canUndo.value) return;
  console.warn("Undo for persisted actions is complex and not fully implemented in this simplified version.");
}

async function redo() {
  if (!canRedo.value) return;
  console.warn("Redo for persisted actions is complex and not fully implemented in this simplified version.");
}

function redrawCanvas() {
  if (!ctx || !canvasRef.value || !imageDimensions.value.width) return;
  ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);

  annotationStore.currentAnnotations.forEach(ann => {
    if (!ann.label || !ann._id) return;
    const color = getColorForClass(ann.label);
    const displayRect = {
        x: ann.x / imageDimensions.value.naturalWidth * imageDimensions.value.width,
        y: ann.y / imageDimensions.value.naturalHeight * imageDimensions.value.height,
        width: ann.width / imageDimensions.value.naturalWidth * imageDimensions.value.width,
        height: ann.height / imageDimensions.value.naturalHeight * imageDimensions.value.height,
    };
    drawRect(displayRect, color, ann.label);
    if (ann._id === highlightedAnnotationId.value) {
        drawRect(displayRect, 'rgba(255, 255, 0, 0.7)', null, true);
    }
  });
}

function drawRect(rect, color = 'red', label = null, isHighlight = false) {
  if (!ctx || !rect) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = isHighlight ? 4 : 2;
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

  if (label && !isHighlight) {
    ctx.fillStyle = color;
    ctx.fillRect(rect.x, rect.y - 14, ctx.measureText(label).width + 4, 14);
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText(label, rect.x + 2, rect.y - 4);
  }
}

function setTool(toolName) {
  currentTool.value = toolName;
}

function selectClass(className) {
  console.log("Selected class:", className);
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
        currentRect.value = null;
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
  background-color: #007bff;
  color: white;
  border-color: #007bff;
}
.toolbar button:disabled {
    background-color: #eee;
    color: #999;
    cursor: not-allowed;
}

.canvas-container {
  flex-grow: 1;
  position: relative;
  border: 1px solid #ccc;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  background-color: #e9e9e9;
}

.canvas-container img {
  display: block;
  object-fit: contain;
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
  padding: 6px 8px;
  margin-bottom: 4px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid #eee;
  background-color: #fff;
  font-size: 0.9em;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-left-width: 5px;
  border-left-style: solid;
}
.side-panel li:hover {
  background-color: #f0f0f0;
}
.side-panel li.highlighted {
    background-color: #fffacd;
    border-color: #ffd700;
}

.delete-ann-btn {
    padding: 3px 6px;
    font-size: 0.8em;
    background-color: #ff6b6b;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
}
.delete-ann-btn:hover {
    background-color: #e05252;
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
  background-color: #007bff;
  color: white;
  padding: 4px 10px;
  border-radius: 15px;
  font-size: 0.85em;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.remove-tag-btn {
  background: none;
  border: none;
  color: white;
  margin-left: 6px;
  cursor: pointer;
  font-size: 1.2em;
  padding: 0;
  line-height: 1;
  font-weight: bold;
}

.remove-tag-btn:hover {
  opacity: 0.8;
}

.add-tag-input {
  display: flex;
  gap: 8px;
  margin-bottom: 5px;
}

.add-tag-input input[type="text"] {
  flex-grow: 1;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 0.9em;
}

.add-tag-input button {
  padding: 8px 12px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.9em;
}

.add-tag-input button:hover {
  background-color: #218838;
}

.error {
  color: red;
  font-size: 0.9em;
  margin-top: 5px;
}
</style>
