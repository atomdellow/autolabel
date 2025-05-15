const Project = require('../models/Project');
const User = require('../models/User'); // To ensure owner exists

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private (requires authentication)
const createProject = async (req, res) => {
    const { name, modelType } = req.body;
    console.log('Creating project with data:', req.body);
    // Basic validation
    if (!name) {
        return res.status(400).json({ message: 'Project name is required' });
    }
    // modelType will default if not provided, as per schema

    try {
        const projectExists = await Project.findOne({ name, owner: req.user._id });
        if (projectExists) {
            return res.status(400).json({ message: 'A project with this name already exists for your account' });
        }

        const project = new Project({
            name,
            modelType: modelType || 'Object Detection', // Ensure default if not sent
            owner: req.user._id, // Set owner to the logged-in user
        });

        const createdProject = await project.save();
        console.log('Project created:', createdProject);
        res.status(201).json(createdProject);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
        }
        console.error('Error creating project:', error);
        res.status(500).json({ message: 'Server error while creating project' });
    }
};

// @desc    Get all projects for the logged-in user
// @route   GET /api/projects
// @access  Private
const getProjects = async (req, res) => {
    try {
        const projects = await Project.find({ owner: req.user._id }).sort({ createdAt: -1 });
        res.json(projects);
    } catch (error) {
        console.error('Error fetching projects:', error);
        res.status(500).json({ message: 'Server error while fetching projects' });
    }
};

// @desc    Get a single project by ID
// @route   GET /api/projects/:id
// @access  Private
const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (project) {
            // Check if the logged-in user owns the project
            if (project.owner.toString() !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Not authorized to access this project' });
            }
            res.json(project);
        } else {
            res.status(404).json({ message: 'Project not found' });
        }
    } catch (error) {
        console.error('Error fetching project by ID:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Project not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error while fetching project' });
    }
};

// @desc    Update a project
// @route   PUT /api/projects/:id
// @access  Private
const updateProject = async (req, res) => {
    const { name, modelType } = req.body;

    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if the logged-in user owns the project
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to update this project' });
        }

        // Check if new name conflicts with an existing project for the same user (excluding current project)
        if (name && name !== project.name) {
            const existingProjectWithNewName = await Project.findOne({ name, owner: req.user._id, _id: { $ne: req.params.id } });
            if (existingProjectWithNewName) {
                return res.status(400).json({ message: 'Another project with this name already exists for your account' });
            }
            project.name = name;
        }

        if (modelType) {
            project.modelType = modelType; // Add validation for enum if necessary, though schema handles it
        }

        project.updatedAt = Date.now(); // Explicitly set, though pre-save hook also does it

        const updatedProject = await project.save();
        res.json(updatedProject);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: messages.join('. ') });
        }
        console.error('Error updating project:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Project not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error while updating project' });
    }
};

// @desc    Delete a project
// @route   DELETE /api/projects/:id
// @access  Private
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if the logged-in user owns the project
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to delete this project' });
        }

        // Use project.remove() to trigger the 'remove' middleware in Project.js model
        await project.remove(); 

        res.json({ message: 'Project removed successfully' });
    } catch (error) {
        console.error('Error deleting project:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Project not found (invalid ID format)' });
        }
        res.status(500).json({ message: 'Server error while deleting project' });
    }
};

// @desc    Add a class to a project's class list
// @route   PUT /api/projects/:projectId/classes
// @access  Private
const addProjectClass = async (req, res) => {
    const { projectId } = req.params;
    const { className } = req.body;

    if (!className || typeof className !== 'string' || className.trim() === '') {
        return res.status(400).json({ message: 'Class name is required and must be a non-empty string.' });
    }

    try {
        const project = await Project.findById(projectId);

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Check if user owns the project
        if (project.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'User not authorized to update this project' });
        }

        const trimmedClassName = className.trim();
        if (!project.classes.includes(trimmedClassName)) {
            project.classes.push(trimmedClassName);
            project.classes.sort(); // Keep the list sorted
            await project.save();
            res.status(200).json(project); // Return the updated project
        } else {
            res.status(200).json(project); // Class already exists, return project as is
        }
    } catch (error) {
        console.error('Error adding project class:', error);
        res.status(500).json({ message: 'Server error while adding class to project' });
    }
};

module.exports = {
    createProject,
    getProjects,
    getProjectById,
    updateProject,
    deleteProject,
    addProjectClass, // Export the new function
};
