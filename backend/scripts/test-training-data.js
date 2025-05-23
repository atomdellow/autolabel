/**
 * Test script for the training functionality
 * 
 * This script simulates the training controller's process
 * for finding images and annotations for a project.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;

// Import models
const Project = require(path.join(__dirname, '..', 'models', 'Project'));
const Image = require(path.join(__dirname, '..', 'models', 'Image'));
const Annotation = require(path.join(__dirname, '..', 'models', 'Annotation'));

async function testTrainingDataPreparation() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/autolabel');
    console.log('Connected to MongoDB successfully');
    
    // Get the first project
    const projects = await Project.find();
    if (projects.length === 0) {
      console.error('No projects found in database');
      return;
    }
    
    const project = projects[0];
    const projectId = project._id;
    console.log(`Testing with project: ${project.name} (ID: ${projectId})`);
    
    // Get class names from project
    const classNames = project.classes || [];
    console.log(`Project classes: ${classNames.join(', ')}`);
    
    if (classNames.length === 0) {
      console.warn('Project has no classes defined');
    }
    
    // Create class to index map like in the training controller
    const classToIndexMap = classNames.reduce((acc, name, index) => {
      acc[name] = index;
      return acc;
    }, {});
    
    // Find images for this project
    const allProjectImages = await Image.find({ project: projectId });
    console.log(`Found ${allProjectImages.length} images for project ${projectId}`);
    
    if (allProjectImages.length === 0) {
      console.error('No images found for this project');
      return;
    }
    
    // Validate images and check if they exist on disk
    const validImages = [];
    for (const image of allProjectImages) {
      const imagePath = path.join(__dirname, '..', image.path);
      
      try {
        await fs.access(imagePath);
        validImages.push({
          ...image.toObject(),
          absolutePath: imagePath,
          dbPath: image.path
        });
        console.log(`Found valid image: ${image.name} at ${imagePath}`);
      } catch (err) {
        console.warn(`Image file not found: ${imagePath} for image ID ${image._id}`);
      }
    }
    
    console.log(`Valid images with files on disk: ${validImages.length}`);
    
    // Check for annotations for the first valid image
    if (validImages.length > 0) {
      const testImage = validImages[0];
      const annotations = await Annotation.find({ 
        image: testImage._id, 
        project: projectId 
      });
      
      console.log(`Found ${annotations.length} annotations for image ${testImage.name}`);
      
      // Simulate YOLO annotation conversion
      if (annotations.length > 0) {
        const imageWidth = testImage.width;
        const imageHeight = testImage.height;
        
        console.log(`Image dimensions: ${imageWidth}x${imageHeight}`);
        
        let yoloStrings = [];
        let invalidAnnotationsCount = 0;
        
        for (const ann of annotations) {
          if (classToIndexMap[ann.label] === undefined) {
            console.warn(`Label ${ann.label} not in classToIndexMap. Skipping this annotation.`);
            continue;
          }
          
          const classIndex = classToIndexMap[ann.label];
          
          const x = parseFloat(ann.x);
          const y = parseFloat(ann.y);
          const width = parseFloat(ann.width);
          const height = parseFloat(ann.height);
          
          const x_center = (x + width / 2) / imageWidth;
          const y_center = (y + height / 2) / imageHeight;
          const width_norm = width / imageWidth;
          const height_norm = height / imageHeight;
          
          if (x_center < 0 || x_center > 1 || y_center < 0 || y_center > 1 ||
              width_norm <= 0 || width_norm > 1 || height_norm <= 0 || height_norm > 1) {
            console.warn(`Invalid normalized coordinates for annotation ${ann._id}. Skipping.`);
            invalidAnnotationsCount++;
            continue;
          }
          
          yoloStrings.push(`${classIndex} ${x_center.toFixed(6)} ${y_center.toFixed(6)} ${width_norm.toFixed(6)} ${height_norm.toFixed(6)}`);
        }
        
        console.log(`Generated ${yoloStrings.length} valid YOLO format annotations`);
        if (invalidAnnotationsCount > 0) {
          console.warn(`Found ${invalidAnnotationsCount} invalid annotations that would be skipped`);
        }
        
        if (yoloStrings.length > 0) {
          console.log('Sample YOLO annotation:');
          console.log(yoloStrings[0]);
        }
      }
    }
    
    console.log('Training data preparation test completed successfully');
  } catch (error) {
    console.error('Error during training data preparation test:', error);
  } finally {
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close(false);
      }
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
}

// Run the test
testTrainingDataPreparation().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
