// filepath: c:\\Users\\adamd\\Projects\\autolabel\\backend\\routes\\trainingRoutes.js
const express = require('express');
const router = express.Router();
const { startTraining, getTrainedModels, getTrainingStatus } = require('../controllers/trainingController'); // Added getTrainedModels and getTrainingStatus
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/training/project/:projectId/start
// @desc    Start training for a specific project
// @access  Private
router.post('/project/:projectId/start', protect, startTraining);

// @route   GET /api/training/project/:projectId/models
// @desc    Get all trained models for a specific project
// @access  Private
router.get('/project/:projectId/models', protect, getTrainedModels);

// @route   GET /api/training/project/:projectId/status
// @desc    Get training status for a specific project (placeholder)
// @access  Private
router.get('/project/:projectId/status', protect, getTrainingStatus);

module.exports = router;
