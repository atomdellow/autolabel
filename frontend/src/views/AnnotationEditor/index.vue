<template>  <div class="annotation-editor-view">
    <BreadcrumbNav>
      <router-link :to="{ name: 'Dashboard' }">Dashboard</router-link> &gt;
      <router-link :to="{ name: 'ProjectDetail', params: { projectId: projectId } }">Project: {{ projectStore.currentProject?.name }}</router-link> &gt;
      <span>Annotate: {{ imageStore.getImageById(imageId)?.name }}</span>
    </BreadcrumbNav>    
    <div class="editor-layout">
      <Toolbar 
        :annotation-draw="annotationDraw"
        :zoom-pan="zoomPan"
        :annotation-history="annotationHistory"
        :annotation-store="annotationStore"
        :detection="detection"
      />
      <AnnotationCanvas 
        ref="canvasComponent"
        :image-url="imageUrl"
        :zoom-pan="zoomPan"
        :annotation-draw="annotationDraw"
        :annotation-edit="annotationEdit"
        :canvas-coordinates="canvasCoordinates"
        @image-loaded="onImageLoaded"
        @image-load-error="onImageLoadError"
        @redraw-requested="redrawCanvas"
      />

      <div class="side-panel">
        <ClassesPanel 
          :project-store="projectStore"
          :annotation-selection="annotationSelection"
          :get-color-for-class="getColorForClass"
          @class-selected="selectClass"
        />
        
        <LayersPanel 
          :annotation-store="annotationStore"
          :annotation-selection="annotationSelection"
          :annotation-edit="annotationEdit"
          :annotation-history="annotationHistory"
          :get-color-for-class="getColorForClass"
          @highlight-annotation="highlightAnnotation"
          @unhighlight-annotation="unhighlightAnnotation"
          @delete-annotation="deleteExistingAnnotation"
          @delete-selected-annotations="deleteSelectedAnnotations"
        />
          <RawDataPanel 
          :annotation-store="annotationStore"
          :image-store="imageStore"
          :image-id="imageId"
          @import-complete="onImportComplete"
        />
          <TagsPanel 
          :tag-management="tagManagement"
          :image-id="imageId"
        />
        
        <DetectionPanel 
          :detection="detection"
          :image-store="imageStore"
        />
      </div>
    </div>

    <ClassModal 
      :is-visible="showClassModal"
      :initial-class-name="currentClassName"
      :project-store="projectStore"
      :get-color-for-class="getColorForClass"
      @confirm="confirmClassInput"
      @cancel="cancelClassInput"
    />
  </div>
</template>

<script setup>
// Import necessary functions
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'vue-toastification';
import './styles/index.css';

// Import our stores
import { useProjectStore } from '../../store/projectStore';
import { useImageStore } from '../../store/imageStore';
import { useAnnotationStore } from '../../store/annotationStore';
import { getImageUrl } from '../../services/imageService';
import { isValidImageUrl, extractFilename, isValidPath, constructImageUrl } from '../../utils/imageUtils';

// Import components
import Toolbar from './components/Toolbar.vue';
import AnnotationCanvas from './components/AnnotationCanvas.vue';
import ClassesPanel from './components/ClassesPanel.vue';
import LayersPanel from './components/LayersPanel.vue';
import RawDataPanel from './components/RawDataPanel.vue';
import TagsPanel from './components/TagsPanel.vue';
import DetectionPanel from './components/DetectionPanel.vue';
import ClassModal from './components/ClassModal.vue';
import BreadcrumbNav from '../../components/BreadcrumbNav.vue';

// Import composables
import { useAnnotationDraw } from './composables/useAnnotationDraw';
import { useAnnotationEdit } from './composables/useAnnotationEdit';
import { useAnnotationHistory } from './composables/useAnnotationHistory';
import { useAnnotationSelection } from './composables/useAnnotationSelection';
import { useCanvasCoordinates } from './composables/useCanvasCoordinates';
import { useDetection } from './composables/useDetection';
import { useTagManagement } from './composables/useTagManagement';
import { useZoomPan } from './composables/useZoomPan';

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

// Canvas refs and state
const canvasComponent = ref(null);
const imageUrl = ref('');

// Function to redraw the canvas (will be passed to other composables)
function redrawCanvas() {
  // Check if we have initialized the composables yet
  if (!annotationDraw) {
    console.warn('Cannot redraw: annotationDraw not initialized yet');
    return;
  }
  
  // Only proceed if we have a context
  if (!annotationDraw?.canvasContext?.value) {
    console.warn('Cannot redraw: canvas context is null');
    // Retry after a short delay if context is null
    setTimeout(() => {
      if (annotationDraw?.canvasContext?.value) {
        console.log('Canvas context now available, redrawing...');
        redrawCanvas();
      }
    }, 100);
    return;
  }
    try {
    // Get canvas and its context
    const canvas = annotationDraw.canvasContext.value.canvas;
    const ctx = annotationDraw.canvasContext.value;
    
    // Check if canvas is valid
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      console.warn('Cannot redraw: invalid canvas dimensions');
      return;
    }
    
    // Force a repaint/reflow to ensure canvas is ready
    void canvas.offsetHeight;
    
    // Clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw current annotations from the store
    // This will be called once per redraw, preventing infinite recursion
    const annotations = annotationStore.currentAnnotations;
      
    // Also check if we have valid zoom level
    const currentZoomLevel = zoomPan?.zoomLevel?.value || 1;
    const currentPanOffset = zoomPan?.panOffset?.value || { x: 0, y: 0 };
    console.log(`Redrawing canvas with zoom level: ${currentZoomLevel}x, pan offset: (${currentPanOffset.x}, ${currentPanOffset.y})`);
    
    // Apply a CSS transform to the canvas element itself to ensure zoom/pan is visually applied
    if (canvasComponent.value?.canvasRef?.value) {
      // Force browser to recognize the transform change
      void canvasComponent.value.canvasRef.value.offsetHeight;
    }
  
  if (annotations && annotations.length > 0) {
      // Draw each annotation
      annotations.forEach(annotation => {
        // Set style based on selection state
        const isSelected = annotationSelection.selectedAnnotationIds.value.includes(annotation._id);
        const isHighlighted = annotationSelection.highlightedAnnotationId.value === annotation._id;
        const isHovered = annotationEdit.hoveredAnnotationId?.value === annotation._id;
        
        // Different styles for different states
        ctx.lineWidth = isSelected || isHighlighted ? 3 : 2;
        ctx.strokeStyle = isSelected ? '#00FF00' : 
                          isHighlighted ? '#FFFF00' : 
                          isHovered ? '#00AAFF' : 
                          getColorForClass(annotation.label);
        
        // Get annotation original coordinates
        const x = annotation.x;
        const y = annotation.y;
        const width = annotation.width;
        const height = annotation.height;
        
        // Draw the rectangle - annotation coordinates are already in image space
        // Canvas transform handles the conversion to screen space
        ctx.strokeRect(x, y, width, height);
        
        // Draw label if present
        if (annotation.label) {
          ctx.font = '12px Arial';
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fillText(annotation.label, x, y - 5);
        }
      });
    }
    
    // Draw any in-progress drawing rectangle
    if (annotationDraw.drawing.value && annotationDraw.currentRectRaw.value) {
      ctx.strokeStyle = '#00AAFF';
      ctx.lineWidth = 2;
      ctx.strokeRect(
        annotationDraw.currentRectRaw.value.x,
        annotationDraw.currentRectRaw.value.y,
        annotationDraw.currentRectRaw.value.width,
        annotationDraw.currentRectRaw.value.height
      );
    }
  } catch (error) {
    console.error('Error in redrawCanvas:', error);
  }
}

// Initialize canvas coordinates functionality
const canvasCoordinates = useCanvasCoordinates();

// Initialize zoom & pan functionality
const zoomPan = useZoomPan(canvasCoordinates, redrawCanvas);

// Initialize annotation drawing functionality
const annotationDraw = useAnnotationDraw(annotationStore, canvasCoordinates, zoomPan, redrawCanvas);

// Initialize annotation editing functionality
const annotationEdit = useAnnotationEdit(annotationStore, canvasCoordinates, zoomPan, redrawCanvas);

// Initialize annotation history functionality
const annotationHistory = useAnnotationHistory(projectId, imageId, annotationStore, toast);

// Initialize annotation selection functionality
const annotationSelection = useAnnotationSelection(projectId, imageId, annotationStore, toast, redrawCanvas);

// Initialize detection functionality
const detection = useDetection(
  projectId, 
  imageId, 
  annotationStore, 
  imageStore, 
  toast, 
  canvasCoordinates,
  annotationHistory
);

// Initialize tag management functionality
const tagManagement = useTagManagement(imageStore);

// Class assignment functionality
const showClassModal = ref(false);
const currentClassName = ref('');
const pendingAnnotationId = ref(null);

// Utils 
function getColorForClass(className) {
  if (!className) return '#cccccc'; // Default color for no class
  
  // Generate a deterministic color based on the class name
  let hash = 0;
  for (let i = 0; i < className.length; i++) {
    hash = className.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Convert to a hex color
  let color = '#';
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xFF;
    color += ('00' + value.toString(16)).substr(-2);
  }
  
  return color;
}

// Methods for the class modal
function selectClass(className) {
  currentClassName.value = className;
  if (!showClassModal.value) {
    if (pendingAnnotationId.value) {
      // Apply class to pending annotation
      annotationStore.updateAnnotationLabel(pendingAnnotationId.value, className);
      pendingAnnotationId.value = null;
    } else if (annotationSelection.selectedAnnotationIds.length > 0) {
      // Apply class to all selected annotations
      for (const id of annotationSelection.selectedAnnotationIds) {
        annotationStore.updateAnnotationLabel(id, className);
      }
    }
  }
}

function showClassModalForAnnotation(annotationId) {
  pendingAnnotationId.value = annotationId;
  showClassModal.value = true;
}

function confirmClassInput(className) {
  if (pendingAnnotationId.value) {
    // Apply to pending annotation
    annotationStore.updateAnnotationLabel(pendingAnnotationId.value, className);
    pendingAnnotationId.value = null;
  } else if (annotationSelection.selectedAnnotationIds.length > 0) {
    // Apply to selected annotations
    for (const id of annotationSelection.selectedAnnotationIds) {
      annotationStore.updateAnnotationLabel(id, className);
    }
  }
    // Add class to project if it's new
  if (projectStore.currentProject && 
      !projectStore.currentProject.classes?.includes(className)) {
    projectStore.addProjectClass(projectId.value, className);
  }
  
  showClassModal.value = false;
  currentClassName.value = '';
}

function cancelClassInput() {
  showClassModal.value = false;
  currentClassName.value = '';
  pendingAnnotationId.value = null;
}

// Event handlers
function onImageLoaded(data) {
  console.log('Image loaded with dimensions:', data.imageElement.naturalWidth, 'x', data.imageElement.naturalHeight);
  
  // Set the natural dimensions for coordinate transformations
  canvasCoordinates.setNaturalDimensions({
    width: data.imageElement.naturalWidth,
    height: data.imageElement.naturalHeight
  });
  
  // Set the canvas dimensions to match the natural image size
  if (data.canvasElement) {
    data.canvasElement.width = data.imageElement.naturalWidth;
    data.canvasElement.height = data.imageElement.naturalHeight;
    console.log('Canvas dimensions set to:', data.canvasElement.width, 'x', data.canvasElement.height);
  }
  
  // Reset zoom and pan
  zoomPan.resetZoom();
  
  // Set the canvas context for drawing and editing
  const ctx = data.canvasElement.getContext('2d');
  annotationDraw.setCanvasContext(ctx);
  annotationEdit.setCanvasContext(ctx);
  
  // Initially redraw the canvas
  redrawCanvas();
}

function onImageLoadError(error) {
  console.error('Failed to load image in parent component:', error);
  toast.error(`Failed to load image: ${error.url}`);
  
  // Try to recover by using an alternative URL format if possible
  const currentImage = imageStore.getImageById(imageId.value);
  
  if (currentImage) {
    // Try using a different URL format based on available data
    let alternativeUrl = '';
    
    if (currentImage.filename) {
      console.log('Attempting to load image with alternate URL format based on filename');
      alternativeUrl = `/uploads/images/${currentImage.filename}`;
    } else if (currentImage.name) {
      console.log('Attempting to load image with alternate URL format based on name');
      alternativeUrl = `/uploads/images/${currentImage.name}`;
    }
    
    if (alternativeUrl && alternativeUrl !== currentImage.url) {
      console.log('Retrying with alternative URL:', alternativeUrl);
      const fullAlternativeUrl = getImageUrl(alternativeUrl);
      
      if (fullAlternativeUrl && fullAlternativeUrl !== error.url) {
        console.log('Setting alternative image URL:', fullAlternativeUrl);
        imageUrl.value = fullAlternativeUrl;
        return; // Don't show dialog yet, give the alternative URL a chance
      }
    }
  }
  
  // If we couldn't recover, ask user what to do
  if (confirm('Image failed to load. Return to project?')) {
    router.push({ name: 'ProjectDetail', params: { projectId: projectId.value } });
  }
}

function highlightAnnotation(annotation) {
  annotationSelection.highlightAnnotation(annotation);
  redrawCanvas();
}

function unhighlightAnnotation() {
  annotationSelection.unhighlightAnnotation();
  redrawCanvas();
}

function deleteExistingAnnotation(annotationId) {
  // Add to undo stack before deletion
  const annotation = annotationStore.getAnnotationById(annotationId);
  if (annotation) {
    annotationHistory.addToUndoStack({
      type: 'DELETE',
      annotationData: { ...annotation }
    });
  }
  
  // Perform deletion
  annotationSelection.deleteExistingAnnotation(annotationId);
}

function deleteSelectedAnnotations() {
  // Add to undo stack before deletion
  const selectedAnnotations = annotationStore.currentAnnotations
    .filter(ann => annotationSelection.selectedAnnotationIds.includes(ann._id))
    .map(ann => ({ ...ann }));
  
  if (selectedAnnotations.length > 0) {
    annotationHistory.addToUndoStack({
      type: 'MULTI_DELETE',
      annotationData: selectedAnnotations
    });
  }
  
  // Perform deletion
  annotationSelection.deleteSelectedAnnotations();
}

// Handle keyboard shortcuts
function handleKeyDown(event) {  // Escape - cancel current action or close modal
  if (event.key === 'Escape') {
    if (showClassModal.value) {
      cancelClassInput();
    } else if (annotationDraw.drawing.value) {
      annotationDraw.cancelDrawing();
    } else if (zoomPan.isPanning.value) {
      zoomPan.endPan();
    } else if (annotationEdit.isDraggingAnnotation.value) {
      annotationEdit.cancelDrag();
    } else if (annotationEdit.isResizing.value) {
      annotationEdit.cancelResize();
    } else if (annotationEdit.isEditing.value) {
      annotationEdit.finishEditing();
    }
  }
  
  // Delete key - delete selected annotation(s)
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (annotationSelection.selectedAnnotationIds.length > 0) {
      if (confirm(`Delete ${annotationSelection.selectedAnnotationIds.length} selected annotation(s)?`)) {
        deleteSelectedAnnotations();
      }
    } else if (annotationEdit.editingAnnotationId.value) {
      const annotation = annotationStore.getAnnotationById(annotationEdit.editingAnnotationId.value);
      
      if (annotation && confirm(`Delete ${annotation.label} annotation?`)) {
        deleteExistingAnnotation(annotation._id);
      }
    }
  }
  
  // Keyboard shortcuts for tools (r=rectangle, p=pan, s=select)
  if (event.key === 'r') {
    annotationDraw.setTool('rectangle');
  } else if (event.key === 'p') {
    annotationDraw.setTool('pan');
  } else if (event.key === 's') {
    annotationDraw.setTool('select');
  }
  
  // Undo/Redo shortcuts
  if (event.ctrlKey || event.metaKey) {
    if (event.key === 'z') {
      if (event.shiftKey) {
        // Ctrl+Shift+Z or Cmd+Shift+Z for Redo
        if (annotationHistory.canRedo.value) {
          event.preventDefault();
          annotationHistory.redo();
        }
      } else {
        // Ctrl+Z or Cmd+Z for Undo
        if (annotationHistory.canUndo.value) {
          event.preventDefault();
          annotationHistory.undo();
        }
      }
    } else if (event.key === 'y') {
      // Ctrl+Y or Cmd+Y for Redo
      if (annotationHistory.canRedo.value) {
        event.preventDefault();
        annotationHistory.redo();
      }
    }
  }
}

// Lifecycle hooks
onMounted(async () => {
  console.log('AnnotationEditorView mounted');
    try {    // Load the project data
    await projectStore.loadProjectById(projectId.value);
    
    // Make sure images are fetched for this project first
    await imageStore.fetchImages(projectId.value);
      // Load the image data
    const loadedImage = await imageStore.loadImage(imageId.value);
    
    if (!loadedImage) {
      console.error('Image not found:', imageId.value);
      toast.error('Image not found. Please check the URL and try again.');
      
      // Redirect back to project after a short delay
      setTimeout(() => {
        router.push({ name: 'ProjectDetail', params: { projectId: projectId.value } });
      }, 3000);
      
      throw new Error('Image not found');    }
    // Load existing annotations
    await annotationStore.fetchAnnotations(imageId.value);
      // Set the image URL
    const currentImage = imageStore.getImageById(imageId.value);
console.log('Current image from store:', currentImage);

if (currentImage) {
  console.log('Image found:', currentImage);
  
  try {
    // Use our utility function to construct the most reliable image URL
    const constructedUrl = constructImageUrl(currentImage);
    
    if (constructedUrl) {
      console.log('Using constructed image URL:', constructedUrl);
      imageUrl.value = getImageUrl(constructedUrl);
    } else {
      // Fallback to legacy approach
      // First, check the direct path field which is the most reliable source
      if (currentImage.path && isValidPath(currentImage.path)) {
        console.log('Using image path directly:', currentImage.path);
        const processedPath = currentImage.path.includes('/uploads/') ? 
          currentImage.path : `/uploads/images/${extractFilename(currentImage.path)}`;
        imageUrl.value = getImageUrl(processedPath);
      } 
      // Next try using the URL if it's safe
      else if (currentImage.url && !currentImage.url.includes('/project/') && !currentImage.url.includes('/annotate')) {
        console.log('Using URL from image record:', currentImage.url);
        imageUrl.value = getImageUrl(currentImage.url);
      }
      // Try filename as fallback
      else if (currentImage.filename) {
        console.log('Using filename as fallback:', currentImage.filename);
        imageUrl.value = getImageUrl(`/uploads/images/${currentImage.filename}`);
      }
      // Last resort: use the name field
      else if (currentImage.name) {
        console.log('Using name as last resort:', currentImage.name);
        imageUrl.value = getImageUrl(`/uploads/images/${currentImage.name}`);
      }
      else {
        throw new Error('No usable image source found in image record');
      }
    }
    
    console.log('Final image URL set to:', imageUrl.value);
  } catch (error) {
    console.error('Error setting image URL:', error);
    toast.error(`Error loading image: ${error.message}`);
    
    // Last attempt - try to use any available property to construct a URL
    if (!imageUrl.value && (currentImage.path || currentImage.filename || currentImage.name)) {
      const sourcePath = currentImage.path || 
                         (currentImage.filename ? `/uploads/images/${currentImage.filename}` : `/uploads/images/${currentImage.name}`);
      console.log('Last resort attempt with path:', sourcePath);
      imageUrl.value = getImageUrl(sourcePath);
    }
  }
      // Load image tags
      tagManagement.initializeTagsForImage(imageId.value);
    } else {
      console.error('Image or image URL not available:', currentImage);
      toast.error('Image data not found. Please check the image ID.');
      setTimeout(() => {
        router.push({ name: 'ProjectDetail', params: { projectId: projectId.value } });
      }, 3000);
      throw new Error('Image URL not available');
    }
    
    // Add event listeners for keyboard shortcuts
    window.addEventListener('keydown', handleKeyDown);
    
    // Initialize the canvas
    nextTick(() => {
      redrawCanvas();
    });
  } catch (error) {
    console.error('Error initializing annotation editor:', error);
    toast.error('Failed to load annotation data. Please try again.');
  }
});

onUnmounted(() => {
  // Remove event listeners
  window.removeEventListener('keydown', handleKeyDown);
});

// Handle annotations import complete
function onImportComplete() {
  // Force a redraw of the canvas to display the new annotations
  redrawCanvas();
  // Update history stack
  annotationHistory.recordHistoryEntry('Imported annotations');
  toast.success('Annotations imported and displayed on canvas');
}

// Export annotations to JSON
function exportAnnotationsToJson() {
  // ...existing code...
}
</script>

<style scoped>
@import './styles/index.css';
</style>
