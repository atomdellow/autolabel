# Restart development servers with clean cache
# This script helps resolve issues with module loading and environment variables

# Stop any running processes on ports 5001 and 5173
Write-Host "Stopping any processes on ports 5001 and 5173..." -ForegroundColor Yellow
$port5001 = netstat -ano | Select-String "5001" | ForEach-Object { $_ -replace '\s+', ' ' } | ForEach-Object { $_.Split(' ')[5] }
$port5173 = netstat -ano | Select-String "5173" | ForEach-Object { $_ -replace '\s+', ' ' } | ForEach-Object { $_.Split(' ')[5] }

if ($port5001) {
    Write-Host "Stopping process on port 5001 (PID: $port5001)..." -ForegroundColor Cyan
    Stop-Process -Id $port5001 -Force -ErrorAction SilentlyContinue
}

if ($port5173) {
    Write-Host "Stopping process on port 5173 (PID: $port5173)..." -ForegroundColor Cyan
    Stop-Process -Id $port5173 -Force -ErrorAction SilentlyContinue
}

# Clean cache directories
Write-Host "Cleaning frontend cache..." -ForegroundColor Yellow
if (Test-Path ".\frontend\node_modules\.vite") {
    Remove-Item -Recurse -Force ".\frontend\node_modules\.vite" -ErrorAction SilentlyContinue
}

# Start backend server in a new window
Write-Host "Starting backend server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run secure-dev"

# Wait a moment for backend to initialize
Start-Sleep -Seconds 2

# Start frontend in a new window
Write-Host "Starting frontend development server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev"

Write-Host "Development servers started successfully!" -ForegroundColor Green
Write-Host "Backend: http://localhost:5001" -ForegroundColor Yellow
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Yellow
