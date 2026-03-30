@echo off
echo ====================================
echo  🐸 Scribe TTS Server (Coqui TTS)
echo ====================================
echo.

REM Activate virtual environment
call "%~dp0.venv\Scripts\activate.bat"

REM Accept Coqui TOS
set COQUI_TOS_AGREED=1

REM Start server
echo Starting TTS server on http://localhost:8100 ...
echo API docs: http://localhost:8100/docs
echo.
python "%~dp0server.py"

pause
