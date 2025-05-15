// filepath: c:\\Users\\adamd\\Projects\\autolabel\\backend\\controllers\\trainingController.js
const Project = require('../models/Project');
const Image = require('../models/Image');
const Annotation = require('../models/Annotation');
const fs = require('fs-extra'); // For file system operations
const path = require('path');
const { spawn } = require('child_process');
const imageSize = require('image-size'); // For getting image dimensions

// Helper function to convert annotations to YOLO format
async function convertAnnotationsToYoloFormat(projectId, imageId, imageDbPath, classToIndexMap) {
    let imageWidth, imageHeight;
    try {
        // imageDbPath is relative from backend root e.g. uploads/image.png
        // so __dirname, '..' should get us to the backend root from controllers directory
        const fullImagePath = path.resolve(__dirname, '..', imageDbPath); 
        if (!await fs.pathExists(fullImagePath)){
            console.warn(`Image file not found at resolved path: ${fullImagePath} (original DB path: ${imageDbPath}). Skipping annotation conversion.`);
            return '';
        }
        const dimensions = imageSize(fullImagePath);
        imageWidth = dimensions.width;
        imageHeight = dimensions.height;
    } catch (err) {
        console.error(`Error getting dimensions for image ${imageDbPath}:`, err);
        return ''; 
    }

    if (!imageWidth || !imageHeight) {
        console.warn(`Could not determine dimensions for image ${imageDbPath}. Skipping annotation conversion for it.`);
        return '';
    }

    const annotations = await Annotation.find({ imageId: imageId, projectId: projectId });
    let yoloStrings = [];
    for (const ann of annotations) {
        if (classToIndexMap[ann.label] === undefined) {
            console.warn(`Label ${ann.label} not in classToIndexMap for image ${imageId}. Skipping this annotation.`);
            continue;
        }
        const classIndex = classToIndexMap[ann.label];
        
        const x_center = (ann.x + ann.width / 2) / imageWidth;
        const y_center = (ann.y + ann.height / 2) / imageHeight;
        const width_norm = ann.width / imageWidth;
        const height_norm = ann.height / imageHeight;

        if (x_center < 0 || x_center > 1 || y_center < 0 || y_center > 1 ||
            width_norm <= 0 || width_norm > 1 || height_norm <= 0 || height_norm > 1) { // width/height should be > 0
            console.warn(`Invalid normalized coordinates for annotation ${ann._id} on image ${imageId}. Skipping.`);
            // console.warn(`Values: x_c:${x_center}, y_c:${y_center}, w:${width_norm}, h:${height_norm}`);
            // console.warn(`Originals: x:${ann.x}, y:${ann.y}, w:${ann.width}, h:${ann.height}, imgW:${imageWidth}, imgH:${imageHeight}`);
            continue;
        }

        yoloStrings.push(`${classIndex} ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width_norm.toFixed(6)} ${height_norm.toFixed(6)}`);
    }
    return yoloStrings.join('\n');
}

exports.startTraining = async (req, res) => {
    const { projectId } = req.params;
    const {
        baseModelName = 'yolov8n.pt',
        epochs = 50,
        batchSize = 8,
        imgSize = 640,
        trainSplit = 0.8, // 80% train, 20% val. If 1.0, all images for training, and val will be same as train.
    } = req.body;

    let trainDataBasePath; 

    try {
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        let allProjectImages = await Image.find({ projectId: projectId });
        if (allProjectImages.length === 0) {
            return res.status(400).json({ message: 'No images in this project to train on.' });
        }

        const validImages = [];
        for (const image of allProjectImages) {
            // image.path is stored like 'uploads/image-1747255046988-432178248.png'
            // We need its absolute path for copying and getting dimensions
            const absoluteImagePath = path.resolve(__dirname, '..', image.path);
            if (await fs.pathExists(absoluteImagePath)) {
                validImages.push({ ...image.toObject(), absolutePath: absoluteImagePath, dbPath: image.path });
            } else {
                console.warn(`Image file not found: ${absoluteImagePath} (from DB path ${image.path}) for image ID ${image._id}. Skipping.`);
            }
        }

        if (validImages.length === 0) {
            return res.status(400).json({ message: 'No valid image files found on disk for this project.' });
        }

        if (validImages.length < 2 && trainSplit < 1 && trainSplit > 0) { 
             console.warn("Less than 2 images available. Using all for training and validation sets to avoid empty sets.");
        }

        const timestamp = Date.now();
        const yoloProjectNameForRun = `project_${projectId.toString()}`;
        const yoloExperimentNameForRun = `exp_${timestamp}`;
        
        trainDataBasePath = path.join(__dirname, '..', 'temp_yolo_datasets', `${yoloProjectNameForRun}_${yoloExperimentNameForRun}`);
        const trainImagesDir = path.join(trainDataBasePath, 'images', 'train');
        const valImagesDir = path.join(trainDataBasePath, 'images', 'val');
        const trainLabelsDir = path.join(trainDataBasePath, 'labels', 'train');
        const valLabelsDir = path.join(trainDataBasePath, 'labels', 'val');

        await fs.ensureDir(trainImagesDir);
        await fs.ensureDir(valImagesDir);
        await fs.ensureDir(trainLabelsDir);
        await fs.ensureDir(valLabelsDir);

        const classNames = project.classes || [];
        if (classNames.length === 0) {
            await fs.remove(trainDataBasePath);
            return res.status(400).json({ message: 'Project has no classes defined.' });
        }
        const classToIndexMap = classNames.reduce((acc, name, index) => {
            acc[name] = index;
            return acc;
        }, {});

        validImages.sort(() => 0.5 - Math.random()); 
        
        let trainingImages = [];
        let validationImages = [];

        if (trainSplit >= 1.0) { // Use all images for training, and also for validation
            trainingImages = [...validImages];
            validationImages = [...validImages];
            console.log('Using all images for both training and validation sets.');
        } else if (trainSplit <= 0.0) { // Use all images for validation, none for training (edge case, likely problematic for YOLO)
            trainingImages = [...validImages]; // YOLO might need at least one training image, so using all for train too
            validationImages = [...validImages];
            console.warn('trainSplit is 0 or less. Using all images for validation and training as a fallback.');
        } else {
            const splitIndex = Math.max(1, Math.floor(validImages.length * trainSplit)); // Ensure at least 1 for training if possible
            trainingImages = validImages.slice(0, splitIndex);
            validationImages = validImages.slice(splitIndex);
            if (validationImages.length === 0 && trainingImages.length > 0) {
                console.warn("Validation set was empty after split. Moving one image from training to validation.");
                validationImages.push(trainingImages.pop()); 
            }
            if (trainingImages.length === 0 && validImages.length > 0) {
                 console.warn("Training set was empty after split. Using all images for training and validation as fallback.");
                 trainingImages = [...validImages];
                 validationImages = [...validImages];
            }
        }
         if (trainingImages.length === 0 && validImages.length > 0) { // If still no training images but there are valid images
            console.warn("Training set is still empty. Using all valid images for training and validation.");
            trainingImages = [...validImages];
            validationImages = [...validImages];
        } else if (trainingImages.length === 0) { // If no valid images to begin with, or some other issue
            await fs.remove(trainDataBasePath);
            return res.status(400).json({ message: 'Training set is critically empty. Add more images or adjust split.' });
        }

        const processImageSet = async (imageSet, imgDir, lblDir) => {
            let count = 0;
            for (const image of imageSet) {
                const destImagePath = path.join(imgDir, path.basename(image.absolutePath));
                await fs.copy(image.absolutePath, destImagePath);
                count++;
                // Pass the database path (image.dbPath) for annotation conversion, which is relative to backend root
                const yoloAnnotationData = await convertAnnotationsToYoloFormat(projectId, image._id, image.dbPath, classToIndexMap);
                const labelFileName = `${path.parse(image.name).name}.txt`;
                if (yoloAnnotationData && yoloAnnotationData.length > 0) {
                    await fs.writeFile(path.join(lblDir, labelFileName), yoloAnnotationData);
                } else {
                    await fs.writeFile(path.join(lblDir, labelFileName), '');
                    // console.log(`Created empty label file for ${image.name} in ${lblDir}`);
                }
            }
            return count;
        };

        const trainImgCount = await processImageSet(trainingImages, trainImagesDir, trainLabelsDir);
        const valImgCount = await processImageSet(validationImages, valImagesDir, valLabelsDir);
        console.log(`Prepared ${trainImgCount} training images and ${valImgCount} validation images.`);

        const dataYamlContent = `
path: ${trainDataBasePath.replace(/\\/g, '/')} 
train: images/train 
val: images/val 

nc: ${classNames.length}
names: [${classNames.map(name => `'${name.replace(/'/g, "''")}'`).join(', ')}]
`;
        const dataYamlPath = path.join(trainDataBasePath, 'data.yaml');
        await fs.writeFile(dataYamlPath, dataYamlContent.trim());

        const trainingScriptPath = path.resolve(__dirname, '..', '..', 'AutoDesktopVisionApi', 'train_yolo.py');
        const baseModelDir = path.resolve(__dirname, '..', '..', 'AutoDesktopVisionApi'); 
        const outputModelDir = path.resolve(__dirname, '..', 'trained_models', projectId.toString());
        await fs.ensureDir(outputModelDir);

        const pythonExecutable = process.platform === "win32" ? "python" : "python3";

        const trainingArgs = [
            trainingScriptPath,
            '--data_yaml_path', dataYamlPath,
            '--base_model_name', baseModelName,
            '--base_model_path', baseModelDir,
            '--epochs', epochs.toString(),
            '--batch_size', batchSize.toString(),
            '--img_size', imgSize.toString(),
            '--yolo_project_name', yoloProjectNameForRun,
            '--yolo_experiment_name', yoloExperimentNameForRun,
            '--output_model_dir', outputModelDir,
        ];
        
        console.log(`Spawning training script: ${pythonExecutable} ${trainingArgs.join(' ')}`);
        
        // Send response immediately that process has started
        res.status(202).json({ 
            message: 'Training process initiated.', 
            trainingDataPath: trainDataBasePath, 
            outputModelDir: outputModelDir,
            yoloProjectName: yoloProjectNameForRun,
            yoloExperimentName: yoloExperimentNameForRun,
            config: { baseModelName, epochs, batchSize, imgSize, trainSplit }
        });

        const trainingProcess = spawn(pythonExecutable, trainingArgs, { stdio: 'pipe' });

        trainingProcess.stdout.on('data', (data) => {
            console.log(`Training STDOUT (Project ${projectId}): ${data.toString().trim()}`);
            // TODO: Implement WebSocket to send this to frontend
        });

        trainingProcess.stderr.on('data', (data) => {
            console.error(`Training STDERR (Project ${projectId}): ${data.toString().trim()}`);
            // TODO: Implement WebSocket to send this to frontend
        });

        trainingProcess.on('close', async (code) => {
            console.log(`Training process for project ${projectId} exited with code ${code}`);
            if (code === 0) {
                console.log(`Training successful for project ${projectId}. Model saved in ${outputModelDir}`);
                // TODO: Update project status in DB (e.g., lastTrained, modelPath)
            } else {
                console.error(`Training failed for project ${projectId} with code ${code}.`);
                // TODO: Update project status in DB
            }
            if (trainDataBasePath) {
                try {
                    await fs.remove(trainDataBasePath);
                    console.log(`Successfully removed temp training data at ${trainDataBasePath}`);
                } catch (err) {
                    console.error(`Error removing temp training data at ${trainDataBasePath}: ${err}`);
                }
            }
        });
        
        trainingProcess.on('error', async (err) => {
            console.error(`Failed to start training subprocess for project ${projectId}: ${err}`);
             if (trainDataBasePath) {
                try {
                    await fs.remove(trainDataBasePath);
                } catch (removeErr) {
                    console.error(`Error removing temp training data during subprocess error: ${removeErr}`);
                }
            }
            // Response already sent, so just log and handle internally.
        });

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

exports.getTrainedModels = async (req, res) => {
    const { projectId } = req.params;
    try {
        const projectModelDir = path.resolve(__dirname, '..', 'trained_models', projectId.toString());
        if (!await fs.pathExists(projectModelDir)) {
            return res.json([]);
        }
        const files = await fs.readdir(projectModelDir);
        const ptFiles = [];
        for (const file of files) {
            if (file.endsWith('.pt')) {
                const filePath = path.join(projectModelDir, file);
                try {
                    const stats = await fs.stat(filePath);
                    ptFiles.push({
                        name: file,
                        size: stats.size,
                        createdAt: stats.birthtime,
                        projectId: projectId
                    });
                } catch (statError) {
                    console.error(`Error getting stats for model file ${filePath}:`, statError);
                    // Optionally add file with error or skip
                    ptFiles.push({ name: file, error: 'Could not retrieve stats', projectId: projectId }); 
                }
            }
        }
        ptFiles.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sort by newest first
        res.json(ptFiles);
    } catch (error) {
        console.error(`Error fetching trained models for project ${projectId}:`, error);
        res.status(500).json({ message: 'Failed to fetch trained models.', error: error.message });
    }
};

exports.getTrainingStatus = async (req, res) => {
    // This is a placeholder. Real status would require tracking active training processes.
    // For now, it could list recent models or a static message.
    // A more robust solution would involve a database or in-memory store of training jobs.
    const { projectId } = req.params;
    // Example: Check if a known model file exists for a recent experiment name pattern
    // This is highly simplified.
    res.json({ projectId: projectId, status: "idle", message: "Training status endpoint is a placeholder. Check server logs for active training." });
};
