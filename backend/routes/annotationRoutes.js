const express = require('express');
const router = express.Router();
const {
    setAnnotationsForImage,
    getAnnotationsForImage,
    updateAnnotation,
    deleteAnnotation,
    importAnnotationsFromJson,
} = require('../controllers/annotationController');
const { protect } = require('../middleware/authMiddleware');

// All routes in this file are protected and require authentication
router.use(protect);

// Route to set/replace all annotations for a specific image
router.post('/image/:imageId/set', setAnnotationsForImage);

// Route to get all annotations for a specific image
router.get('/image/:imageId', getAnnotationsForImage);

// Route to import annotations from JSON for a specific image
router.post('/image/:imageId/import', importAnnotationsFromJson);

// Route to update a single annotation by its ID
router.put('/:annotationId', updateAnnotation);

// Route to delete a single annotation by its ID
router.delete('/:annotationId', deleteAnnotation);

module.exports = router;
