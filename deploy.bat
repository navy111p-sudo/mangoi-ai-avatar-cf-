@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   망고아이 운영비서 - GitHub 배포 (Cloudflare 자동배포)
echo ============================================
echo.

git add -A
if errorlevel 1 goto err

set "MSG=%~1"
if "%MSG%"=="" set "MSG=update: 관리자 운영비서 마이크 안내 말풍선 추가"

git commit -m "%MSG%"
git push origin main
if errorlevel 1 goto err

echo.
echo [완료] GitHub에 push 했습니다. Cloudflare가 1~2분 내 자동 배포합니다.
echo.
pause
exit /b 0

:err
echo.
echo [오류] 배포 중 문제가 발생했습니다. 위 메시지를 확인해 주세요.
echo.
pause
exit /b 1
