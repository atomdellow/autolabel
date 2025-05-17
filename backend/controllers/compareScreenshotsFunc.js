/**
 * Compare two screenshots to detect changes between them using SSIM
 */
exports.compareScreenshots = async (req, res) => {
  try {
    const { screenshot1, screenshot2 } = req.body;
    
    if (!screenshot1 || !screenshot2) {
      return res.status(400).json({ error: "Need both screenshots for comparison" });
    }
    
    // Path to the Python script - use the fixed version
    const pythonScriptPath = path.join(__dirname, '..', '..', 'AutoDesktopVisionApi', 'compare_images.py');
    
    if (!fs.existsSync(pythonScriptPath)) {
      console.error(`Comparison script not found at path: ${pythonScriptPath}`);
      return res.status(500).json({ error: "Comparison script not found. Please ensure the AutoDesktopVisionApi folder is properly set up." });
    }
    
    // Save screenshots to temp files
    const tempFile1 = path.join(__dirname, '..', 'temp_image1.txt');
    const tempFile2 = path.join(__dirname, '..', 'temp_image2.txt');
    
    fs.writeFileSync(tempFile1, screenshot1);
    fs.writeFileSync(tempFile2, screenshot2);
    
    // Spawn Python process for comparison
    const pythonProcess = spawn('python', [
      pythonScriptPath,
      '--base64_file1', tempFile1,
      '--base64_file2', tempFile2
    ]);
    
    let outputData = '';
    let errorData = '';
    
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString();
      console.error(`Python stderr: ${data}`);
    });
    
    pythonProcess.on('close', (code) => {
      // Clean up temp files
      try {
        fs.unlinkSync(tempFile1);
        fs.unlinkSync(tempFile2);
      } catch (err) {
        console.warn('Failed to clean up temp files:', err);
      }
      
      if (code !== 0) {
        console.error(`Python script error: ${errorData}`);
        return res.status(500).json({ error: `Comparison script error (exit code ${code}): ${errorData}` });
      }
      
      try {
        // Parse the JSON output from the Python script
        const comparisonResults = JSON.parse(outputData);
        return res.json(comparisonResults);
      } catch (err) {
        console.error('Error parsing Python output:', err);
        return res.status(500).json({ error: `Failed to parse comparison results: ${err.message}` });
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      return res.status(500).json({ error: `Failed to start comparison process: ${err.message}` });
    });
  } catch (err) {
    console.error('Unexpected error in comparison controller:', err);
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
};
