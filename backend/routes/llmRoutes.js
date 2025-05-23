const express = require('express');
const router = express.Router();
const llmController = require('../controllers/llmController');
const { protect } = require('../middleware/authMiddleware');

// Route for naming annotations with LLM
router.post('/name-annotations', protect, llmController.nameAnnotations);

module.exports = router;
