#!/bin/bash

echo "Starting AutoLabel Detection Server..."
echo
echo "This server provides AI-powered shape detection functionality using YOLOv8"
echo

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python is not installed or not in PATH! Please install Python 3.8 or later."
    read -p "Press Enter to exit..."
    exit 1
fi

echo "Checking and installing required packages..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"
python3 -m pip install -r requirements.txt

echo
echo "Detection server has been integrated into the main backend."
echo "No need to start a separate server anymore!"
echo "Please run the main Node.js server with: npm run dev"
echo "The detection endpoint is available at: http://localhost:5001/api/detection/detect"
echo

echo "This script is kept for backward compatibility."
read -p "Press Enter to continue..."
