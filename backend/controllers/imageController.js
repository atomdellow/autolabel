const Image = require('../models/Image');
const Project = require('../models/Project');
const Annotation = require('../models/Annotation'); // Import Annotation model
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const sizeOf = require('image-size'); // Corrected: Use directly, it's synchronous for files

// Promisify fs.unlink for cleaner async/await usage
const unlinkAsync = promisify(fs.unlink);

// @desc    Upload an image to a project
// @route   POST /api/images/project/:projectId
// @access  Private (requires authentication)
const uploadImage = async (req, res) => {
    const { projectId } = req.params;
    const tagsInput = req.body.tags;

    if (!req.files || req.files.length === 0) { // Changed from req.file to req.files
        return res.status(400).json({ message: 'No image files uploaded' });
    }

    let project;
    try {
        project = await Project.findById(projectId);
        if (!project) {
            // If project not found, delete the uploaded files to prevent orphans
            for (const file of req.files) {
                await unlinkAsync(file.path);
            }
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if the logged-in user owns the project
        if (project.owner.toString() !== req.user._id.toString()) {
            for (const file of req.files) {
                await unlinkAsync(file.path);
            }
            return res.status(403).json({ message: 'Not authorized to upload images to this project' });
        }
    } catch (error) {
        console.error('Error finding project or checking ownership:', error);
        // Attempt to delete uploaded files if any error occurs during project validation
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    await unlinkAsync(file.path);
                } catch (fileError) {
                    console.error('Failed to delete orphaned file during project validation error:', fileError);
                }
            }
        }
        return res.status(500).json({ message: 'Server error during project validation' });
    }

    const savedImages = [];
    const errors = [];

    for (const file of req.files) { // Iterate over req.files
        try {
            // Get image dimensions
            let dimensions;
            try {
                const buffer = fs.readFileSync(file.path); // Read file into a buffer
                dimensions = sizeOf.imageSize(buffer); // Pass the buffer to imageSize
            } catch (dimError) {
                console.error('Error getting image dimensions for file:', file.originalname, dimError);
                await unlinkAsync(file.path); // Delete file if dimensions can't be read
                errors.push({ file: file.originalname, message: 'Could not read image dimensions. Invalid or corrupted image?' });
                continue; // Skip to the next file
            }

            const newImage = new Image({
                name: file.originalname,
                path: `/uploads/${file.filename}`,
                project: projectId,
                uploader: req.user._id,
                width: dimensions.width,
                height: dimensions.height,
                status: 'Unannotated',
                tags: [],
            });

            if (tagsInput) {
                if (typeof tagsInput === 'string') {
                    newImage.tags = tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag);
                } else if (Array.isArray(tagsInput)) {
                    // If tags are meant to be per image, this logic needs adjustment
                    // For now, applying the same tags to all uploaded images if provided
                    newImage.tags = tagsInput.map(tag => String(tag).trim()).filter(tag => tag);
                }
            }

            const savedImage = await newImage.save();
            savedImages.push(savedImage);
            project.images.push(savedImage._id);

        } catch (error) {
            // If any error occurs for this specific file, try to delete it
            if (file && file.path) {
                try {
                    await unlinkAsync(file.path);
                } catch (fileError) {
                    console.error('Failed to delete orphaned file after error for file:', file.originalname, fileError);
                }
            }
            if (error.name === 'ValidationError') {
                const messages = Object.values(error.errors).map(val => val.message);
                errors.push({ file: file.originalname, message: messages.join('. ') });
            } else {
                console.error('Error processing file:', file.originalname, error);
                errors.push({ file: file.originalname, message: 'Server error while processing this image.' });
            }
        }
    }

    try {
        if (savedImages.length > 0) {
            await project.save(); // Save project once after all successful image additions
        }
    } catch (projectSaveError) {
        console.error('Error saving project after adding images:', projectSaveError);
        // This is a more complex scenario; potentially try to remove added image refs if project save fails
        // For now, just report the error.
        return res.status(500).json({
            message: 'Server error while saving project updates. Some images might have been saved without being linked to the project.',
            savedImages,
            errors
        });
    }

    if (errors.length > 0) {
        // If there were errors for some files, but others succeeded
        if (savedImages.length > 0) {
            return res.status(207).json({ // Multi-Status
                message: 'Some images were uploaded successfully, while others failed.',
                successfulUploads: savedImages,
                failedUploads: errors,
            });
        } else {
            // All files failed
            return res.status(400).json({
                message: 'All image uploads failed.',
                errors,
            });
        }
    }

    res.status(201).json(savedImages); // All images uploaded successfully
};

// @desc    Get all images for a specific project
// @route   GET /api/images/project/:projectId
// @access  Private
const getImagesForProject = async (req, res) => {
    const { projectId } = req.params;
    const { status } = req.query; // Optional query param to filter by status (e.g., Unannotated, Annotated)

    try {
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to view images for this project' });
        }

        let query = { project: projectId };
        if (status) {
            if (['Unannotated', 'Annotated', 'In Progress'].includes(status)) {
                query.status = status;
            } else {
                return res.status(400).json({ message: 'Invalid status filter' });
            }
        }

        const images = await Image.find(query).sort({ uploadedAt: -1 });
        res.json(images);
    } catch (error) {
        console.error('Error fetching images for project:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Get a single image by ID
// @route   GET /api/images/:imageId
// @access  Private
const getImageById = async (req, res) => {
    try {
        const image = await Image.findById(req.params.imageId).populate('project');

        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        // Check if the logged-in user owns the project the image belongs to
        if (!image.project || image.project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to access this image' });
        }

        res.json(image);
    } catch (error) {
        console.error('Error fetching image by ID:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Image not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Delete an image
// @route   DELETE /api/images/:imageId
// @access  Private
const deleteImage = async (req, res) => {
    try {
        const image = await Image.findById(req.params.imageId).populate('project');

        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        if (!image.project || image.project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this image' });
        }

        // Full path to the image file
        const imagePath = path.join(__dirname, '..', image.path); // image.path is like '/uploads/filename.jpg'

        // 1. Delete associated annotations
        await Annotation.deleteMany({ image: image._id });

        // 2. Remove image reference from project's images array
        await Project.updateOne(
            { _id: image.project._id },
            { $pull: { images: image._id } }
        );

        // 3. Delete the image document itself
        await image.deleteOne();

        // 4. Delete the actual file from the server
        try {
            await unlinkAsync(imagePath);
            console.log(`Successfully deleted image file: ${imagePath}`);
        } catch (fileErr) {
            // Log error but don't send error response if DB record deletion was successful
            console.error(`Failed to delete image file ${imagePath} from server:`, fileErr.message);
        }

        res.json({ message: 'Image and associated annotations removed successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Image not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// @desc    Update tags for an image
// @route   PUT /api/images/:imageId/tags
// @access  Private
const updateImageTags = async (req, res) => {
    const { imageId } = req.params;
    const { tags } = req.body; // Expect tags as an array of strings

    if (!Array.isArray(tags)) {
        return res.status(400).json({ message: 'Tags must be an array of strings.' });
    }

    try {
        const image = await Image.findById(imageId).populate('project');

        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }

        if (!image.project || image.project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this image' });
        }

        image.tags = tags.map(tag => String(tag).trim()).filter(tag => tag); // Sanitize and filter empty tags
        const updatedImage = await image.save();

        res.json(updatedImage);
    } catch (error) {
        console.error('Error updating image tags:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Image not found (invalid ID format)' });
        }
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
        }
        res.status(500).json({ message: 'Server error while updating image tags' });
    }
};

module.exports = {
    uploadImage,
    getImagesForProject,
    getImageById,
    deleteImage,
    updateImageTags, // Add new function to exports
};
