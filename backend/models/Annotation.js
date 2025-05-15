const mongoose = require('mongoose');

const annotationSchema = new mongoose.Schema({
    image: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image',
        required: true
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true // For easier querying of all annotations in a project
    },
    user: { // The user who created/last modified this annotation
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    label: { // The class name for the annotation
        type: String,
        required: [true, 'Annotation label/class is required'],
        trim: true
    },
    // Bounding box coordinates - assuming normalized or pixel values based on client handling
    // Storing as strings as per the example, but numbers might be more performant for calculations.
    // For now, sticking to the example data structure.
    x: {
        type: String, // Can be Number if preferred
        required: true
    },
    y: {
        type: String, // Can be Number if preferred
        required: true
    },
    width: {
        type: String, // Can be Number if preferred
        required: true
    },
    height: {
        type: String, // Can be Number if preferred
        required: true
    },
    // Optional fields from example
    id: { // A unique ID for the annotation within its image (e.g., "1", "A", "b")
        type: String,
        // required: true, // This might be generated client-side or server-side
    },
    confidence: {
        type: Number,
        default: null
    },
    // Layer information (each annotation is a layer)
    layerOrder: {
        type: Number // To maintain a z-index or order if needed
    },
    color: {
        type: String // To store the random color associated with this annotation/layer
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
annotationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Annotation = mongoose.model('Annotation', annotationSchema);

module.exports = Annotation;
