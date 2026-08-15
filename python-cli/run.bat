@echo off
cd /d "%~dp0"
python tracker.py
if errorlevel 1 pause
