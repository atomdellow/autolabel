<!-- filepath: c:\Users\adamd\Projects\autolabel\documentation\model_training_guide.md -->
# Model Training Guide

This guide explains how to use the custom model training functionality in AutoLabel to create your own object detection models.

## Overview

AutoLabel allows you to train custom YOLOv8 object detection models using your annotated images. The trained models can then be used for automated annotation of new images.

## Requirements

- Python 3.8+ with PyTorch and Ultralytics YOLOv8 installed
- Running detection server (automatic or manual start)
- At least 10-20 annotated images for best results

## Training Process

### 1. Detection Server Status

Before training a model, check the detection server status indicator at the top of the Training page. The status will show:

- **Online** (green): Server is running and ready
- **Offline** (amber): Server is not running
- **Error** (red): Server encountered an error

If the server is offline, you can click the "Start Server" button to start it manually.

### 2. Configure Training

1. Select the project containing your annotated images
2. Choose model type (currently YOLOv8n is supported)
3. Set training parameters:
   - **Epochs**: Number of training cycles (recommended: 50-100)
   - **Batch Size**: Images processed at once (adjust based on available memory)
   - **Processing Unit**: GPU (faster) or CPU (compatible with all systems)
   - **Advanced Options**: Learning rate, image size, validation split

### 3. Start Training

Click the "Start Training" button to begin the training process. The system will:

1. Check server status
2. Validate training prerequisites
3. Prepare training data
4. Start the training process

### 4. Monitor Progress

The training progress will be displayed in real-time, showing:
- Current status (preparing, training, validating, completed)
- Percentage complete
- Most recent update

### 5. Use Trained Models

Once training completes, your model will appear in the "Trained Models" section where you can:
- Export the model for external use
- Activate it for automated annotation
- Delete it if no longer needed

## Troubleshooting

### Common Issues

#### Cannot Start Training

- **Solution**: Ensure the detection server is running by checking the status indicator
- **Fix**: Click "Start Server" button to manually start the server

#### Training Fails with GPU Errors

- **Solution**: Switch to CPU mode in the training configuration
- **Fix**: Select "CPU" as the processing unit to avoid CUDA errors

#### No Model Generated After Training

- **Cause**: Insufficient training data or invalid annotations
- **Fix**: Ensure you have at least 10-20 well-annotated images in your project

#### Detection Server Not Starting

- **Solution**: Check the troubleshooting tips in the server status panel
- **Fix**: Ensure Python environment is correctly set up with required dependencies

## Advanced Configuration

For advanced users, additional training parameters can be modified in the "Advanced Options" section:

- **Learning Rate**: Adjusts how quickly the model learns (lower values are more stable but slower)
- **Image Size**: The resolution at which training is performed (higher values may improve accuracy but require more memory)
- **Validation Split**: Percentage of data to use for validation during training
