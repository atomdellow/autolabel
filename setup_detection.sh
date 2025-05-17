#!/bin/bash
# Setup script for AutoLabel Python dependencies
# This installs the necessary packages for the object detection feature

set -e # Exit on first error

echo -e "\e[32mSetting up Python environment for AutoLabel object detection...\e[0m"

# Check if Python is installed
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
    echo -e "\e[32mFound $(python3 --version)\e[0m"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
    echo -e "\e[32mFound $(python --version)\e[0m"
else
    echo -e "\e[31mPython is not installed or not in PATH. Please install Python 3.8 or higher.\e[0m"
    echo -e "\e[33mDownload from: https://www.python.org/downloads/\e[0m"
    exit 1
fi

# Check if pip is installed
if command -v pip3 &> /dev/null; then
    PIP_CMD="pip3"
    echo -e "\e[32mFound pip: $(pip3 --version)\e[0m"
elif command -v pip &> /dev/null; then
    PIP_CMD="pip"
    echo -e "\e[32mFound pip: $(pip --version)\e[0m"
else
    echo -e "\e[31mpip is not installed or not in PATH. It usually comes with Python.\e[0m"
    exit 1
fi

# Install required packages
echo -e "\n\e[32mInstalling required Python packages...\e[0m"
REQUIREMENTS_FILE="$(dirname "$0")/AutoDesktopVisionApi/requirements.txt"

if [ -f "$REQUIREMENTS_FILE" ]; then
    echo -e "\e[33mInstalling from: $REQUIREMENTS_FILE\e[0m"
    $PYTHON_CMD -m $PIP_CMD install -r "$REQUIREMENTS_FILE"
    
    if [ $? -eq 0 ]; then
        echo -e "\n\e[32mPackages installed successfully!\e[0m"
    else
        echo -e "\n\e[31mFailed to install packages. Please check the error messages above.\e[0m"
        exit 1
    fi
else
    echo -e "\e[31mRequirements file not found at: $REQUIREMENTS_FILE\e[0m"
    exit 1
fi

# Download YOLOv8 model if it doesn't exist
MODEL_PATH="$(dirname "$0")/AutoDesktopVisionApi/yolov8n.pt"

if [ ! -f "$MODEL_PATH" ]; then
    echo -e "\n\e[32mDownloading YOLOv8 model...\e[0m"
    $PYTHON_CMD -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
    
    if [ $? -eq 0 ]; then
        echo -e "\e[32mYOLOv8 model downloaded successfully!\e[0m"
    else
        echo -e "\e[31mFailed to download YOLOv8 model. Please check the error messages above.\e[0m"
        exit 1
    fi
else
    echo -e "\n\e[32mYOLOv8 model already exists at: $MODEL_PATH\e[0m"
fi

echo -e "\n\e[32mSetup completed successfully!\e[0m"
echo -e "\e[33mThe detection feature is now integrated with the main backend.\e[0m"
echo -e "\e[33mTo start the application, run:\e[0m"
echo -e "\e[36m  1. Start the backend: cd backend && npm run dev\e[0m"
echo -e "\e[36m  2. Start the frontend: cd frontend && npm run dev\e[0m"
echo
echo -e "\e[36mThe detection API will be available at: http://localhost:5001/api/detection/detect\e[0m"
