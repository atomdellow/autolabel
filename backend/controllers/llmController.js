// LLM Controller for handling AI-powered features
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Name annotations using LLM Vision API
 * This uses the GPT-4 Vision API to analyze image regions and generate appropriate names
 */
exports.nameAnnotations = async (req, res) => {
  try {
    const { imageUrl, annotations } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({ error: "No image URL provided" });
    }
    
    if (!annotations || !Array.isArray(annotations) || annotations.length === 0) {
      return res.status(400).json({ error: "No annotations provided or invalid format" });
    }
    
    // Path to the LLM vision detector Python script
    const pythonScriptPath = path.join(__dirname, '..', '..', 'AutoDesktopVisionApi', 'llm_vision_detector.py');
    
    if (!fs.existsSync(pythonScriptPath)) {
      console.error(`LLM vision script not found at path: ${pythonScriptPath}`);
      return res.status(500).json({ 
        error: "LLM vision script not found. Please ensure the AutoDesktopVisionApi folder is properly set up."
      });
    }
    
    // Prepare a temporary file with the image and annotation data
    const tempDataFile = path.join(__dirname, '..', 'temp_annotation_data.json');
    fs.writeFileSync(tempDataFile, JSON.stringify({
      imageUrl,
      annotations
    }));
    
    // Prepare arguments for the Python script
    const args = [
      '--annotations_file', tempDataFile,
      '--name_annotations'
    ];
    
    // Spawn Python process
    console.log(`Spawning Python process for LLM annotation naming: python ${pythonScriptPath} ${args.join(' ')}`);
    
    const pythonProcess = spawn('python', [pythonScriptPath, ...args]);
    
    let dataFromPython = '';
    let errorFromPython = '';
    
    pythonProcess.stdout.on('data', (data) => {
      dataFromPython += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorFromPython += data.toString();
      console.error(`Python error (LLM annotation naming): ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempDataFile);
      } catch (err) {
        console.warn(`Failed to delete temp file ${tempDataFile}:`, err);
      }
      
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`);
        console.error('Error output:', errorFromPython);
        return res.status(500).json({ 
          error: "Failed to process annotations with LLM",
          details: errorFromPython
        });
      }
      
      try {
        const result = JSON.parse(dataFromPython);
        return res.json(result);
      } catch (err) {
        console.error('Failed to parse Python output:', err);
        console.error('Raw output:', dataFromPython);
        return res.status(500).json({ 
          error: "Failed to parse LLM output",
          details: dataFromPython
        });
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      return res.status(500).json({ 
        error: "Failed to start detection process. Please ensure Python is installed with required packages."
      });
    });
    
  } catch (error) {
    console.error('Error in LLM annotation naming:', error);
    return res.status(500).json({ 
      error: "Internal server error during LLM annotation naming",
      details: error.message
    });
  }
};
