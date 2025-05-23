const mongoose = require('mongoose');
const path = require('path');

// Use absolute paths to ensure correct module loading
const Project = require(path.join(__dirname, '..', 'models', 'Project'));
const Image = require(path.join(__dirname, '..', 'models', 'Image'));
const Annotation = require(path.join(__dirname, '..', 'models', 'Annotation'));

async function testDatabaseConnections() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect('mongodb://localhost:27017/autolabel');
    console.log('Connected to MongoDB successfully');
    
    // Find all projects
    const projects = await Project.find();
    console.log(`Found ${projects.length} projects`);
    
    if (projects.length > 0) {
      const project = projects[0];
      console.log(`Testing with project: ${project.name} (ID: ${project._id})`);
      
      // Find images for this project
      const images = await Image.find({ project: project._id });
      console.log(`Found ${images.length} images for project ${project._id}`);
      
      if (images.length > 0) {
        const image = images[0];
        console.log(`Testing with image: ${image.name} (ID: ${image._id})`);
        
        // Find annotations for this image
        const annotations = await Annotation.find({ 
          image: image._id, 
          project: project._id 
        });
        console.log(`Found ${annotations.length} annotations for image ${image._id}`);
        
        if (annotations.length > 0) {
          console.log('Sample annotation:', {
            label: annotations[0].label,
            x: annotations[0].x,
            y: annotations[0].y,
            width: annotations[0].width,
            height: annotations[0].height
          });
        }
      }
    }
    
    console.log('Database connection test completed successfully');  } catch (error) {
    console.error('Error during database test:', error);
  } finally {
    try {
      // Close the mongoose connection
      if (mongoose.connection.readyState !== 0) { // 0 = disconnected
        await mongoose.connection.close(false); // false = don't force close
      }
      console.log('Database connection closed');
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
}

// Run the test
testDatabaseConnections().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
