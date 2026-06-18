@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Running test-harness (node test-harness.mjs) ===
echo.
node test-harness.mjs
echo.
if errorlevel 1 echo [FAIL] Some tests did not pass.
if not errorlevel 1 echo [OK] All tests passed.
echo.
pause
