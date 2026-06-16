@echo off
setlocal
cd /d "%~dp0"

REM === Set Typecast API key as a secret on the avatar worker ===
REM When prompted "Enter a secret value", RIGHT-CLICK to paste your Typecast API key, then Enter.
REM (Input stays hidden on screen - that is normal.)

echo Setting TYPECAST_API_KEY secret for worker: mangoi-ai-avatar-cf
echo When asked, paste your Typecast API key (right-click to paste) and press Enter.
echo.
call npx wrangler secret put TYPECAST_API_KEY --config "%~dp0wrangler.toml" --name mangoi-ai-avatar-cf
echo.
echo Done. (If it failed, run 2_cloudflare_deploy first so the worker exists, then retry.)
pause
