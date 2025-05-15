const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose');
const imageController = require('../controllers/imageController');
const Image = require('../models/Image');
const Project = require('../models/Project');
const Annotation = require('../models/Annotation');
const fs = require('fs');
const path = require('path');
const sizeOf = require('image-size'); // Actual module, not promisified for mocking

jest.mock('../models/Image');
jest.mock('../models/Project');
jest.mock('../models/Annotation');
jest.mock('fs', () => ({
    ...jest.requireActual('fs'), // Import and retain default behavior
    promises: {
        ...jest.requireActual('fs').promises,
        unlink: jest.fn().mockResolvedValue(undefined), // Mock fs.promises.unlink
        // mkdir: jest.fn().mockResolvedValue(undefined), // if needed for other tests
        // writeFile: jest.fn().mockResolvedValue(undefined), // if needed for other tests
        // copyFile: jest.fn().mockResolvedValue(undefined), // if needed for other tests
    },
    unlink: jest.fn((path, callback) => callback(null)), // Mock fs.unlink (sync version for promisify)
})); 

// Mock image-size. Note: The controller uses promisify(require('image-size')).
// So we mock the original 'image-size' module.
jest.mock('image-size', () => jest.fn());

// Helper to mock fs.unlink for the promisified version in controller
const mockUnlinkAsync = fs.promises.unlink; 

describe('Image Controller', () => {
    let req, res;
    const mockUserId = new mongoose.Types.ObjectId().toString();
    const mockProjectId = new mongoose.Types.ObjectId().toString();
    const mockImageId = new mongoose.Types.ObjectId().toString();
    const mockUploadedFilePath = 'uploads/mockfile.jpg';
    const mockUploadedFileOriginalName = 'mockfile.jpg';

    beforeEach(() => {
        req = httpMocks.createRequest({
            user: { _id: mockUserId },
            params: {},
            body: {},
            file: null, // Will be set in specific tests
            query: {},
        });
        res = httpMocks.createResponse();

        Image.findById.mockClear();
        Image.find.mockClear();
        Image.deleteMany.mockClear();
        Image.prototype.save.mockClear();
        Image.prototype.deleteOne.mockClear();
        Project.findById.mockClear();
        Project.updateOne.mockClear();
        Project.prototype.save.mockClear();
        Annotation.deleteMany.mockClear();
        mockUnlinkAsync.mockClear();
        fs.unlink.mockClear();
        sizeOf.mockClear();

        // Default mock for image-size
        sizeOf.mockImplementation((path, callback) => {
            // If callback is provided (original non-promisified usage)
            if (callback) return callback(null, { width: 100, height: 100 });
            // For promisified usage (controller uses this)
            return Promise.resolve({ width: 100, height: 100 });
        });
    });

    describe('uploadImage', () => {
        beforeEach(() => {
            req.params.projectId = mockProjectId;
            req.file = {
                path: mockUploadedFilePath,
                originalname: mockUploadedFileOriginalName,
                filename: 'mockfile.jpg' // multer typically adds a unique filename
            };
        });

        it('should return 400 if no image file is uploaded', async () => {
            req.file = null;
            await imageController.uploadImage(req, res);
            expect(res.statusCode).toBe(400);
            expect(res._getJSONData().message).toBe('No image file uploaded');
        });

        it('should return 404 if project not found, and delete uploaded file', async () => {
            Project.findById.mockResolvedValue(null);
            await imageController.uploadImage(req, res);
            expect(Project.findById).toHaveBeenCalledWith(mockProjectId);
            expect(mockUnlinkAsync).toHaveBeenCalledWith(mockUploadedFilePath);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Project not found');
        });

        it('should return 403 if user not authorized for project, and delete file', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: otherUserId, images: [] });
            await imageController.uploadImage(req, res);
            expect(mockUnlinkAsync).toHaveBeenCalledWith(mockUploadedFilePath);
            expect(res.statusCode).toBe(403);
            expect(res._getJSONData().message).toBe('Not authorized to upload images to this project');
        });

        it('should return 400 if image dimensions cannot be read, and delete file', async () => {
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: mockUserId, images: [], save: jest.fn() });
            sizeOf.mockImplementationOnce(() => Promise.reject(new Error('dim error')));
            await imageController.uploadImage(req, res);
            expect(mockUnlinkAsync).toHaveBeenCalledWith(mockUploadedFilePath);
            expect(res.statusCode).toBe(400);
            expect(res._getJSONData().message).toBe('Could not read image dimensions. Invalid or corrupted image?');
        });

        it('should upload image, save details, update project, and return 201', async () => {
            const mockProjectInstance = { 
                _id: mockProjectId, 
                owner: mockUserId, 
                images: [], 
                save: jest.fn().mockResolvedValueThis() 
            };
            Project.findById.mockResolvedValue(mockProjectInstance);
            sizeOf.mockResolvedValue({ width: 800, height: 600 });

            const mockImageInstance = {
                _id: mockImageId,
                name: mockUploadedFileOriginalName,
                path: `/uploads/${req.file.filename}`,
                project: mockProjectId,
                uploader: mockUserId,
                width: 800,
                height: 600,
                status: 'Unannotated',
                tags: [],
                save: jest.fn().mockResolvedValueThis()
            };
            Image.mockImplementation(() => mockImageInstance);
            req.body.tags = 'tag1, tag2';

            await imageController.uploadImage(req, res);

            expect(Image).toHaveBeenCalledWith(expect.objectContaining({
                name: mockUploadedFileOriginalName,
                width: 800,
                height: 600,
                tags: ['tag1', 'tag2']
            }));
            expect(mockImageInstance.save).toHaveBeenCalled();
            expect(mockProjectInstance.images).toContain(mockImageId);
            expect(mockProjectInstance.save).toHaveBeenCalled();
            expect(res.statusCode).toBe(201);
            expect(res._getJSONData()._id).toBe(mockImageId);
        });
        
        it('should handle tags as an array', async () => {
            const mockProjectInstance = { _id: mockProjectId, owner: mockUserId, images: [], save: jest.fn() };
            Project.findById.mockResolvedValue(mockProjectInstance);
            sizeOf.mockResolvedValue({ width: 100, height: 100 });
            const mockImageInstance = { _id: mockImageId, save: jest.fn().mockResolvedValueThis(), tags: [] }; 
            Image.mockImplementation(() => mockImageInstance);
            req.body.tags = ['tag3', 'tag4'];

            await imageController.uploadImage(req, res);
            expect(Image).toHaveBeenCalledWith(expect.objectContaining({ tags: ['tag3', 'tag4'] }));
            expect(res.statusCode).toBe(201);
        });

        it('should handle Mongoose validation errors during image save, and delete file', async () => {
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: mockUserId, images: [], save: jest.fn() });
            sizeOf.mockResolvedValue({ width: 100, height: 100 });
            const validationError = { name: 'ValidationError', errors: { name: { message: 'Name is required' } } };
            Image.mockImplementation(() => ({ save: jest.fn().mockRejectedValue(validationError) }));

            await imageController.uploadImage(req, res);
            expect(mockUnlinkAsync).toHaveBeenCalledWith(mockUploadedFilePath);
            expect(res.statusCode).toBe(400);
            expect(res._getJSONData().message).toBe('Name is required');
        });

        it('should handle general server errors during upload, and delete file', async () => {
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: mockUserId, images: [], save: jest.fn() });
            sizeOf.mockResolvedValue({ width: 100, height: 100 });
            Image.mockImplementation(() => ({ save: jest.fn().mockRejectedValue(new Error('DB error')) }));

            await imageController.uploadImage(req, res);
            expect(mockUnlinkAsync).toHaveBeenCalledWith(mockUploadedFilePath);
            expect(res.statusCode).toBe(500);
            expect(res._getJSONData().message).toBe('Server error while uploading image');
        });
    });

    describe('getImagesForProject', () => {
        beforeEach(() => {
            req.params.projectId = mockProjectId;
        });

        it('should return 404 if project not found', async () => {
            Project.findById.mockResolvedValue(null);
            await imageController.getImagesForProject(req, res);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Project not found');
        });

        it('should return 403 if user not authorized for project', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: otherUserId });
            await imageController.getImagesForProject(req, res);
            expect(res.statusCode).toBe(403);
            expect(res._getJSONData().message).toBe('Not authorized to view images for this project');
        });

        it('should return 400 for invalid status filter', async () => {
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: mockUserId });
            req.query.status = 'InvalidStatus';
            await imageController.getImagesForProject(req, res);
            expect(res.statusCode).toBe(400);
            expect(res._getJSONData().message).toBe('Invalid status filter');
        });

        it('should get images for project (no filter) and return 200', async () => {
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: mockUserId });
            const mockImages = [{ name: 'img1.jpg' }, { name: 'img2.jpg' }];
            Image.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockImages) });
            await imageController.getImagesForProject(req, res);
            expect(Image.find).toHaveBeenCalledWith({ project: mockProjectId });
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toEqual(mockImages);
        });

        it('should get images for project with status filter and return 200', async () => {
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: mockUserId });
            req.query.status = 'Annotated';
            const mockImages = [{ name: 'img1.jpg', status: 'Annotated' }];
            Image.find.mockReturnValue({ sort: jest.fn().mockResolvedValue(mockImages) });
            await imageController.getImagesForProject(req, res);
            expect(Image.find).toHaveBeenCalledWith({ project: mockProjectId, status: 'Annotated' });
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toEqual(mockImages);
        });
        
        it('should handle server errors during fetching images', async () => {
            Project.findById.mockResolvedValue({ _id: mockProjectId, owner: mockUserId });
            Image.find.mockReturnValue({ sort: jest.fn().mockRejectedValue(new Error('DB error')) });
            await imageController.getImagesForProject(req, res);
            expect(res.statusCode).toBe(500);
            expect(res._getJSONData().message).toBe('Server error');
        });
    });

    describe('getImageById', () => {
        beforeEach(() => {
            req.params.imageId = mockImageId;
        });

        it('should return 404 if image not found', async () => {
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
            await imageController.getImageById(req, res);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Image not found');
        });

        it('should return 403 if user not authorized for the image (no project)', async () => {
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: mockImageId, project: null }) });
            await imageController.getImageById(req, res);
            expect(res.statusCode).toBe(403);
            expect(res._getJSONData().message).toBe('Not authorized to access this image');
        });

        it('should return 403 if user not authorized for the image (different owner)', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: mockImageId, project: { owner: otherUserId } }) });
            await imageController.getImageById(req, res);
            expect(res.statusCode).toBe(403);
            expect(res._getJSONData().message).toBe('Not authorized to access this image');
        });

        it('should get image by ID and return 200', async () => {
            const mockImage = { _id: mockImageId, name: 'test.jpg', project: { owner: mockUserId } };
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockImage) });
            await imageController.getImageById(req, res);
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData()).toEqual(mockImage);
        });

        it('should return 404 for invalid image ID format', async () => {
            req.params.imageId = 'invalidId';
            const error = new Error('Invalid ID');
            error.kind = 'ObjectId';
            Image.findById.mockReturnValue({ populate: jest.fn().mockRejectedValue(error) });
            await imageController.getImageById(req, res);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Image not found (invalid ID format)');
        });
        
        it('should handle other server errors during fetching image by ID', async () => {
            Image.findById.mockReturnValue({ populate: jest.fn().mockRejectedValue(new Error('DB error')) });
            await imageController.getImageById(req, res);
            expect(res.statusCode).toBe(500);
            expect(res._getJSONData().message).toBe('Server error');
        });
    });

    describe('deleteImage', () => {
        const mockImageInstance = {
            _id: mockImageId,
            name: 'test.jpg',
            path: '/uploads/testfile.jpg',
            project: { _id: mockProjectId, owner: mockUserId },
            deleteOne: jest.fn().mockResolvedValue({}),
        };

        beforeEach(() => {
            req.params.imageId = mockImageId;
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockImageInstance) });
            Annotation.deleteMany.mockResolvedValue({});
            Project.updateOne.mockResolvedValue({});
            mockUnlinkAsync.mockResolvedValue(undefined); // fs.promises.unlink
        });

        it('should return 404 if image not found', async () => {
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
            await imageController.deleteImage(req, res);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Image not found');
        });

        it('should return 403 if user not authorized to delete image', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ ...mockImageInstance, project: { owner: otherUserId } }) });
            await imageController.deleteImage(req, res);
            expect(res.statusCode).toBe(403);
            expect(res._getJSONData().message).toBe('Not authorized to delete this image');
        });

        it('should delete image, annotations, update project, delete file and return 200', async () => {
            await imageController.deleteImage(req, res);
            expect(Annotation.deleteMany).toHaveBeenCalledWith({ image: mockImageId });
            expect(Project.updateOne).toHaveBeenCalledWith({ _id: mockProjectId }, { $pull: { images: mockImageId } });
            expect(mockImageInstance.deleteOne).toHaveBeenCalled();
            expect(mockUnlinkAsync).toHaveBeenCalledWith(path.join(__dirname, '..', mockImageInstance.path));
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData().message).toBe('Image and associated annotations removed successfully');
        });

        it('should log error if file deletion fails but still return 200', async () => {
            mockUnlinkAsync.mockRejectedValueOnce(new Error('File delete failed'));
            const consoleSpy = jest.spyOn(console, 'error');
            await imageController.deleteImage(req, res);
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to delete image file'), 'File delete failed');
            expect(res.statusCode).toBe(200);
            consoleSpy.mockRestore();
        });
        
        it('should return 404 for invalid image ID format on delete', async () => {
            req.params.imageId = 'invalidId';
            const error = new Error('Invalid ID');
            error.kind = 'ObjectId';
            Image.findById.mockReturnValue({ populate: jest.fn().mockRejectedValue(error) });
            await imageController.deleteImage(req, res);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Image not found (invalid ID format)');
        });

        it('should handle other server errors during image deletion', async () => {
            Image.findById.mockReturnValue({ populate: jest.fn().mockRejectedValue(new Error('DB error')) });
            await imageController.deleteImage(req, res);
            expect(res.statusCode).toBe(500);
            expect(res._getJSONData().message).toBe('Server error');
        });
    });

    describe('updateImageTags', () => {
        const mockImageInstance = {
            _id: mockImageId,
            tags: ['oldTag'],
            project: { _id: mockProjectId, owner: mockUserId },
            save: jest.fn().mockResolvedValueThis(),
        };

        beforeEach(() => {
            req.params.imageId = mockImageId;
            req.body.tags = ['newTag1', ' newTag2 ', '']; // Test trimming and filtering
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockImageInstance) });
        });

        it('should return 400 if tags is not an array', async () => {
            req.body.tags = 'not-an-array';
            await imageController.updateImageTags(req, res);
            expect(res.statusCode).toBe(400);
            expect(res._getJSONData().message).toBe('Tags must be an array of strings.');
        });

        it('should return 404 if image not found', async () => {
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
            await imageController.updateImageTags(req, res);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Image not found');
        });

        it('should return 403 if user not authorized to update image', async () => {
            const otherUserId = new mongoose.Types.ObjectId().toString();
            Image.findById.mockReturnValue({ populate: jest.fn().mockResolvedValue({ ...mockImageInstance, project: { owner: otherUserId } }) });
            await imageController.updateImageTags(req, res);
            expect(res.statusCode).toBe(403);
            expect(res._getJSONData().message).toBe('Not authorized to update this image');
        });

        it('should update image tags and return 200 with updated image', async () => {
            await imageController.updateImageTags(req, res);
            expect(mockImageInstance.tags).toEqual(['newTag1', 'newTag2']);
            expect(mockImageInstance.save).toHaveBeenCalled();
            expect(res.statusCode).toBe(200);
            expect(res._getJSONData().tags).toEqual(['newTag1', 'newTag2']);
        });

        it('should handle Mongoose validation errors during tag update', async () => {
            const validationError = { name: 'ValidationError', errors: { tags: { message: 'Invalid tags' } } };
            mockImageInstance.save.mockRejectedValueOnce(validationError);
            await imageController.updateImageTags(req, res);
            expect(res.statusCode).toBe(400);
            expect(res._getJSONData().message).toBe('Invalid tags');
        });
        
        it('should return 404 for invalid image ID format on tag update', async () => {
            req.params.imageId = 'invalidId';
            const error = new Error('Invalid ID');
            error.kind = 'ObjectId';
            Image.findById.mockReturnValue({ populate: jest.fn().mockRejectedValue(error) });
            await imageController.updateImageTags(req, res);
            expect(res.statusCode).toBe(404);
            expect(res._getJSONData().message).toBe('Image not found (invalid ID format)');
        });

        it('should handle other server errors during tag update', async () => {
            mockImageInstance.save.mockRejectedValueOnce(new Error('DB error'));
            await imageController.updateImageTags(req, res);
            expect(res.statusCode).toBe(500);
            expect(res._getJSONData().message).toBe('Server error while updating image tags');
        });
    });
});
