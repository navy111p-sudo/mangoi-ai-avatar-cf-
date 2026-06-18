@echo off
chcp 65001 >nul
cd /d "%~dp0"
set HASH=6a2727b56fb81a1770fa6e34ddcb85a53f13c70e
echo Extracting previous STUDENT counselor files from commit %HASH% ...
if not exist "_recover\student" mkdir "_recover\student"
git show %HASH%:public/index.html > "_recover\student\public__index.html"
git show %HASH%:src/index.js > "_recover\student\src__index.js"
git show %HASH%:public/embed-snippet.html > "_recover\student\public__embed-snippet.html" 2>nul
git ls-tree -r --name-only %HASH% > "_recover\filelist.txt"
echo.
echo DONE. Files saved in _recover\student.
echo Now go back to Claude and say: extract done
pause
