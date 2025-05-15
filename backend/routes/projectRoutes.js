const express = require('express');
const router = express.Router();

const {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
    addProjectClass,
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

// All routes in this file are protected and require authentication
router.use(protect);

// Route to get all projects for the user and create a new project
router.route('/')
    .post((req, res, next) => {
        createProject(req, res, next);
    })
    .get((req, res, next) => {
        getProjects(req, res, next);
    });

// Routes for a specific project by ID
router.route('/:id')
    .get(getProjectById)
    .put(updateProject)
    .delete(deleteProject);

// Route to add a class to a project
router.put('/:projectId/classes', protect, addProjectClass);

module.exports = router;
