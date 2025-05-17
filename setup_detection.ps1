# Setup script for AutoLabel Python dependencies
# This installs the necessary packages for the object detection feature

$ErrorActionPreference = "Stop" # Stop on first error

Write-Host "Setting up Python environment for AutoLabel object detection..." -ForegroundColor Green

# Check if Python is installed
try {
    $pythonVersion = python --version
    Write-Host "Found $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "Python is not installed or not in PATH. Please install Python 3.8 or higher." -ForegroundColor Red
    Write-Host "Download from: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Check if pip is installed
try {
    $pipVersion = pip --version
    Write-Host "Found pip: $pipVersion" -ForegroundColor Green
} catch {
    Write-Host "pip is not installed or not in PATH. It usually comes with Python." -ForegroundColor Red
    exit 1
}

# Install required packages
Write-Host "`nInstalling required Python packages..." -ForegroundColor Green
$requirementsFile = Join-Path $PSScriptRoot "AutoDesktopVisionApi\requirements.txt"

if (Test-Path $requirementsFile) {
    Write-Host "Installing from: $requirementsFile" -ForegroundColor Yellow
    python -m pip install -r $requirementsFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`nPackages installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "`nFailed to install packages. Please check the error messages above." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Requirements file not found at: $requirementsFile" -ForegroundColor Red
    exit 1
}

# Download YOLOv8 model if it doesn't exist
$modelPath = Join-Path $PSScriptRoot "AutoDesktopVisionApi\yolov8n.pt"

if (-not (Test-Path $modelPath)) {
    Write-Host "`nDownloading YOLOv8 model..." -ForegroundColor Green
    python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "YOLOv8 model downloaded successfully!" -ForegroundColor Green
    } else {
        Write-Host "Failed to download YOLOv8 model. Please check the error messages above." -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "`nYOLOv8 model already exists at: $modelPath" -ForegroundColor Green
}

Write-Host "`nSetup completed successfully!" -ForegroundColor Green
Write-Host "The detection feature is now integrated with the main backend." -ForegroundColor Yellow
Write-Host "To start the application, run:" -ForegroundColor Yellow
Write-Host "  1. Start the backend: cd backend && npm run dev" -ForegroundColor Cyan
Write-Host "  2. Start the frontend: cd frontend && npm run dev" -ForegroundColor Cyan
Write-Host
Write-Host "The detection API will be available at: http://localhost:5001/api/detection/detect" -ForegroundColor Cyan
