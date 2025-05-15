# Undo/Redo Fixes Changelog

## Update - May 15, 2025

### Recent Fix
Fixed an issue where annotations were still being undone/redone in the wrong order (oldest first instead of newest first) despite previous attempts to fix the problem.

### Latest Changes

1. **Enhanced Timestamp Generation**
   - Added fractional milliseconds from `performance.now()` to prevent timestamp collisions
   - Modified `addToUndoStack` function to create more precise timestamps

2. **Implemented Explicit Sorting**
   - Added sorting based on timestamps in both `undo` and `redo` functions
   - Ensures newest actions are always processed first regardless of the order they are stored

3. **Improved Debugging Capabilities**
   - Enhanced `logStackState` to show actions sorted by timestamp
   - Added raw timestamp values to logs for better analysis

## Previous Fix

### Root Cause
The problem stemmed from how the backend API works in conjunction with the undo/redo functionality:

1. The backend endpoint (`/annotations/image/:imageId/set`) first deletes all existing annotations and then recreates them. This means that when creating a new annotation, we send all existing annotations plus the new one.

2. This approach led to a synchronization issue between the undo/redo stack and the actual annotations displayed:
   - When annotations were created (e.g., Rectangle 1, Rectangle 2), they were correctly added to the undo stack
   - However, when undoing, the system would incorrectly remove Rectangle 1 (oldest) instead of Rectangle 2 (newest)

### Changes Made

1. **Improved timestamp handling**
   - Created consistent timestamps when adding actions to the undo/redo stacks
   - Preserved these timestamps exactly when moving actions between stacks
   - Enhanced timestamp logging for better debugging

2. **Improved Action Tracking**
   - Added better logging of action details (type, ID, label, timestamp)
   - Fixed how actions are recreated when moving between undo/redo stacks

3. **Enhanced Synchronization**
   - Used `debouncedRefreshAnnotations` consistently to ensure UI is in sync with backend
   - Improved the handling of non-existent annotations during undo/redo operations

4. **Better Error Handling**
   - Added try/catch blocks around undo/redo operations
   - Improved error messages and console logging

## Future Recommendations

To further improve the robustness of the annotation system:

1. Consider modifying the backend API to support individual annotation operations (create, update, delete) instead of replacing all annotations at once.

2. Implement a more robust versioning system for annotations that tracks the entire history of changes.

3. Add snapshot capabilities to capture the complete state at specific points in time to make recovery easier.

4. Consider implementing a transaction-based approach where multiple operations are grouped and can be undone/redone together.
