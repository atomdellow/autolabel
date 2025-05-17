const express = require('express');
const router = express.Router();
const {
    uploadImage,
    getImagesForProject,
    getImageById,
    deleteImage,
    updateImageTags,
} = require('../controllers/imageController');
const { updateImageMetadata } = require('../controllers/imageMetadataController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware'); // Multer upload middleware

// All routes in this file are protected and require authentication
router.use(protect);

// Route to upload an image to a specific project
// The 'image' field in the form-data request should contain the file(s)
router.post('/project/:projectId', upload.array('image', 10), uploadImage); // Changed from upload.single to upload.array

// Route to get all images for a specific project
router.get('/project/:projectId', getImagesForProject);

// Routes for a specific image by ID
router.route('/:imageId')
    .get(getImageById)
    .delete(deleteImage);

// Route to update tags for a specific image
router.put('/:imageId/tags', updateImageTags);

// Route to update image metadata
router.put('/:imageId/metadata', updateImageMetadata);

module.exports = router;
