# AutoLabel Application - Enhanced Features

## New Features Added

### 1. LLM Vision Model Integration
The application now includes GPT-4 Vision for more accurate UI element detection. This model can identify and label UI components with high precision.

#### How to use:
1. Select "LLM Vision (GPT-4V)" from the Detection Method dropdown
2. Adjust the "Max Elements" slider to control how many elements the model will detect
3. Click the "Detect Shapes" button to start detection

#### Requirements:
- Valid OpenAI API key configured in the backend `.env` file
- For optimal results, use clear screenshots of UI interfaces

### 2. LLM-Based Automatic Naming
This feature allows you to automatically name existing annotations using the OpenAI Vision API.

#### How to use:
1. Create or select annotations on your image
2. Select one or more annotations by checking the boxes next to them
3. Click "Auto-Name Selected" to name just the selected annotations
4. Alternatively, click "Auto-Name All" to name all annotations in the current image

The AI will analyze the image content within each annotation and assign appropriate labels.

### 3. Raw Data Access Improvements
We've enhanced the raw data display functionality for better usability.

#### How to use:
1. Click "Show Raw Data" to view the JSON representation of all annotations
2. Use the "Copy JSON" button to copy the data to your clipboard
3. Click "Hide Raw Data" to collapse the section

## Setup Instructions

### Backend Configuration
1. Create a `.env` file in the `backend` directory with your OpenAI API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

2. Create a `.env` file in the `AutoDesktopVisionApi` directory with the same API key:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

3. Start the backend server:
   ```
   cd backend
   npm start
   ```

### Frontend Configuration
1. Start the frontend development server:
   ```
   cd frontend
   npm run dev
   ```

2. Access the application at http://localhost:5173

## Troubleshooting
- If detection or auto-naming fails, check that your OpenAI API key is valid and has access to the GPT-4 Vision model
- For large images, you may need to adjust the maxElements parameter for optimal performance
- If raw data isn't displaying correctly, try refreshing the page or clearing your browser cache
