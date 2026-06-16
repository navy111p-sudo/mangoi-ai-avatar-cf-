@echo off
setlocal
cd /d "%~dp0"

REM === Remove old/unused files from the avatar app folder (safe) ===
REM These were from earlier versions and are no longer used:
REM  - functions/api/chat.js : old Gemini Pages Function (now using src/index.js Worker)
REM  - integration/*         : outdated embed reference (widget is now in the homepage directly)
REM  - embed-snippet.html    : outdated embed snippet
REM  - .dev.vars.example     : old Gemini local-var sample

echo Cleaning up unused old files...

if exist "functions\api\chat.js" del /q "functions\api\chat.js"
if exist "functions\api" rmdir "functions\api"
if exist "functions" rmdir "functions"

if exist "integration" (
  del /q "integration\*.*"
  rmdir "integration"
)

if exist "embed-snippet.html" del /q "embed-snippet.html"
if exist ".dev.vars.example" del /q ".dev.vars.example"

echo.
echo Done. Unused files removed.
echo (Kept: src/, public/, wrangler.toml, package.json, README.md, deploy .bat scripts)
echo.
pause
