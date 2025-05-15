const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose');
const projectController = require('../controllers/projectController');
const Project = require('../models/Project');
// const User = require('../models/User'); // User model is not directly called by controller methods, owner is via req.user

jest.mock('../models/Project');

describe('Project Controller', () => {
  let req, res, next;
  const mockUserId = new mongoose.Types.ObjectId().toString();
  const mockProjectId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    req = httpMocks.createRequest({
      user: { _id: mockUserId } // Mock authenticated user
    });
    res = httpMocks.createResponse();
    next = jest.fn();
    Project.findOne.mockClear();
    Project.findById.mockClear();
    Project.find.mockClear();
    Project.prototype.save.mockClear();
    Project.prototype.remove.mockClear(); // For deleteProject
  });

  describe('createProject', () => {
    it('should return 400 if project name is not provided', async () => {
      req.body = { modelType: 'Object Detection' };
      await projectController.createProject(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Project name is required');
    });

    it('should return 400 if a project with the same name already exists for the user', async () => {
      req.body = { name: 'Existing Project', modelType: 'Object Detection' };
      Project.findOne.mockResolvedValue({ _id: 'someId', name: 'Existing Project', owner: mockUserId });
      await projectController.createProject(req, res);
      expect(Project.findOne).toHaveBeenCalledWith({ name: 'Existing Project', owner: mockUserId });
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('A project with this name already exists for your account');
    });

    it('should create a new project and return 201', async () => {
      req.body = { name: 'New Project', modelType: 'Object Detection' };
      Project.findOne.mockResolvedValue(null); // No existing project
      const mockProjectInstance = { 
        _id: mockProjectId, 
        name: 'New Project', 
        modelType: 'Object Detection', 
        owner: mockUserId,
        classes: [],
        images: [],
        save: jest.fn().mockResolvedValueThis() // Mock save on the instance
      };
      // Mock the constructor to return our instance
      Project.mockImplementation(() => mockProjectInstance); 

      await projectController.createProject(req, res);
      
      expect(Project).toHaveBeenCalledWith({
        name: 'New Project',
        modelType: 'Object Detection',
        owner: mockUserId
      });
      expect(mockProjectInstance.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(201);
      expect(res._getJSONData()).toMatchObject({ name: 'New Project', owner: mockUserId });
    });
    
    it('should use default modelType if not provided', async () => {
        req.body = { name: 'Project With Default Model' };
        Project.findOne.mockResolvedValue(null);
        const mockProjectInstance = {
            _id: mockProjectId,
            name: 'Project With Default Model',
            modelType: 'Object Detection', // Default value from controller
            owner: mockUserId,
            save: jest.fn().mockResolvedValueThis()
        };
        Project.mockImplementation(() => mockProjectInstance);

        await projectController.createProject(req, res);
        expect(Project).toHaveBeenCalledWith(expect.objectContaining({ modelType: 'Object Detection' }));
        expect(res.statusCode).toBe(201);
    });

    it('should handle Mongoose validation errors during project creation', async () => {
      req.body = { name: 'P', modelType: 'Object Detection' }; // Assuming 'P' is too short for name
      Project.findOne.mockResolvedValue(null);
      const validationError = {
        name: 'ValidationError',
        errors: { name: { message: 'Project name is too short' } }
      };
      // Mock the constructor to return an instance whose save method throws
      const mockProjectInstance = {
          save: jest.fn().mockRejectedValue(validationError)
      };
      Project.mockImplementation(() => mockProjectInstance);

      await projectController.createProject(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Project name is too short');
    });

    it('should handle other server errors during project creation', async () => {
      req.body = { name: 'Error Project', modelType: 'Object Detection' };
      Project.findOne.mockResolvedValue(null);
      const mockProjectInstance = {
          save: jest.fn().mockRejectedValue(new Error('Generic DB error'))
      };
      Project.mockImplementation(() => mockProjectInstance);

      await projectController.createProject(req, res);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toBe('Server error while creating project');
    });
  });

  describe('getProjects', () => {
    it('should get all projects for the logged-in user and return 200', async () => {
      const mockProjects = [{ name: 'Project 1' }, { name: 'Project 2' }];
      Project.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockProjects) });
      
      await projectController.getProjects(req, res);
      
      expect(Project.find).toHaveBeenCalledWith({ owner: mockUserId });
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual(mockProjects);
    });

    it('should handle server errors during fetching projects', async () => {
      Project.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('DB error')) });
      await projectController.getProjects(req, res);
      expect(res.statusCode).toBe(500);
      expect(res._getJSONData().message).toBe('Server error while fetching projects');
    });
  });

  describe('getProjectById', () => {
    it('should return 404 if project not found', async () => {
      req.params = { id: mockProjectId };
      Project.findById.mockResolvedValue(null);
      await projectController.getProjectById(req, res);
      expect(Project.findById).toHaveBeenCalledWith(mockProjectId);
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData().message).toBe('Project not found');
    });

    it('should return 403 if user is not authorized to access the project', async () => {
      req.params = { id: mockProjectId };
      const otherUserId = new mongoose.Types.ObjectId().toString();
      Project.findById.mockResolvedValue({ _id: mockProjectId, owner: otherUserId });
      await projectController.getProjectById(req, res);
      expect(res.statusCode).toBe(403);
      expect(res._getJSONData().message).toBe('Not authorized to access this project');
    });

    it('should get a project by ID and return 200', async () => {
      req.params = { id: mockProjectId };
      const mockProject = { _id: mockProjectId, name: 'Test Project', owner: mockUserId };
      Project.findById.mockResolvedValue(mockProject);
      await projectController.getProjectById(req, res);
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData()).toEqual(mockProject);
    });

    it('should return 404 for invalid project ID format', async () => {
      req.params = { id: 'invalidIdFormat' };
      const objectIdError = new Error('Invalid ID');
      objectIdError.kind = 'ObjectId'; // Simulate Mongoose ObjectId error
      Project.findById.mockRejectedValue(objectIdError);
      await projectController.getProjectById(req, res);
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData().message).toBe('Project not found (invalid ID format)');
    });
    
    it('should handle other server errors during fetching project by ID', async () => {
        req.params = { id: mockProjectId };
        Project.findById.mockRejectedValue(new Error('Generic DB error'));
        await projectController.getProjectById(req, res);
        expect(res.statusCode).toBe(500);
        expect(res._getJSONData().message).toBe('Server error while fetching project');
    });
  });

  describe('updateProject', () => {
    it('should return 404 if project to update is not found', async () => {
      req.params = { id: mockProjectId };
      req.body = { name: 'Updated Name' };
      Project.findById.mockResolvedValue(null);
      await projectController.updateProject(req, res);
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData().message).toBe('Project not found');
    });

    it('should return 403 if user is not authorized to update the project', async () => {
      req.params = { id: mockProjectId };
      req.body = { name: 'Updated Name' };
      const otherUserId = new mongoose.Types.ObjectId().toString();
      Project.findById.mockResolvedValue({ _id: mockProjectId, name: 'Original Name', owner: otherUserId, save: jest.fn() });
      await projectController.updateProject(req, res);
      expect(res.statusCode).toBe(403);
      expect(res._getJSONData().message).toBe('Not authorized to update this project');
    });

    it('should return 400 if new name conflicts with another project of the same user', async () => {
        req.params = { id: mockProjectId };
        req.body = { name: 'Conflicting Name' };
        const originalProject = { 
            _id: mockProjectId, 
            name: 'Original Name', 
            owner: mockUserId, 
            save: jest.fn() 
        };
        Project.findById.mockResolvedValue(originalProject);
        Project.findOne.mockResolvedValue({ _id: 'otherProjectId', name: 'Conflicting Name', owner: mockUserId }); // Simulate existing project with new name

        await projectController.updateProject(req, res);

        expect(Project.findOne).toHaveBeenCalledWith({ name: 'Conflicting Name', owner: mockUserId, _id: { $ne: mockProjectId } });
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().message).toBe('Another project with this name already exists for your account');
    });
    
    it('should update project name and modelType and return 200', async () => {
      req.params = { id: mockProjectId };
      req.body = { name: 'Updated Project Name', modelType: 'Classification' };
      const mockProjectInstance = {
        _id: mockProjectId,
        name: 'Original Project Name',
        modelType: 'Object Detection',
        owner: mockUserId,
        save: jest.fn().mockResolvedValueThis(), // 'this' refers to the mockProjectInstance itself
        // Add other properties as needed by the controller logic
      };
      Project.findById.mockResolvedValue(mockProjectInstance);
      Project.findOne.mockResolvedValue(null); // No conflict with new name

      await projectController.updateProject(req, res);

      expect(mockProjectInstance.name).toBe('Updated Project Name');
      expect(mockProjectInstance.modelType).toBe('Classification');
      expect(mockProjectInstance.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().name).toBe('Updated Project Name');
      expect(res._getJSONData().modelType).toBe('Classification');
    });

    it('should handle Mongoose validation errors during project update', async () => {
        req.params = { id: mockProjectId };
        req.body = { name: 'N' }; // Invalid name
        const mockProjectInstance = {
            _id: mockProjectId,
            name: 'Original Name',
            owner: mockUserId,
            save: jest.fn().mockRejectedValue({ name: 'ValidationError', errors: { name: { message: 'Name too short' } } })
        };
        Project.findById.mockResolvedValue(mockProjectInstance);
        Project.findOne.mockResolvedValue(null); // No name conflict initially

        await projectController.updateProject(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().message).toBe('Name too short');
    });
    
    it('should handle other server errors during project update', async () => {
        req.params = { id: mockProjectId };
        req.body = { name: 'Updated Name' };
        const mockProjectInstance = {
            _id: mockProjectId,
            name: 'Original Name',
            owner: mockUserId,
            save: jest.fn().mockRejectedValue(new Error('Generic DB error'))
        };
        Project.findById.mockResolvedValue(mockProjectInstance);
        Project.findOne.mockResolvedValue(null);

        await projectController.updateProject(req, res);
        expect(res.statusCode).toBe(500);
        expect(res._getJSONData().message).toBe('Server error while updating project');
    });

    it('should return 404 for invalid project ID format on update', async () => {
        req.params = { id: 'invalidIdFormat' };
        req.body = { name: 'Updated Name' };
        const objectIdError = new Error('Invalid ID');
        objectIdError.kind = 'ObjectId';
        Project.findById.mockRejectedValue(objectIdError);
        await projectController.updateProject(req, res);
        expect(res.statusCode).toBe(404);
        expect(res._getJSONData().message).toBe('Project not found (invalid ID format)');
    });
  });

  describe('deleteProject', () => {
    it('should return 404 if project to delete is not found', async () => {
      req.params = { id: mockProjectId };
      Project.findById.mockResolvedValue(null);
      await projectController.deleteProject(req, res);
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData().message).toBe('Project not found');
    });

    it('should return 403 if user is not authorized to delete the project', async () => {
      req.params = { id: mockProjectId };
      const otherUserId = new mongoose.Types.ObjectId().toString();
      Project.findById.mockResolvedValue({ _id: mockProjectId, owner: otherUserId, remove: jest.fn() });
      await projectController.deleteProject(req, res);
      expect(res.statusCode).toBe(403);
      expect(res._getJSONData().message).toBe('Not authorized to delete this project');
    });

    it('should delete the project and return 200 with success message', async () => {
      req.params = { id: mockProjectId };
      const mockProjectInstance = { 
          _id: mockProjectId, 
          owner: mockUserId, 
          remove: jest.fn().mockResolvedValue({}) // Mock remove method
        };
      Project.findById.mockResolvedValue(mockProjectInstance);
      
      await projectController.deleteProject(req, res);
      
      expect(mockProjectInstance.remove).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().message).toBe('Project removed successfully');
    });

    it('should return 404 for invalid project ID format on delete', async () => {
        req.params = { id: 'invalidIdFormat' };
        const objectIdError = new Error('Invalid ID');
        objectIdError.kind = 'ObjectId';
        Project.findById.mockRejectedValue(objectIdError);
        await projectController.deleteProject(req, res);
        expect(res.statusCode).toBe(404);
        expect(res._getJSONData().message).toBe('Project not found (invalid ID format)');
    });

    it('should handle other server errors during project deletion', async () => {
        req.params = { id: mockProjectId };
        const mockProjectInstance = { 
            _id: mockProjectId, 
            owner: mockUserId, 
            remove: jest.fn().mockRejectedValue(new Error('Generic DB error'))
        };
        Project.findById.mockResolvedValue(mockProjectInstance);
        await projectController.deleteProject(req, res);
        expect(res.statusCode).toBe(500);
        expect(res._getJSONData().message).toBe('Server error while deleting project');
    });
  });

  describe('addProjectClass', () => {
    it('should return 400 if class name is not provided or empty', async () => {
      req.params = { projectId: mockProjectId };
      req.body = { className: '' };
      await projectController.addProjectClass(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Class name is required and must be a non-empty string.');
      
      req.body = {};
      await projectController.addProjectClass(req, res);
      expect(res.statusCode).toBe(400);
      expect(res._getJSONData().message).toBe('Class name is required and must be a non-empty string.');
    });

    it('should return 404 if project not found', async () => {
      req.params = { projectId: mockProjectId };
      req.body = { className: 'newClass' };
      Project.findById.mockResolvedValue(null);
      await projectController.addProjectClass(req, res);
      expect(res.statusCode).toBe(404);
      expect(res._getJSONData().message).toBe('Project not found');
    });

    it('should return 403 if user is not authorized to update the project', async () => {
      req.params = { projectId: mockProjectId };
      req.body = { className: 'newClass' };
      const otherUserId = new mongoose.Types.ObjectId().toString();
      Project.findById.mockResolvedValue({ _id: mockProjectId, owner: otherUserId, classes: [], save: jest.fn() });
      await projectController.addProjectClass(req, res);
      expect(res.statusCode).toBe(403);
      expect(res._getJSONData().message).toBe('User not authorized to update this project');
    });

    it('should add a new class to the project and return 200 with updated project', async () => {
      req.params = { projectId: mockProjectId };
      req.body = { className: ' New Class ' }; // Test trimming
      const mockProjectInstance = {
        _id: mockProjectId,
        owner: mockUserId,
        classes: ['Existing Class'],
        save: jest.fn().mockResolvedValueThis(),
      };
      Project.findById.mockResolvedValue(mockProjectInstance);
      
      await projectController.addProjectClass(req, res);
      
      expect(mockProjectInstance.classes).toContain('New Class');
      expect(mockProjectInstance.classes).toContain('Existing Class');
      expect(mockProjectInstance.classes.length).toBe(2); // Assuming sort happens correctly
      expect(mockProjectInstance.save).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().classes).toContain('New Class');
    });

    it('should return 200 with project if class already exists (and not add duplicate)', async () => {
      req.params = { projectId: mockProjectId };
      req.body = { className: 'Existing Class' };
      const mockProjectInstance = {
        _id: mockProjectId,
        owner: mockUserId,
        classes: ['Existing Class', 'Another Class'],
        save: jest.fn().mockResolvedValueThis(),
      };
      Project.findById.mockResolvedValue(mockProjectInstance);
      
      await projectController.addProjectClass(req, res);
      
      expect(mockProjectInstance.classes).toEqual(['Existing Class', 'Another Class']); // Should remain unchanged
      expect(mockProjectInstance.save).not.toHaveBeenCalled(); // Save should not be called if class exists
      expect(res.statusCode).toBe(200);
      expect(res._getJSONData().classes).toEqual(['Existing Class', 'Another Class']);
    });
    
    it('should handle server errors during adding project class', async () => {
        req.params = { projectId: mockProjectId };
        req.body = { className: 'newClass' };
        const mockProjectInstance = {
            _id: mockProjectId,
            owner: mockUserId,
            classes: [],
            save: jest.fn().mockRejectedValue(new Error('Generic DB error'))
        };
        Project.findById.mockResolvedValue(mockProjectInstance);
        await projectController.addProjectClass(req, res);
        expect(res.statusCode).toBe(500);
        expect(res._getJSONData().message).toBe('Server error while adding class to project');
    });
  });
});

