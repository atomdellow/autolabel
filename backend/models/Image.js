const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
    name: { // Original file name
        type: String,
        required: [true, 'Image name is required'],
        trim: true
    },
    path: { // Path where the image is stored (e.g., on the server or cloud storage)
        type: String,
        required: [true, 'Image path is required'],
        unique: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    uploader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    width: {
        type: Number,
        required: [true, 'Image width is required']
    },
    height: {
        type: Number,
        required: [true, 'Image height is required']
    },
    status: {
        type: String,
        enum: ['Unannotated', 'Annotated', 'In Progress'],
        default: 'Unannotated'
    },
    annotations: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Annotation'
    }],
    tags: [String], // User-defined tags for the image itself
    uploadedAt: {
        type: Date,
        default: Date.now
    },    // Roboflow-like fields from example (can be expanded)
    sourceData: {
        type: Map,
        of: mongoose.Schema.Types.Mixed // To store flexible JSON structure
    },
    // Metadata for image processing and troubleshooting
    metadata: {
        fileSize: Number,
        mimeType: String,
        uploadDate: Date,
        detectionAttempts: {
            type: Number,
            default: 0
        },
        lastDetectionDate: Date,
        detectionErrors: [String]
    }
});

const Image = mongoose.model('Image', imageSchema);

module.exports = Image;
