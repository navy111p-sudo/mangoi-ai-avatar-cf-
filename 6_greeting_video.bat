@echo off
REM ============================================================
REM  Set the AI Operations Assistant greeting video.
REM  HOW TO USE: drag your greeting .mp4 file ONTO this .bat
REM  (drag-and-drop). It copies the file to public\ops-greeting.mp4
REM  After this, run 3_redeploy.bat to publish.
REM ============================================================
setlocal
cd /d "%~dp0"

if "%~1"=="" (
  echo.
  echo  Drag your greeting MP4 file onto this .bat file.
  echo  Example: ai-ops-greeting.mp4
  echo.
  pause
  exit /b 1
)

if not exist "public" (
  echo  ERROR: public folder not found next to this .bat.
  pause
  exit /b 1
)

echo Copying "%~nx1" to public\ops-greeting.mp4 ...
copy /Y "%~1" "public\ops-greeting.mp4" >nul
if errorlevel 1 (
  echo  Copy FAILED.
  pause
  exit /b 1
)

echo.
echo  Done. Greeting video set: public\ops-greeting.mp4
echo  Now run 3_redeploy.bat to publish the change.
echo.
pause
endlocal
