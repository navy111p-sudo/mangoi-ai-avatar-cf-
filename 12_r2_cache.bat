@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  Create the R2 bucket for the voice cache (run ONCE, before deploy).
REM  Same sentence = made by Azure once, then replayed free from R2.
REM  Bucket name must match wrangler.toml: mangoi-avatar-tts-cache
REM ============================================================

echo Creating R2 bucket: mangoi-avatar-tts-cache
call npx wrangler r2 bucket create mangoi-avatar-tts-cache
echo.
echo If it says "already exists", that is fine.
echo Next: 11_azure_key.bat (once), then 3_redeploy.bat
pause
endlocal
