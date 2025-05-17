const Image = require('../models/Image');
const Project = require('../models/Project');

// @desc    Update image metadata
// @route   PUT /api/images/:imageId/metadata
// @access  Private (requires authentication)
const updateImageMetadata = async (req, res) => {
    const { imageId } = req.params;
    const metadata = req.body;
    
    try {
        // Find the image
        const image = await Image.findById(imageId);
        
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }
        
        // Check authorization
        const project = await Project.findById(image.project);
        if (!project || project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this image' });
        }
        
        // Initialize metadata if it doesn't exist
        if (!image.metadata) {
            image.metadata = {};
        }
        
        // Update detection attempt tracking
        if (metadata.detectionAttempt) {
            // Increment detection attempts
            image.metadata.detectionAttempts = (image.metadata.detectionAttempts || 0) + 1;
            image.metadata.lastDetectionDate = new Date();
            
            // Store the detection errors if any
            if (metadata.detectionAttempt.error) {
                if (!image.metadata.detectionErrors) {
                    image.metadata.detectionErrors = [];
                }
                image.metadata.detectionErrors.push(metadata.detectionAttempt.error);
                
                // Keep only the last 10 errors
                if (image.metadata.detectionErrors.length > 10) {
                    image.metadata.detectionErrors = image.metadata.detectionErrors.slice(-10);
                }
            }
        }
        
        // Update other metadata fields
        if (metadata.objectsDetected) {
            image.metadata.objectsDetected = metadata.objectsDetected;
        }
        
        // Save the updated image
        await image.save();
        
        res.json({
            message: 'Image metadata updated',
            metadata: image.metadata
        });
    } catch (error) {
        console.error('Error updating image metadata:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Image not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = {
    updateImageMetadata
};
