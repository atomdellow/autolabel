const httpMocks = require('node-mocks-http');
const mongoose = require('mongoose');
const { EventEmitter } = require('events'); // For mocking child_process
const trainingController = require('../controllers/trainingController');
const Project = require('../models/Project');
const Image = require('../models/Image');
const fs = require('fs').promises;
const path = require('path');
const child_process = require('child_process');

jest.mock('../models/Project');
jest.mock('../models/Image');
jest.mock('fs', () => ({
    ...jest.requireActual('fs'),
    promises: {
        ...jest.requireActual('fs').promises,
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        copyFile: jest.fn().mockResolvedValue(undefined),
        access: jest.fn().mockResolvedValue(undefined), // Default to file exists
        rm: jest.fn().mockResolvedValue(undefined),
    }
}));
jest.mock('child_process');

// Mock Date.now() to control timestamp in trainingDir
const mockDateNow = 1678886400000; // Example: March 15, 2023

describe('Training Controller', () => {
    let req, res;
    const mockUserId = new mongoose.Types.ObjectId().toString();
    const mockProjectId = new mongoose.Types.ObjectId().toString();
    let mockProjectInstance;
    let mockImageInstances;
    let mockSpawnedProcess;

    beforeEach(() => {
        jest.spyOn(Date, 'now').mockReturnValue(mockDateNow);
        req = httpMocks.createRequest({
            user: { _id: mockUserId },
            params: { projectId: mockProjectId },
        });
        res = httpMocks.createResponse();

        mockProjectInstance = {
            _id: mockProjectId,
            owner: mockUserId,
            trainingStatus: 'Not Started',
            trainedModelPath: null,
            save: jest.fn().mockResolvedValueThis(),
        };

        mockImageInstances = [
            {
                _id: new mongoose.Types.ObjectId().toString(),
                name: 'image1.jpg',
                path: '/uploads/image1.jpg',
                project: mockProjectId,
                status: 'Annotated',
                width: 640,
                height: 480,
                annotations: [{ label: 'cat', x: 10, y: 10, width: 50, height: 50 }],
            },
            {
                _id: new mongoose.Types.ObjectId().toString(),
                name: 'image2.png',
                path: '/uploads/image2.png',
                project: mockProjectId,
                status: 'Annotated',
                width: 800,
                height: 600,
                annotations: [{ label: 'dog', x: 20, y: 20, width: 60, height: 60 }, { label: 'cat', x: 100, y: 100, width: 50, height: 50 }],
            },
        ];

        Project.findById.mockResolvedValue(mockProjectInstance);
        Image.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(mockImageInstances) });

        // Mock child_process.spawn
        mockSpawnedProcess = new EventEmitter();
        mockSpawnedProcess.stdout = new EventEmitter();
        mockSpawnedProcess.stderr = new EventEmitter();
        child_process.spawn.mockReturnValue(mockSpawnedProcess);

        // Clear fs mocks
        fs.mkdir.mockClear().mockResolvedValue(undefined);
        fs.writeFile.mockClear().mockResolvedValue(undefined);
        fs.copyFile.mockClear().mockResolvedValue(undefined);
        fs.access.mockClear().mockResolvedValue(undefined); // Default: file exists
        fs.rm.mockClear().mockResolvedValue(undefined);
        mockProjectInstance.save.mockClear().mockResolvedValue(mockProjectInstance);
    });

    afterEach(() => {
        jest.restoreAllMocks(); // Restores Date.now()
    });

    const expectedTrainDir = path.join(__dirname, '..', 'training_data', `${mockProjectId}_${mockDateNow}`);

    it('should return 404 if project not found', async () => {
        Project.findById.mockResolvedValue(null);
        await trainingController.startTraining(req, res);
        expect(res.statusCode).toBe(404);
        expect(res._getJSONData().message).toBe('Project not found');
    });

    it('should return 403 if user not authorized for the project', async () => {
        mockProjectInstance.owner = new mongoose.Types.ObjectId().toString(); // Different owner
        await trainingController.startTraining(req, res);
        expect(res.statusCode).toBe(403);
        expect(res._getJSONData().message).toBe('Not authorized to train this project');
    });

    it('should return 400 if no annotated images found', async () => {
        Image.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([]) });
        await trainingController.startTraining(req, res);
        expect(res.statusCode).toBe(400);
        expect(res._getJSONData().message).toBe('No annotated images found in this project to train.');
    });

    it('should start training process, create directories and files, and return 202', async () => {
        await trainingController.startTraining(req, res);

        expect(mockProjectInstance.save).toHaveBeenCalled(); // For initial status update
        expect(mockProjectInstance.trainingStatus).toBe('In Progress');
        expect(Image.find).toHaveBeenCalledWith({ project: mockProjectId, status: 'Annotated' });

        // Check directory creations
        expect(fs.mkdir).toHaveBeenCalledWith(expectedTrainDir, { recursive: true });
        expect(fs.mkdir).toHaveBeenCalledWith(path.join(expectedTrainDir, 'train', 'images'), { recursive: true });
        expect(fs.mkdir).toHaveBeenCalledWith(path.join(expectedTrainDir, 'train', 'labels'), { recursive: true });
        expect(fs.mkdir).toHaveBeenCalledWith(path.join(expectedTrainDir, 'val', 'images'), { recursive: true });
        expect(fs.mkdir).toHaveBeenCalledWith(path.join(expectedTrainDir, 'val', 'labels'), { recursive: true });

        // Check dataset.yaml creation
        expect(fs.writeFile).toHaveBeenCalledWith(
            path.join(expectedTrainDir, 'dataset.yaml'),
            expect.stringContaining('names:\n  - cat\n  - dog') // Order matters due to sort
        );

        // Check image copying and label file creation (simplified check)
        // Based on the split logic, at least one image will be processed for train or val
        expect(fs.copyFile).toHaveBeenCalled(); 
        expect(fs.writeFile).toHaveBeenCalledWith(expect.stringMatching(/\.txt$/), expect.any(String)); // Label file

        // Check child_process.spawn call
        expect(child_process.spawn).toHaveBeenCalledWith(
            process.env.PYTHON_EXECUTABLE || 'python',
            [
                path.join(__dirname, '..', 'scripts', 'train_yolo.py'),
                '--data', path.join(expectedTrainDir, 'dataset.yaml'),
                '--weights', 'yolov8n.pt',
                '--epochs', '5',
                '--img', '640',
                '--project_id', mockProjectId,
                '--output_dir', path.join(__dirname, '..', 'trained_models')
            ]
        );

        expect(res.statusCode).toBe(202);
        expect(res._getJSONData().message).toBe('Training process started.');
        expect(res._getJSONData().trainingDataPath).toBe(expectedTrainDir);
    });

    describe('Python script interaction (\'close\' event)', () => {
        beforeEach(async () => {
            // Trigger the initial part of startTraining to setup mocks and allow emitting 'close'
            await trainingController.startTraining(req, res);
            // Ensure Project.findById is mocked for the 'close' event handler
            Project.findById.mockResolvedValue(mockProjectInstance); 
        });

        it('should update project to Completed if script exits with code 0 and model exists', async () => {
            fs.access.mockResolvedValue(undefined); // Model file exists
            mockSpawnedProcess.emit('close', 0); // Simulate successful script exit
            
            // Wait for async operations within 'close' handler
            await new Promise(resolve => setImmediate(resolve)); 

            expect(Project.findById).toHaveBeenCalledWith(mockProjectId); // Called again in 'close'
            expect(mockProjectInstance.trainingStatus).toBe('Completed');
            expect(mockProjectInstance.trainedModelPath).toBe(path.join('trained_models', mockProjectId, 'weights', 'best.pt'));
            expect(mockProjectInstance.save).toHaveBeenCalledTimes(2); // Initial + final update
        });

        it('should update project to Failed if script exits with code 0 but model NOT found', async () => {
            fs.access.mockRejectedValue(new Error('File not found')); // Model file does not exist
            mockSpawnedProcess.emit('close', 0);
            await new Promise(resolve => setImmediate(resolve));

            expect(mockProjectInstance.trainingStatus).toBe('Failed');
            expect(mockProjectInstance.trainedModelPath).toBeNull();
            expect(mockProjectInstance.save).toHaveBeenCalledTimes(2);
        });

        it('should update project to Failed if script exits with non-zero code', async () => {
            mockSpawnedProcess.emit('close', 1); // Simulate script failure
            mockSpawnedProcess.stderr.emit('data', 'Script error output');
            await new Promise(resolve => setImmediate(resolve));

            expect(mockProjectInstance.trainingStatus).toBe('Failed');
            expect(mockProjectInstance.trainedModelPath).toBeNull();
            expect(mockProjectInstance.save).toHaveBeenCalledTimes(2);
        });

        it('should handle project not found during status update in \'close\' event', async () => {
            Project.findById.mockResolvedValue(null); // Project deleted during training
            const consoleErrorSpy = jest.spyOn(console, 'error');
            mockSpawnedProcess.emit('close', 0);
            await new Promise(resolve => setImmediate(resolve));
            
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Project not found for status update after training'));
            expect(mockProjectInstance.save).toHaveBeenCalledTimes(1); // Only initial save, no second attempt
            consoleErrorSpy.mockRestore();
        });
        
        it('should handle DB error when updating project status in \'close\' event', async () => {
            mockProjectInstance.save.mockRejectedValueOnce(new Error('DB update failed')); // Fail on the second save
            const consoleErrorSpy = jest.spyOn(console, 'error');
            fs.access.mockResolvedValue(undefined); // Model exists
            mockSpawnedProcess.emit('close', 0);
            await new Promise(resolve => setImmediate(resolve));

            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error updating project status in DB'), expect.any(Error));
            // Status might have been set locally on mockProjectInstance but save failed
            expect(mockProjectInstance.trainingStatus).toBe('Completed'); // Attempted update
            consoleErrorSpy.mockRestore();
        });
    });

    it('should handle error during initial project save and attempt cleanup', async () => {
        const initialSaveError = new Error('Initial save failed');
        initialSaveError.trainDir = expectedTrainDir; // Attach trainDir for cleanup check
        mockProjectInstance.save.mockRejectedValueOnce(initialSaveError);
        // fs.access for cleanup check
        fs.access.mockResolvedValueOnce(undefined); // training_data dir exists

        await trainingController.startTraining(req, res);

        expect(res.statusCode).toBe(500);
        expect(res._getJSONData().message).toBe('Server error while starting training process.');
        expect(fs.rm).toHaveBeenCalledWith(expectedTrainDir, { recursive: true, force: true });
    });
    
    it('should handle error during fs.mkdir and attempt cleanup', async () => {
        const mkdirError = new Error('mkdir failed');
        mkdirError.trainDir = expectedTrainDir; // Attach trainDir for cleanup check
        fs.mkdir.mockImplementation((p) => {
            // Fail for the main training directory to trigger cleanup
            if (p === expectedTrainDir) return Promise.reject(mkdirError);
            return Promise.resolve(undefined);
        });
        fs.access.mockResolvedValueOnce(undefined); // training_data dir exists for cleanup check

        await trainingController.startTraining(req, res);

        expect(res.statusCode).toBe(500);
        expect(res._getJSONData().message).toBe('Server error while starting training process.');
        expect(fs.rm).toHaveBeenCalledWith(expectedTrainDir, { recursive: true, force: true });
    });

    it('should correctly process images with missing physical files (fs.access fails)', async () => {
        // First image exists, second does not
        fs.access.mockImplementation(filePath => {
            if (filePath.includes(mockImageInstances[1].path)) {
                return Promise.reject(new Error('File not found'));
            }
            return Promise.resolve(undefined);
        });
        const consoleWarnSpy = jest.spyOn(console, 'warn');

        await trainingController.startTraining(req, res);

        // Check that copyFile was called for the first image but not the second (or fewer times)
        expect(fs.copyFile).toHaveBeenCalledWith(
            path.join(__dirname, '..', mockImageInstances[0].path),
            expect.stringContaining(path.basename(mockImageInstances[0].path))
        );
        expect(fs.copyFile).not.toHaveBeenCalledWith(
            path.join(__dirname, '..', mockImageInstances[1].path),
            expect.any(String)
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Skipping missing image: ${path.join(__dirname, '..', mockImageInstances[1].path)}`));
        expect(res.statusCode).toBe(202); // Still proceeds with available images
        consoleWarnSpy.mockRestore();
    });

    it('should correctly handle train/validation split for small datasets', async () => {
        // Test with 3 images: all should go to train and val
        const fewImages = mockImageInstances.slice(0, 1);
        fewImages.push({ ...mockImageInstances[0], _id: new mongoose.Types.ObjectId().toString(), name: 'image1_copy1.jpg' });
        fewImages.push({ ...mockImageInstances[0], _id: new mongoose.Types.ObjectId().toString(), name: 'image1_copy2.jpg' });
        Image.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(fewImages) });

        await trainingController.startTraining(req, res);

        // Expect 3 images copied for train and 3 for val (or rather, files written for them)
        // This means fs.writeFile for labels should be called for each image in each set
        // Since images are identical, names will be too, so count calls to writeFile for labels
        const labelWriteCalls = fs.writeFile.mock.calls.filter(call => call[0].endsWith('.txt')).length;
        // Each of the 3 images will have a label file written for train, and again for val.
        // Plus one for dataset.yaml
        expect(labelWriteCalls).toBe(fewImages.length * 2); 
        expect(fs.copyFile).toHaveBeenCalledTimes(fewImages.length * 2);
        expect(res.statusCode).toBe(202);
    });

    it('should correctly handle train/validation split for larger datasets (e.g. 10 images, 20% val -> 2 val, 8 train)', async () => {
        const manyImages = [];
        for (let i = 0; i < 10; i++) {
            manyImages.push({
                ...mockImageInstances[0],
                _id: new mongoose.Types.ObjectId().toString(),
                name: `image_large_${i}.jpg`,
                annotations: [{ label: 'cat', x: 10, y: 10, width: 50, height: 50 }]
            });
        }
        Image.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(manyImages) });

        await trainingController.startTraining(req, res);

        const labelWriteCalls = fs.writeFile.mock.calls.filter(call => call[0].endsWith('.txt')).length;
        expect(labelWriteCalls).toBe(10); // 2 for val, 8 for train
        expect(fs.copyFile).toHaveBeenCalledTimes(10);
        expect(res.statusCode).toBe(202);
    });
});
