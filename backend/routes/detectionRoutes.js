const express = require('express');
const router = express.Router();
const { detectObjects, compareScreenshots } = require('../controllers/detectionController');

// Object detection endpoint
router.post('/detect', detectObjects);

// Compare screenshots endpoint
router.post('/compare', compareScreenshots);

module.exports = router;
