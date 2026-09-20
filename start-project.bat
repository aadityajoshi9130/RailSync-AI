@echo off
setlocal

set "PROJECT_ROOT=%~dp0"

echo Starting RailSync Ai...

start "RailSync Backend" /D "%PROJECT_ROOT%backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
start "RailSync Frontend" /D "%PROJECT_ROOT%frontend" cmd /k "npm run dev -- --hostname 0.0.0.0 --port 3000"

echo.
echo Backend:  http://localhost:8000
echo API docs: http://localhost:8000/docs
echo Frontend: http://localhost:3000
echo.
echo The backend and frontend are running in separate windows.

endlocal
