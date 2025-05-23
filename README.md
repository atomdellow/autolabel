# AutoLabel

Part of the Autobots collection, AutoLabel enables users to create annotations and labels for AI training data with various powerful features.

## Features

- Rectangle annotation tool for drawing bounding boxes
- AI-powered automatic shape detection using YOLOv8
- Undo/redo functionality for all annotation actions
- Image tagging support
- Project-based organization
- Export annotations for AI training
- Custom model training and automatic annotation
- Detection server status monitoring and management

## Getting Started

### Prerequisites

- Node.js (v14+) for the frontend and backend
- Python 3.8+ for the integrated shape detection feature
- MongoDB for data storage

### Installation

1. **Set up Python dependencies for object detection:**

**Windows:**
```powershell
.\setup_detection.ps1
```

**Linux/macOS:**
```bash
chmod +x setup_detection.sh
./setup_detection.sh
```

2. **Set up the backend:**

```bash
cd backend
npm install
npm start
```

3. **Set up the frontend:**

```bash
cd frontend
npm install
npm run dev
```

The object detection feature is now integrated directly into the Node.js backend. You don't need to run a separate detection server.

## Using Shape Detection

The "Detect Shapes" feature uses YOLOv8 to automatically identify and annotate objects in your images:

1. Open an image in the annotation editor
2. Click the "Detect Shapes" button in the toolbar
3. Wait for the AI to process the image
4. Review and edit the automatically created annotations

Note: The detection feature is integrated directly into the main backend (running at http://localhost:5001) - no separate detection server is needed.
