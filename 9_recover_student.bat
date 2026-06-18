@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo  Recover previous STUDENT counselor version from git history
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0recover_student.ps1"
echo.
echo ------------------------------------------------------------
echo  Done. A folder named "_recover" was created in this folder.
echo  Now go back to Claude and say: recover done
echo ------------------------------------------------------------
pause
