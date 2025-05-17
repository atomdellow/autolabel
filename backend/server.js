require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path'); // Required for serving static files

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increased limit for large base64 images

// Import Routes
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const imageRoutes = require('./routes/imageRoutes'); // Added this line
const annotationRoutes = require('./routes/annotationRoutes'); // Already added in a previous step, ensure it's here
const trainingRoutes = require('./routes/trainingRoutes'); // Import training routes
const detectionRoutes = require('./routes/detectionRoutes'); // Import detection routes

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes); // Ensuring this is active
app.use('/api/images', imageRoutes);
app.use('/api/annotations', annotationRoutes); // Ensure this is mounted
app.use('/api/training', trainingRoutes); // Mount training routes
app.use('/api/detection', detectionRoutes); // Mount detection routes

// Serve static files from the 'uploads' directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic Route
app.get('/', (req, res) => {
    res.send('AutoLabel Backend API is running!');
});

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/autolabel'; // Default URI if not in .env

mongoose.connect(MONGO_URI)
    .then(() => console.log('Successfully connected to MongoDB'))
    .catch(err => {
        console.error('Connection error', err);
        process.exit(1);
    });

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // For potential testing
