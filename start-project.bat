@echo off
setlocal EnableExtensions

rem Run this file from any folder or drive. All project paths are relative to this file.
pushd "%~dp0"
set "PROJECT_ROOT=%CD%"
set "BACKEND_DIR=%PROJECT_ROOT%\backend"
set "FRONTEND_DIR=%PROJECT_ROOT%\frontend"
set "PYTHON_CMD="

title RailSync AI Launcher
echo.
echo Starting RailSync AI...
echo Project: %PROJECT_ROOT%
echo.

if not exist "%BACKEND_DIR%\app\main.py" (
    echo [ERROR] Backend files were not found.
    goto :failed
)
if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Frontend files were not found.
    goto :failed
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js/npm is required. Install Node.js LTS and run this file again.
    goto :failed
)

where python >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=python"
if not defined PYTHON_CMD (
    where py >nul 2>&1
    if not errorlevel 1 set "PYTHON_CMD=py -3"
)
if not defined PYTHON_CMD (
    echo [ERROR] Python 3 is required. Install Python 3.11+ and run this file again.
    goto :failed
)

if not exist "%BACKEND_DIR%\venv\Scripts\python.exe" (
    echo [SETUP] Creating the backend Python environment...
    pushd "%BACKEND_DIR%"
    %PYTHON_CMD% -m venv venv
    if errorlevel 1 (
        popd
        echo [ERROR] Could not create the backend Python environment.
        goto :failed
    )
    popd
    set "INSTALL_BACKEND=1"
)

if defined INSTALL_BACKEND (
    echo [SETUP] Installing backend dependencies...
    "%BACKEND_DIR%\venv\Scripts\python.exe" -m pip install -r "%BACKEND_DIR%\requirements.txt"
    if errorlevel 1 (
        echo [ERROR] Backend dependency installation failed.
        goto :failed
    )
)

if not exist "%FRONTEND_DIR%\node_modules" (
    echo [SETUP] Installing frontend dependencies...
    pushd "%FRONTEND_DIR%"
    call npm install
    if errorlevel 1 (
        popd
        echo [ERROR] Frontend dependency installation failed.
        goto :failed
    )
    popd
)

start "RailSync AI Backend" /D "%BACKEND_DIR%" cmd /k ""%BACKEND_DIR%\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
start "RailSync AI Frontend" /D "%FRONTEND_DIR%" cmd /k "npm run dev -- --hostname 0.0.0.0 --port 3000"

echo.
echo Backend:  http://localhost:8000
echo API docs: http://localhost:8000/docs
echo Frontend: http://localhost:3000
echo.
echo The backend and frontend are running in separate windows.
popd
pause
exit /b 0

:failed
echo.
echo Setup could not be completed. Fix the error above and try again.
popd
pause
exit /b 1
