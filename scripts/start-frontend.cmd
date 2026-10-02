@echo off
setlocal
REM ===========================================================================
REM  PLMS frontend dev server  (static hosting + /api reverse proxy)
REM
REM  Usage:  scripts\start-frontend.cmd [port]
REM  Default port: 5188
REM  NOTE: start the backend first -> scripts\start-backend.cmd
REM
REM  This file is intentionally ASCII-only: cmd.exe runs with the OEM codepage
REM  (GBK on this machine) and would garble non-ASCII content.
REM ===========================================================================

set "PORT=%~1"
if "%PORT%"=="" set "PORT=5188"

cd /d "%~dp0.."

set "PY=%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe"
if not exist "%PY%" set "PY=python"

echo.
echo  [PLMS] Starting frontend dev server on port %PORT% ...
echo  [PLMS] URL: http://127.0.0.1:%PORT%/index.html
echo  [PLMS] Demo account: demo_admin / 123456
echo.

"%PY%" scripts\dev-server.py %PORT%

echo.
echo  [PLMS] Server stopped.
pause
