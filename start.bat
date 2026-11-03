@echo off
title Stella Sora Tools - Dev Server
cd /d "%~dp0"

echo ========================================================
echo        Starting Stella Sora Tools (Next.js)
echo ========================================================
echo.

:: Launch the default browser to the builder page after a short 3-second delay in background
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:3000/builder"

:: Start the Next.js development server
npm run dev
