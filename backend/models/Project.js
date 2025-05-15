const mongoose = require('mongoose');
const fs = require('fs').promises; // Using promises version of fs
const path = require('path');

const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Project name is required'],
        trim: true
    },
    description: { // Added description field
        type: String,
        trim: true,
        default: ''
    },
    modelType: {
        type: String,
        required: [true, 'Model type is required'],
        enum: ['Object Detection'], // Initially only Object Detection
        default: 'Object Detection'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    images: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image'
    }],
    classes: [{
        type: String,
        trim: true,
    }],
    trainedModelPath: {
        type: String,
        trim: true,
        default: null,
    },
    trainingStatus: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Completed', 'Failed', 'No Model Yet'],
        default: 'No Model Yet',
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Middleware to update `updatedAt` field before saving
projectSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Middleware for cascading delete when a project is removed
projectSchema.pre('remove', async function(next) {
    console.log(`Attempting to remove project ${this._id} and its related data.`);
    // It's generally safer to get models directly from mongoose like this in middleware
    // to avoid issues with model registration timing or circular dependencies.
    const Image = mongoose.model('Image');
    const Annotation = mongoose.model('Annotation');

    try {
        // Find all images associated with this project
        const images = await Image.find({ project: this._id });

        if (images.length > 0) {
            const imageIds = images.map(img => img._id);

            // 1. Delete all annotations associated with these images
            console.log(`Deleting annotations for ${images.length} images in project ${this._id}. Image IDs: ${imageIds.join(', ')}`);
            const annotationDeleteResult = await Annotation.deleteMany({ image: { $in: imageIds } });
            console.log(`Deleted ${annotationDeleteResult.deletedCount} annotations.`);

            // 2. Delete image files from the filesystem
            console.log(`Deleting image files for project ${this._id}.`);
            for (const image of images) {
                if (image.path) { // Ensure path exists
                    try {
                        // image.path is stored as 'uploads/uniqueFilename.ext'
                        // __dirname in models/Project.js is c:\Users\adamd\Projects\autolabel\backend\models
                        const imagePath = path.join(__dirname, '..', image.path);
                        await fs.unlink(imagePath);
                        console.log(`Successfully deleted image file: ${imagePath}`);
                    } catch (fileError) {
                        // Log error but continue, as DB entries should still be cleaned up
                        console.error(`Error deleting image file ${image.path} (resolved: ${path.join(__dirname, '..', image.path)}):`, fileError.message);
                        // If file not found, it might have been already deleted or path is incorrect.
                        // Consider if this should halt the process or just be logged. For now, logging.
                    }
                } else {
                    console.warn(`Image document ${image._id} has no path, skipping file deletion.`);
                }
            }

            // 3. Delete all Image documents associated with this project
            console.log(`Deleting ${images.length} image documents for project ${this._id}.`);
            const imageDeleteResult = await Image.deleteMany({ project: this._id });
            console.log(`Deleted ${imageDeleteResult.deletedCount} image documents.`);
        } else {
            console.log(`No images found for project ${this._id}. Skipping image and annotation deletion.`);
        }
        next();
    } catch (error) {
        console.error(`Error during cascading delete for project ${this._id}:`, error);
        next(error); // Pass error to the next middleware or save operation
    }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
