@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  Set Azure Speech secrets on the avatar worker (student voice).
REM  Azure portal - your Speech resource - "Keys and Endpoint":
REM    1) AZURE_SPEECH_KEY    : KEY 1  (right-click to paste, input stays hidden)
REM    2) AZURE_SPEECH_REGION : Location/Region, e.g. koreacentral
REM  Then run 3_redeploy.bat to apply.
REM ============================================================

echo [1/2] Paste your Azure Speech KEY and press Enter.
call npx wrangler secret put AZURE_SPEECH_KEY --config "%~dp0wrangler.toml" --name mangoi-ai-avatar-cf
echo.
echo [2/2] Type your Azure Speech REGION (e.g. koreacentral) and press Enter.
call npx wrangler secret put AZURE_SPEECH_REGION --config "%~dp0wrangler.toml" --name mangoi-ai-avatar-cf
echo.
echo Done. Now run 3_redeploy.bat to apply.
pause
endlocal
