// Simplified skeleton of trainingController.js with proper try/catch structure
exports.startTraining = async (req, res) => {
    const { projectId } = req.params;
    console.log(`startTraining called with projectId: ${projectId}`);
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);
    
    // Enhanced error handling for missing request body
    if (!req.body) {
        console.error('Request body is undefined or null');
        return res.status(400).json({ 
            message: 'Missing request body. Training configuration is required.', 
            error: 'invalid_request' 
        });
    }
    
    // Handle both multipart/form-data and application/json requests
    let trainingConfig = req.body;
    
    // Extract and validate the main configuration parameters with defaults
    const baseModelName = trainingConfig.baseModelName || 'yolov8n.pt';
    if (!baseModelName) {
        console.error('baseModelName is missing in the request');
        return res.status(400).json({
            message: 'baseModelName parameter is required for training',
            error: 'missing_parameter'
        });
    }
    
    const epochs = parseInt(trainingConfig.epochs || 50, 10);
    const batchSize = parseInt(trainingConfig.batchSize || 8, 10);
    const imgSize = trainingConfig.imgSize || '640';
    const useGPU = trainingConfig.useGPU === 'true' || trainingConfig.useGPU === true;
    const trainSplit = parseFloat(trainingConfig.trainSplit || 0.8);
    
    // Log validated parameters
    console.log(`Training request validated for project ${projectId} with parameters:`, {
        baseModelName, epochs, batchSize, imgSize, useGPU, trainSplit
    });
    
    // Parse dimensions - handle both string format (e.g. "640x480") and direct width/height values
    let parsedImgWidth, parsedImgHeight;
    
    if (trainingConfig.imgWidth && trainingConfig.imgHeight) {
        // If both width and height are provided directly
        parsedImgWidth = parseInt(trainingConfig.imgWidth, 10);
        parsedImgHeight = parseInt(trainingConfig.imgHeight, 10);
    } else if (typeof imgSize === 'string' && imgSize.includes('x')) {
        // If imgSize is in format "WIDTHxHEIGHT" (e.g., "640x480")
        const [width, height] = imgSize.split('x').map(dim => parseInt(dim, 10));
        parsedImgWidth = width;
        parsedImgHeight = height;
    } else {
        // Legacy format - imgSize is a single number for square dimensions
        const size = parseInt(imgSize, 10);
        parsedImgWidth = size;
        parsedImgHeight = size;
    }

    let trainDataBasePath;
    
    try {
        if (!projectId) {
            console.error('No project ID provided in the request');
            return res.status(400).json({ message: 'Missing project ID in request' });
        }

        console.log(`Looking for project with ID: ${projectId}`);
        const project = await Project.findById(projectId);
        if (!project) {
            console.error(`Project not found with ID: ${projectId}`);
            return res.status(404).json({ message: 'Project not found' });
        }
        
        console.log(`Found project: ${project.name} (ID: ${project._id})`);
        
        // Query images using the correct field name 'project' instead of 'projectId'
        let allProjectImages = await Image.find({ project: projectId });
        if (allProjectImages.length === 0) {
            console.warn(`No images found for project ${projectId}`);
            return res.status(400).json({ 
                message: 'No images in this project to train on.', 
                error: 'query_error',
                details: `Project ID ${projectId} was found but has no associated images. Please add images to the project before training.`
            });
        }

        // ... rest of the processing code ...
        
        // Send response immediately that process has started
        res.status(202).json({ 
            message: 'Training process initiated.', 
            trainingDataPath: trainDataBasePath, 
            outputModelDir: outputModelDir,
            yoloProjectName: yoloProjectNameForRun,
            yoloExperimentName: yoloExperimentNameForRun,
            config: { 
                baseModelName,
                epochs, 
                batchSize, 
                imgSize, // Original imgSize string/value
                imgWidth: parsedImgWidth, 
                imgHeight: parsedImgHeight, 
                trainSplit 
            }
        });
        
        // Start training process and setup event handlers
        const trainingProcess = spawn(pythonExecutable, trainingArgs, { stdio: 'pipe' });
        
        // ... event handlers setup ...
        
    } catch (error) {
        console.error(`Error starting training for project ${projectId}:`, error);
        if (trainDataBasePath) {
            try {
                await fs.remove(trainDataBasePath);
            } catch (cleanupErr) {
                console.error(`Error cleaning up ${trainDataBasePath} after main error: ${cleanupErr}`);
            }
        }
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to start training process.', error: error.message });
        }
    }
};
