@echo off
rem Double-click: export every art\ren\*.aseprite into the game's sprite sheets
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0export.ps1"
pause
