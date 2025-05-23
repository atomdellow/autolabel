# LLM-Powered Annotation Naming

This document provides instructions for testing and troubleshooting the LLM-powered annotation naming feature in the AutoLabel application.

## Overview

The AI annotation naming feature uses OpenAI's GPT-4 Vision API to automatically name annotations based on their visual content. It:

1. Crops each annotation from the main image
2. Sends these crops to GPT-4 Vision API
3. Analyzes the content of each annotation
4. Generates descriptive names in the format "element_type: name"
5. Updates the annotations with these generated names

## Requirements

- OpenAI API key with access to GPT-4 Vision model
- Python 3.8+ with required packages (openai, pillow, requests, python-dotenv)
- Properly configured .env file with OPENAI_API_KEY

## Setup Instructions

1. Ensure your OpenAI API key is set in the backend `.env` file:
   ```
   OPENAI_API_KEY=your_key_here
   ```

2. Install required Python packages:
   ```
   cd AutoDesktopVisionApi
   pip install -r requirements.txt
   ```

3. Verify your setup using the provided diagnostic tool:
   ```
   cd AutoDesktopVisionApi
   python fix_llm_vision_setup.py
   ```

4. Test the annotation naming with a sample:
   ```
   cd AutoDesktopVisionApi
   python test_annotation_naming.py
   ```

## Using the Feature

1. Upload an image to your project
2. Create annotations on the image (manually or using detection)
3. Click the "Name Annotations with AI" button in the Raw Data section
4. Wait for the process to complete (it may take a few seconds per annotation)
5. Your annotations will be updated with AI-generated names

## Troubleshooting

If you encounter issues with the annotation naming feature:

1. Check the browser console for error messages
2. Verify your OpenAI API key is valid and has access to GPT-4 Vision
3. Run the diagnostic tool to identify and fix common issues:
   ```
   python fix_llm_vision_setup.py
   ```
4. Ensure your image URLs are accessible to the backend server
5. Check that annotations have valid coordinates

Common errors:
- "Missing OpenAI API key" - Add your API key to the backend .env file
- "Failed to load image" - Ensure the image URL is accessible
- "Invalid annotation format" - Check annotation coordinates

## Enhancement Ideas

Future improvements could include:
- Batch processing to speed up naming of multiple annotations
- Custom prompts for specific annotation types
- Fine-tuning for better recognition of domain-specific elements
- Caching results to avoid redundant API calls
- Support for more LLM providers beyond OpenAI
