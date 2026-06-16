@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  Make CHAT ANSWERS use the SAME Typecast voice as your
REM  greeting video. Sets the secret TYPECAST_VOICE_ID.
REM
REM  1) Open Typecast, find the voice (actor) you used for the
REM     greeting video, and copy its VOICE ID (voice_id).
REM  2) Run this .bat. When asked "Enter a secret value",
REM     RIGHT-CLICK to paste the voice id, then press Enter.
REM     (Input stays hidden on screen - that is normal.)
REM
REM  If you skip this, answers use a default young female KR voice.
REM ============================================================

echo Setting TYPECAST_VOICE_ID secret for worker: mangoi-ai-avatar-cf
echo When asked, paste your Typecast voice id (right-click to paste) and press Enter.
echo.
call npx wrangler secret put TYPECAST_VOICE_ID --config "%~dp0wrangler.toml" --name mangoi-ai-avatar-cf
echo.
echo Done. Now run 3_redeploy.bat to apply.
pause
endlocal
