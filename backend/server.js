const dotenv = require('dotenv');
const path = require('path'); // Required for serving static files
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Load environment variables with explicit path
dotenv.config({ path: path.resolve(__dirname, '.env') });

// IMPORTANT: Always ensure JWT_SECRET is set
// If it's not loaded from .env, use a hardcoded value for development
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = '93d0e8c755b994ff1e53fe69f73b6fdb78fa834c91319453e5854f2b3d067e4a';
    console.log('JWT_SECRET not found in .env, using hardcoded value for development');
}

// Log critical environment variables (without exposing full secrets)
console.log('Environment Variables Status:');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set ✓' : 'Not set ✗');
console.log('PORT:', process.env.PORT || 'Using default');
console.log('MONGO_URI:', process.env.MONGO_URI ? 'Set ✓' : 'Using default');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for large base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // Increased limit for large base64 images

// Add middleware to debug incoming requests (for troubleshooting)
app.use((req, res, next) => {
    if (req.path.includes('/training/project') && req.method === 'POST') {
        console.log('Training request debug:');
        console.log('- Path:', req.path);
        console.log('- Method:', req.method);
        console.log('- Content-Type:', req.headers['content-type']);
        console.log('- Body present:', !!req.body);
    }
    next();
});

// Import Routes
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const imageRoutes = require('./routes/imageRoutes'); // Added this line
const annotationRoutes = require('./routes/annotationRoutes'); // Already added in a previous step, ensure it's here
const trainingRoutes = require('./routes/trainingRoutes'); // Import training routes
const detectionRoutes = require('./routes/detectionRoutes'); // Import detection routes
const llmRoutes = require('./routes/llmRoutes'); // Import LLM routes

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes); // Ensuring this is active
app.use('/api/images', imageRoutes);
app.use('/api/annotations', annotationRoutes); // Ensure this is mounted
app.use('/api/training', trainingRoutes); // Mount training routes
app.use('/api/detection', detectionRoutes); // Mount detection routes
app.use('/api/llm', llmRoutes); // Mount LLM routes

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

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app; // For potential testing
