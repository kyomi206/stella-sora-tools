@echo off
title Stella Sora Tools - Dev Server
cd /d "%~dp0"

echo ========================================================
echo        Starting Stella Sora Tools (Next.js)
echo ========================================================
echo.

:: Launch browser in background after 3 seconds
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000"

:: Start Next.js development server
npm run dev
