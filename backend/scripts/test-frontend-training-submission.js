/**
 * This script simulates a training form submission from the frontend
 * It uses axios to make a direct API call to the training controller
 * 
 * Usage: node test-frontend-training-submission.js <projectId>
 */

const axios = require('axios');
const mongoose = require('mongoose');
const Project = require('../models/Project');

async function testFrontendTrainingSubmission() {
  try {
    // Get project ID from command line args or use first project
    const projectId = process.argv[2] || null;
    
    console.log('Connecting to MongoDB to find a valid project...');
    await mongoose.connect('mongodb://localhost:27017/autolabel');
    
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
    
    console.log(`Using project: ${project.name} (ID: ${project._id})`);
    
    // Create training config similar to what frontend would send
    const trainingConfig = {
      baseModelName: 'yolov8n.pt',
      epochs: 10,
      batchSize: 4,
      imgSize: '640x640',
      imgWidth: 640,
      imgHeight: 640,
      trainSplit: 0.8,
      useGPU: false
    };
    
    console.log('Simulating frontend form submission with config:', trainingConfig);
    
    // Make API call directly
    const response = await axios.post(
      `http://localhost:5001/api/training/project/${project._id}/start`,
      trainingConfig,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('API Response Status:', response.status);
    console.log('API Response Data:', response.data);
    
    console.log('\nFrontend simulation test completed successfully!');
    
  } catch (error) {
    console.error('Error during test:', error.response ? error.response.data : error);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    console.log('Database connection closed');
  }
}

// Run the test
testFrontendTrainingSubmission().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
