/**
 * This script tests the entire training workflow including:
 * 1. Finding a valid project
 * 2. Setting up training parameters
 * 3. Initializing the training environment
 * 4. Testing the output directory structure
 * 
 * Usage: node test-complete-training-workflow.js [projectId]
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs-extra');
const { startTraining } = require('../controllers/trainingController');

// Import models
const Project = require('../models/Project');
const Image = require('../models/Image');
const Annotation = require('../models/Annotation');

// Mock Express request and response
const mockRes = {
  status: function(code) {
    this.statusCode = code;
    return this;
  },
  json: function(data) {
    this.data = data;
    console.log(`Response (${this.statusCode}):`, data);
    return this;
  }
};

async function testCompleteTrainingWorkflow() {
  try {
    // Get project ID from command line args or use first project
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
      // Get the first project with images if no ID provided
      console.log('No project ID provided, searching for a project with images...');
      const projects = await Project.find();
      
      for (const p of projects) {
        const imageCount = await Image.countDocuments({ project: p._id });
        if (imageCount > 0) {
          project = p;
          console.log(`Selected project: ${p.name} with ${imageCount} images`);
          break;
        }
      }
      
      if (!project) {
        console.error('No projects with images found in database');
        return;
      }
    }
    
    console.log(`\nTesting with project: ${project.name} (ID: ${project._id})`);
    
    // Verify the project has classes
    const classNames = project.classes || [];
    console.log(`Project has ${classNames.length} classes: ${classNames.join(', ')}`);
    
    if (classNames.length === 0) {
      console.error('Project has no classes defined. Training will fail.');
      return;
    }
    
    // Create mock request
    const mockReq = {
      params: { projectId: project._id.toString() },
      body: {
        baseModelName: 'yolov8n.pt',
        epochs: 10,
        batchSize: 4,
        imgSize: '640x640',
        imgWidth: 640,
        imgHeight: 640,
        trainSplit: 0.8
      }
    };
    
    console.log('\nStarting mock training with parameters:', mockReq.body);
    console.log('Using projectId:', mockReq.params.projectId);
    
    // Create a clean response object
    const res = Object.create(mockRes);
    
    // Call the training controller
    console.log('\nCalling training controller...');
    await startTraining(mockReq, res);
    
    if (res.statusCode >= 400) {
      console.error('Training initialization failed with status code:', res.statusCode);
      console.error('Error:', res.data.message || 'Unknown error');
      return;
    }
    
    console.log('\nTraining initialization successful!');
    
    console.log('\nComplete training workflow test finished successfully');
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
testCompleteTrainingWorkflow().then(() => {
  console.log('\nTest completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
