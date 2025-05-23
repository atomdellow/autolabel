const Annotation = require('../models/Annotation');
const Image = require('../models/Image');
const Project = require('../models/Project'); // To verify project ownership indirectly

// @desc    Set/Replace all annotations for a specific image
// @route   POST /api/annotations/image/:imageId/set
// @access  Private (requires authentication)
const setAnnotationsForImage = async (req, res) => {
    console.log(`[annotationController.js] Enter setAnnotationsForImage - Image ID: ${req.params.imageId}, User ID: ${req.user?._id}, Body keys: ${Object.keys(req.body)}`);
    const { imageId } = req.params;
    const { boxes, imageTags } = req.body; // Expects an array of annotation objects and optional image tags

    if (!Array.isArray(boxes)) {
        return res.status(400).json({ message: 'Annotation data (boxes) must be an array.' });
    }

    try {
        const image = await Image.findById(imageId).populate('project');
        if (!image) {
            console.log(`[annotationController.js] setAnnotationsForImage - Image not found: ${imageId}`);
            return res.status(404).json({ message: 'Image not found' });
        }

        // Check if the logged-in user owns the project the image belongs to
        if (!image.project || image.project.owner.toString() !== req.user._id.toString()) {
            console.log(`[annotationController.js] setAnnotationsForImage - User ${req.user?._id} not authorized for image ${imageId}`);
            return res.status(403).json({ message: 'Not authorized to annotate this image' });
        }

        // 1. Delete existing annotations for this image
        console.log(`[annotationController.js] setAnnotationsForImage - Deleting existing annotations for image ${imageId}`);
        await Annotation.deleteMany({ image: imageId });

        // 2. Create new annotations
        const newAnnotationDocs = [];
        for (const box of boxes) {
            const annotationData = {
                image: imageId,
                project: image.project._id,
                user: req.user._id,
                label: box.label,
                x: box.x,
                y: box.y,
                width: box.width,
                height: box.height,
                id: box.id, // Client-generated ID for the box
                confidence: box.confidence,
                color: box.color, // Expected from client
                layerOrder: box.layerOrder, // Expected from client
                // createdAt and updatedAt will be set by Mongoose
            };
            // Validate required fields for each box
            if (!box.label || box.x === undefined || box.y === undefined || box.width === undefined || box.height === undefined) {
                // Skip this box or return an error. For now, let's be strict.
                return res.status(400).json({ message: `Invalid annotation data for box ID ${box.id || 'unknown'}. Missing required fields.` });
            }
            newAnnotationDocs.push(annotationData);
        }

        const createdAnnotations = await Annotation.insertMany(newAnnotationDocs);
        const annotationIds = createdAnnotations.map(ann => ann._id);

        // 3. Update the Image document
        console.log(`[annotationController.js] setAnnotationsForImage - Updating image ${imageId} with new annotations`);
        image.annotations = annotationIds;
        image.status = annotationIds.length > 0 ? 'Annotated' : 'Unannotated'; // Update status

        if (imageTags && Array.isArray(imageTags)) {
            image.tags = imageTags; // Update image-level tags
        }

        await image.save();

        console.log(`[annotationController.js] setAnnotationsForImage - Successfully set annotations for image ${imageId}. Count: ${createdAnnotations.length}`);
        res.status(200).json({
            message: 'Annotations set successfully',
            image: image, // Send back the updated image document
            annotations: createdAnnotations
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            console.error(`[annotationController.js] setAnnotationsForImage - Validation error for image ${imageId}:`, messages.join('. '));
            return res.status(400).json({ message: messages.join('. ') });
        }
        console.error(`[annotationController.js] setAnnotationsForImage - Error setting annotations for image ${imageId}:`, error);
        res.status(500).json({ message: 'Server error while setting annotations' });
    }
};

// @desc    Get all annotations for a specific image
// @route   GET /api/annotations/image/:imageId
// @access  Private
const getAnnotationsForImage = async (req, res) => {
    console.log(`[annotationController.js] Enter getAnnotationsForImage - Image ID: ${req.params.imageId}, User ID: ${req.user?._id}`);
    const { imageId } = req.params;

    try {
        const image = await Image.findById(imageId).populate('project');
        if (!image) {
            console.log(`[annotationController.js] getAnnotationsForImage - Image not found: ${imageId}`);
            return res.status(404).json({ message: 'Image not found' });
        }

        if (!image.project || image.project.owner.toString() !== req.user._id.toString()) {
            console.log(`[annotationController.js] getAnnotationsForImage - User ${req.user?._id} not authorized for image ${imageId}`);
            return res.status(403).json({ message: 'Not authorized to view these annotations' });
        }

        // Fetch annotations related to this image
        console.log(`[annotationController.js] getAnnotationsForImage - Fetching annotations for image ${imageId}`);
        const annotations = await Annotation.find({ image: imageId }).sort({ layerOrder: 1 }); // Sort by layerOrder or createdAt

        console.log(`[annotationController.js] getAnnotationsForImage - Successfully fetched ${annotations.length} annotations for image ${imageId}`);
        res.json(annotations);
    } catch (error) {
        console.error(`[annotationController.js] getAnnotationsForImage - Error fetching annotations for image ${imageId}:`, error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Image not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error while fetching annotations' });
    }
};


// @desc    Update a single annotation by its ID
// @route   PUT /api/annotations/:annotationId
// @access  Private
const updateAnnotation = async (req, res) => {
    console.log(`[annotationController.js] Enter updateAnnotation - Annotation ID: ${req.params.annotationId}, User ID: ${req.user?._id}, Body keys: ${Object.keys(req.body)}`);
    const { annotationId } = req.params;
    const updates = req.body; // e.g., { label, x, y, width, height, color, layerOrder }

    try {
        const annotation = await Annotation.findById(annotationId).populate({
            path: 'image',
            populate: { path: 'project' }
        });

        if (!annotation) {
            console.log(`[annotationController.js] updateAnnotation - Annotation not found: ${annotationId}`);
            return res.status(404).json({ message: 'Annotation not found' });
        }

        if (!annotation.image || !annotation.image.project || annotation.image.project.owner.toString() !== req.user._id.toString()) {
            console.log(`[annotationController.js] updateAnnotation - User ${req.user?._id} not authorized for annotation ${annotationId}`);
            return res.status(403).json({ message: 'Not authorized to update this annotation' });
        }

        // Update allowed fields
        console.log(`[annotationController.js] updateAnnotation - Updating annotation ${annotationId}`);
        const allowedUpdates = ['label', 'x', 'y', 'width', 'height', 'id', 'confidence', 'color', 'layerOrder'];
        Object.keys(updates).forEach(key => {
            if (allowedUpdates.includes(key)) {
                annotation[key] = updates[key];
            }
        });
        annotation.updatedAt = Date.now();

        const updatedAnnotation = await annotation.save();
        console.log(`[annotationController.js] updateAnnotation - Successfully updated annotation ${annotationId}`);
        res.json(updatedAnnotation);

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            console.error(`[annotationController.js] updateAnnotation - Validation error for annotation ${annotationId}:`, messages.join('. '));
            return res.status(400).json({ message: messages.join('. ') });
        }
        console.error(`[annotationController.js] updateAnnotation - Error updating annotation ${annotationId}:`, error);
        res.status(500).json({ message: 'Server error while updating annotation' });
    }
};

// @desc    Delete a single annotation by its ID
// @route   DELETE /api/annotations/:annotationId
// @access  Private
const deleteAnnotation = async (req, res) => {
    console.log(`[annotationController.js] Enter deleteAnnotation - Annotation ID: ${req.params.annotationId}, User ID: ${req.user?._id}`);
    const { annotationId } = req.params;

    try {
        const annotation = await Annotation.findById(annotationId).populate({
            path: 'image',
            populate: { path: 'project' }
        });

        if (!annotation) {
            console.log(`[annotationController.js] deleteAnnotation - Annotation not found: ${annotationId}`);
            return res.status(404).json({ message: 'Annotation not found' });
        }

        if (!annotation.image || !annotation.image.project || annotation.image.project.owner.toString() !== req.user._id.toString()) {
            console.log(`[annotationController.js] deleteAnnotation - User ${req.user?._id} not authorized for annotation ${annotationId}`);
            return res.status(403).json({ message: 'Not authorized to delete this annotation' });
        }

        const imageId = annotation.image._id;
        console.log(`[annotationController.js] deleteAnnotation - Deleting annotation ${annotationId} for image ${imageId}`);
        await annotation.deleteOne();

        // Remove the annotation reference from the Image document
        console.log(`[annotationController.js] deleteAnnotation - Removing annotation reference from image ${imageId}`);
        await Image.findByIdAndUpdate(imageId, { $pull: { annotations: annotationId } });
        
        // Optionally, update image status if no annotations are left
        const remainingAnnotations = await Annotation.countDocuments({ image: imageId });
        if (remainingAnnotations === 0) {
            await Image.findByIdAndUpdate(imageId, { status: 'Unannotated' });
            console.log(`[annotationController.js] deleteAnnotation - Image ${imageId} status updated to Unannotated`);
        }

        console.log(`[annotationController.js] deleteAnnotation - Successfully deleted annotation ${annotationId}`);
        res.json({ message: 'Annotation deleted successfully' });

    } catch (error) {
        console.error(`[annotationController.js] deleteAnnotation - Error deleting annotation ${annotationId}:`, error);
        res.status(500).json({ message: 'Server error while deleting annotation' });
    }
};

// @desc    Import annotations from JSON for a specific image
// @route   POST /api/annotations/image/:imageId/import
// @access  Private (requires authentication)
const importAnnotationsFromJson = async (req, res) => {
    console.log(`[annotationController.js] Enter importAnnotationsFromJson - Image ID: ${req.params.imageId}, User ID: ${req.user?._id}`);
    const { imageId } = req.params;
    const { annotations, format, mergeStrategy } = req.body;

    if (!annotations || !Array.isArray(annotations)) {
        return res.status(400).json({ message: 'Annotation data must be a valid array.' });
    }

    try {
        // Fetch the image and check authorization
        const image = await Image.findById(imageId).populate('project');
        if (!image) {
            console.log(`[annotationController.js] importAnnotationsFromJson - Image not found: ${imageId}`);
            return res.status(404).json({ message: 'Image not found' });
        }

        // Check if the logged-in user owns the project the image belongs to
        if (!image.project || image.project.owner.toString() !== req.user._id.toString()) {
            console.log(`[annotationController.js] importAnnotationsFromJson - User ${req.user?._id} not authorized for image ${imageId}`);
            return res.status(403).json({ message: 'Not authorized to annotate this image' });
        }

        // Get existing annotations for this image
        const existingAnnotations = await Annotation.find({ image: imageId });

        // Process annotations based on format
        let processedAnnotations = [];
        
        if (format === 'roboflow') {
            // Roboflow format: Convert to application's format
            processedAnnotations = annotations.map(ann => ({
                image: imageId,
                project: image.project._id,
                user: req.user._id,
                label: ann.class || 'Unknown', // Use 'Unknown' if no class is provided
                x: ann.x || 0,
                y: ann.y || 0,
                width: ann.width || 0,
                height: ann.height || 0,
                confidence: ann.confidence || 1.0,
                // Generate a unique ID if not present
                id: ann.id || Math.random().toString(36).substring(2, 15),
                // Use default values for app-specific properties
                color: '#cccccc', // Default color
                layerOrder: 0, // Default layer order
            }));
        } else {
            // Default format (assumed to be our internal format)
            processedAnnotations = annotations.map(ann => ({
                image: imageId,
                project: image.project._id,
                user: req.user._id,
                label: ann.label,
                x: ann.x,
                y: ann.y,
                width: ann.width,
                height: ann.height,
                confidence: ann.confidence || 1.0,
                id: ann.id || Math.random().toString(36).substring(2, 15),
                color: ann.color || '#cccccc',
                layerOrder: ann.layerOrder || 0,
            }));
        }

        let finalAnnotations = [];
        
        // Handle merge strategies
        if (mergeStrategy === 'replace') {
            // Delete all existing annotations
            await Annotation.deleteMany({ image: imageId });
            finalAnnotations = processedAnnotations;
        } else if (mergeStrategy === 'append') {
            // Keep existing annotations and add new ones
            finalAnnotations = [...existingAnnotations.map(ann => ({
                image: ann.image,
                project: ann.project,
                user: ann.user,
                label: ann.label,
                x: ann.x,
                y: ann.y,
                width: ann.width,
                height: ann.height,
                confidence: ann.confidence,
                id: ann.id,
                color: ann.color,
                layerOrder: ann.layerOrder,
            })), ...processedAnnotations];
        } else {
            // Default to 'replace' if not specified
            await Annotation.deleteMany({ image: imageId });
            finalAnnotations = processedAnnotations;
        }

        // Create new annotations
        await Annotation.deleteMany({ image: imageId });
        const createdAnnotations = await Annotation.insertMany(finalAnnotations);
        const annotationIds = createdAnnotations.map(ann => ann._id);

        // Update the Image document
        console.log(`[annotationController.js] importAnnotationsFromJson - Updating image ${imageId} with imported annotations`);
        image.annotations = annotationIds;
        image.status = annotationIds.length > 0 ? 'Annotated' : 'Unannotated';
        await image.save();

        console.log(`[annotationController.js] importAnnotationsFromJson - Successfully imported annotations for image ${imageId}. Count: ${createdAnnotations.length}`);
        res.status(200).json({
            message: 'Annotations imported successfully',
            image: image,
            annotations: createdAnnotations
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            console.error(`[annotationController.js] importAnnotationsFromJson - Validation error for image ${imageId}:`, messages.join('. '));
            return res.status(400).json({ message: messages.join('. ') });
        }
        console.error(`[annotationController.js] importAnnotationsFromJson - Error importing annotations for image ${imageId}:`, error);
        res.status(500).json({ message: 'Server error while importing annotations' });
    }
};

module.exports = {
    setAnnotationsForImage,
    getAnnotationsForImage,
    updateAnnotation,
    deleteAnnotation,
    importAnnotationsFromJson,
};
