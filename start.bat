@echo off
REM ----------------------------------------------------------------
REM  Double-click this file to rebuild the site and start a local
REM  preview server. It opens http://localhost:8000 in your browser.
REM  Press Ctrl+C (or just close this window) to stop the server.
REM ----------------------------------------------------------------
cd /d "%~dp0"

echo Rebuilding data.js from the projects folder...
python generate_manifest.py
if errorlevel 1 (
  echo.
  echo Could not run the generator. Is Python installed and on your PATH?
  pause
  exit /b 1
)

echo.
echo Starting server at http://localhost:8000  (Ctrl+C to stop)
start "" "http://localhost:8000"
python -m http.server 8000
