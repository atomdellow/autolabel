@echo off
echo Starting AutoLabel Detection Server...
echo.
echo This server provides AI-powered shape detection functionality using YOLOv8
echo.

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Python is not installed or not in PATH! Please install Python 3.8 or later.
    pause
    exit /b 1
)

echo Checking and installing required packages...
cd %~dp0
python -m pip install -r requirements.txt

echo.
echo Detection server has been integrated into the main backend.
echo No need to start a separate server anymore!
echo Please run the main Node.js server with: npm run dev
echo The detection endpoint is available at: http://localhost:5001/api/detection/detect
echo.

echo This batch file is kept for backward compatibility.
pause

pause
