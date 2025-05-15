# Undo/Redo Implementation Guide for Annotation Editor

## UPDATE - May 15, 2025: Further Fixes for Action Ordering

Despite previous fixes, issues were still observed with actions being undone in the wrong order. The following enhancements have been implemented:

### 1. Enhanced Timestamp Generation

```javascript
// Enhanced timestamp generation in addToUndoStack
function addToUndoStack(action) {
  // Ensure action has a timestamp - use high precision timestamp to avoid ordering issues
  if (!action.timestamp) {
    action.timestamp = Date.now() + (performance.now() / 1000); // Add fractional milliseconds for more precise ordering
  }
  
  // Add action to the end of the stack (newest actions at the end)
  undoStack.value.push(action);
  // ...rest of function unchanged
}
```

### 2. Explicit Sorting in Undo/Redo Operations

```javascript
// In the undo function
// Sort the stack by timestamp to ensure newest actions are undone first
undoStack.value.sort((a, b) => b.timestamp - a.timestamp);
const action = undoStack.value.pop();

// Similar change in the redo function
redoStack.value.sort((a, b) => b.timestamp - a.timestamp);
const action = redoStack.value.pop();
```

### 3. Improved Stack State Logging

```javascript
function logStackState() {
  // Sort temporarily for logging purposes (doesn't affect the actual stack)
  const sortedUndoStack = [...undoStack.value].sort((a, b) => b.timestamp - a.timestamp);
  sortedUndoStack.forEach((a, i) => {
    // Log with raw timestamp for better debugging
    console.log(`  ${i}: ${actionInfo} @ ${new Date(a.timestamp).toISOString()} (${a.timestamp})`);
  });
  // ...similar changes for redoStack
}
```

---

## Previous Implementation

## Summary of Changes

This guide outlines the essential changes required to fix the undo/redo functionality in the annotation editor. The main issues being addressed are:

1. When creating multiple annotations, previous ones disappear
2. When undoing, actions occur in incorrect order
3. When redoing, the correct action is not being restored
4. Annotations still appear in the UI layer list even when visually removed

## Key Fixes

### 1. Improved Undo Stack Management

The `addToUndoStack` function has been refactored to:

- No longer sort actions by timestamp, instead relying on the natural chronological order as actions are added
- Properly enforce maximum history limit (20 actions) by removing oldest first
- Clear redo stack appropriately when new actions are added
- Provide better logging of added actions

```javascript
function addToUndoStack(action) {
  // Ensure action has a timestamp
  if (!action.timestamp) {
    action.timestamp = Date.now();
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
```

### 2. Consistent UI Sync with Backend

A debounced refresh function ensures that the UI stays in sync with the backend state:

```javascript
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
```

This function is strategically called after each undo/redo operation to ensure the UI reflects the current state.

### 3. Improved Timestamp Preservation

Timestamps are now correctly preserved between undo and redo stacks to maintain proper action ordering:

```javascript
// Example from undo function (CREATE action):
redoStack.value.push({
  type: 'CREATE',
  annotationData: annotationDataCopy,
  timestamp: action.timestamp // Preserve the original timestamp
});

// Example from redo function:
undoStack.value.push({ 
  type: 'CREATE', 
  annotationId: reCreatedAnnotation._id,
  timestamp: action.timestamp, // Preserve the original timestamp
  annotationData: { ... }
});
```

Removing the `|| Date.now()` fallback ensures we don't create new timestamps when transferring actions between stacks.

### 4. Preserving Class and Color Information

Class and color information is now explicitly preserved during undo/redo operations:

```javascript
redoStack.value.push({ 
  type: 'DELETE', 
  timestamp: action.timestamp,
  annotationData: { 
    ...dataToRecreate, 
    _id: newAnnotation._id,
    color: newAnnotation.color || dataToRecreate.color,
    label: className // Ensure class info is preserved 
  } 
});
```

### 5. Better Error Handling

Each undo/redo operation is now wrapped in a try/catch block with proper error handling:

```javascript
try {
  // Undo/redo operations
} catch (error) {
  console.error("Error occurred during operation:", error);
  // Push the action back to the stack if there was an error
  undoStack.value.push(action); // or redoStack.value.push(action);
  alert("An error occurred during the operation. Please try again.");
  
  // Make sure UI is in sync with the backend
  await debouncedRefreshAnnotations();
}
```

### 6. Better Handling of Non-Existent Annotations

Logic has been added to handle cases where annotations no longer exist:

```javascript
// Check if the annotation still exists before trying to delete it
const annotationExists = annotationStore.currentAnnotations.some(ann => ann._id === annotationId);
if (!annotationExists) {
  console.warn(`Cannot undo creation: annotation with ID ${annotationId} no longer exists`);
  // Make sure UI is updated by refreshing annotations from server
  await debouncedRefreshAnnotations();
  return;
}
```

## Implementation Steps

1. Replace the `addToUndoStack` function to remove the timestamp-based sorting
2. Update the `undo` function with improved error handling and data preservation
3. Update the `redo` function with similar improvements to ensure symmetric behavior
4. Add or update the `debouncedRefreshAnnotations` function 
5. Ensure all undo/redo operations use the updated functions

## Testing Recommendations

After implementing these changes, test the following scenarios:

1. Create multiple annotations and verify all remain visible
2. Undo multiple actions to verify they're undone in the correct order (most recent first)
3. Redo multiple actions to verify they're redone in the correct order
4. Verify that the UI layer list correctly reflects the annotations that are visually present
5. Create annotations, undo some, then create a new annotation to ensure the redo stack is properly cleared

These changes should address the observed issues in the undo/redo functionality.
