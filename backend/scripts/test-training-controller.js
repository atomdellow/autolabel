/**
 * Training Controller Test Utility
 * 
 * This script helps test the functionality of the training controller
 * with a valid project ID from your database.
 * 
 * Usage: node test-training-controller.js <projectId>
 * If no projectId is provided, it will use the first project found in the database.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;

// Import models
const Project = require(path.join(__dirname, '..', 'models', 'Project'));
const Image = require(path.join(__dirname, '..', 'models', 'Image'));
const Annotation = require(path.join(__dirname, '..', 'models', 'Annotation'));

async function testTrainingController() {
  try {
    // Get project ID from command line or use first project
    const projectId = process.argv[2] || null;
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/autolabel');
    console.log('Connected to MongoDB successfully');
    
    let project;
    
    if (projectId) {
      // Find specific project
      console.log(`Looking for project with ID: ${projectId}`);
      project = await Project.findById(projectId);
      
      if (!project) {
        console.error(`Project not found with ID: ${projectId}`);
        return;
      }
    } else {
      // Get the first project if no ID provided
      const projects = await Project.find();
      if (projects.length === 0) {
        console.error('No projects found in database');
        return;
      }
      project = projects[0];
    }
    
    console.log(`Testing with project: ${project.name} (ID: ${project._id})`);
    
    // Get images for this project
    console.log(`Looking for images with project: ${project._id}`);
    const allProjectImages = await Image.find({ project: project._id });
    console.log(`Found ${allProjectImages.length} images for project ${project._id}`);
    
    if (allProjectImages.length === 0) {
      console.error('No images found for this project. Cannot proceed with training.');
      return;
    }
    
    // Print information about the first few images
    console.log('\nSample images:');
    const sampleSize = Math.min(allProjectImages.length, 3);
    for (let i = 0; i < sampleSize; i++) {
      const image = allProjectImages[i];
      console.log(`[${i+1}] ${image.name} (ID: ${image._id}, Path: ${image.path})`);
      
      // Check for annotations
      const annotations = await Annotation.find({ image: image._id, project: project._id });
      console.log(`    - Found ${annotations.length} annotations`);
      
      // Print sample annotation if any
      if (annotations.length > 0) {
        console.log(`    - Sample annotation: ${annotations[0].label} at x:${annotations[0].x}, y:${annotations[0].y}`);
      }
    }
    
    // Validate project has classes defined
    const classNames = project.classes || [];
    console.log(`\nProject has ${classNames.length} classes defined: ${classNames.join(', ')}`);
    
    if (classNames.length === 0) {
      console.warn('WARNING: Project has no classes defined. Training will fail.');
    }
    
    console.log('\nTraining Controller Test completed successfully');
    console.log('\nTo start training, use this project ID in your form: ' + project._id);
    
  } catch (error) {
    console.error('Error during test:', error);
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
testTrainingController().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
