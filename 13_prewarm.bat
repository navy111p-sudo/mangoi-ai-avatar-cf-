@echo off
setlocal
cd /d "%~dp0"

REM ============================================================
REM  Pre-make the voice for fixed phrases (FAQ answers, greetings).
REM  Run ONCE after deploy (and again after changing src/faq.js).
REM  Cost: about 2,800 characters = about $0.04, one time.
REM  Phrases already saved are skipped (free).
REM ============================================================

set URL=https://mangoi-ai-avatar-cf.navy111p.workers.dev
echo Pre-making voices at %URL%/api/tts/prewarm ...
curl -s -X POST "%URL%/api/tts/prewarm"
echo.
echo.
echo "made" = newly created, "cached" = already saved, "failed" should be empty.
echo This month's Azure usage: %URL%/api/tts/usage
pause
endlocal
