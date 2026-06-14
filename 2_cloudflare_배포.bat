@echo off
setlocal
cd /d "%~dp0"

REM === Mangoi AI Avatar - Deploy to Cloudflare Workers (static assets + API) ===
REM Double-click this file. It deploys the avatar worker via wrangler.
REM (Your PC already has wrangler + Cloudflare login from earlier deploys.)

echo === Mangoi AI Avatar - Cloudflare deploy ===
echo Working folder: %cd%
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm not found. Install Node.js: https://nodejs.org  then retry.
  pause & exit /b 1
)

echo [1/3] Installing dependencies (wrangler)...
call npm install
if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
echo.

echo [2/3] Deploying worker to Cloudflare...
call npx wrangler deploy --config "%~dp0wrangler.toml"
if errorlevel 1 (
  echo.
  echo [ERROR] deploy failed.
  echo If it asked you to log in, run this once:  npx wrangler login
  echo Then double-click this file again.
  pause & exit /b 1
)
echo.

echo [3/3] Set your Gemini API key as a secret.
echo When prompted "Enter a secret value", paste your key (AIza...) and press Enter.
echo (No key yet? Get a free one at https://aistudio.google.com/apikey )
call npx wrangler secret put GEMINI_API_KEY --config "%~dp0wrangler.toml" --name mangoi-ai-avatar-cf

echo.
echo ====================================================
echo  DONE! The avatar URL is shown above (ends with .workers.dev).
echo  Open that URL in a browser to test the chat.
echo  Then paste the URL back to Claude to finish the website link.
echo ====================================================
echo.
pause
