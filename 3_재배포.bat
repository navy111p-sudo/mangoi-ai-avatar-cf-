@echo off
setlocal
cd /d "%~dp0"

REM === Mangoi AI Avatar - Re-deploy only (no secret prompt) ===
echo === Re-deploying worker to Cloudflare ===
echo.
call npx wrangler deploy --config "%~dp0wrangler.toml"
if errorlevel 1 (
  echo [ERROR] deploy failed.
  pause & exit /b 1
)
echo.
echo Done. Re-deployed.
pause
