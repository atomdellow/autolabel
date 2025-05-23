const express = require('express');
const router = express.Router();
const { 
    startTraining, 
    getTrainedModels, 
    getTrainingStatus,
    verifyTrainingPrerequisites 
} = require('../controllers/trainingController');
const { protect } = require('../middleware/authMiddleware');

// @route   POST /api/training/project/:projectId/start
// @desc    Start training for a specific project
// @access  Private
router.post('/project/:projectId/start', protect, startTraining);

// @route   GET /api/training/project/:projectId/models
// @desc    Get all trained models for a specific project
// @access  Private
router.get('/project/:projectId/models', protect, getTrainedModels);

// @route   GET /api/training/models
// @desc    Get all trained models across all projects
// @access  Private
router.get('/models', protect, getTrainedModels);

// @route   GET /api/training/project/:projectId/status
// @desc    Get training status for a specific project (placeholder)
// @access  Private
router.get('/project/:projectId/status', protect, getTrainingStatus);

// @route   GET /api/training/project/:projectId/prerequisites
// @desc    Verify if a project meets prerequisites for training
// @access  Private
router.get('/project/:projectId/prerequisites', protect, verifyTrainingPrerequisites);

module.exports = router;
