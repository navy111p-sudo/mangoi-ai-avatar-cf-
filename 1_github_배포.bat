@echo off
setlocal

REM === Mangoi AI Avatar - GitHub upload script (ASCII only, safe on Korean Windows) ===
REM Just double-click this file. It runs git init/add/commit/push automatically.

set REMOTE_URL=https://github.com/navy111p-sudo/mangoi-ai-avatar-cf-.git

cd /d "%~dp0"
echo.
echo Working folder: %cd%
echo Target repo   : %REMOTE_URL%
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] git is not installed. Install from https://git-scm.com and retry.
  pause & exit /b 1
)

if not exist ".git" (
  echo [1/5] git init...
  git init
) else (
  echo [1/5] using existing git repo...
)

echo [2/5] staging files...
git add -A

echo [3/5] commit...
git commit -m "feat: mangoi ai avatar - cloudflare deploy"

echo [4/5] set branch and remote...
git branch -M main
git remote remove origin >nul 2>nul
git remote add origin %REMOTE_URL%

echo [5/5] push to GitHub...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [CHECK] push failed. Verify:
  echo   - the empty repo exists on github.com
  echo   - REMOTE_URL matches the repo name
  echo   - you are logged in to GitHub
  pause & exit /b 1
)

echo.
echo ====================================================
echo  DONE! Now connect this repo on Cloudflare Pages.
echo   - Build output directory: public
echo   - Add env var GEMINI_API_KEY with your Gemini key
echo ====================================================
echo.
pause
