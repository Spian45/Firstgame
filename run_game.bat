@echo off
title United Realm: Spirit of the Twilight Vale
echo ========================================================
echo   United Realm: Spirit of the Twilight Vale
echo   Starting local server...
echo ========================================================
start "" http://localhost:8000
python "%~dp0tools\serve.py" 8000
pause
