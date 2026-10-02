@echo off
setlocal
REM ===========================================================================
REM  PLMS backend launcher (Spring Boot 3.3.7 + MyBatis-Plus + MySQL)
REM
REM  Usage:  scripts\start-backend.cmd [port] [profile]
REM  Example: scripts\start-backend.cmd 8080
REM           scripts\start-backend.cmd 8080 nacos
REM
REM  Requires: JDK 17, Maven, MySQL running on 127.0.0.1:3306 (db: plms)
REM
REM  This file is intentionally ASCII-only: cmd.exe runs with the OEM codepage
REM  (GBK on this machine) and would garble non-ASCII content.
REM ===========================================================================

set "PORT=%~1"
if "%PORT%"=="" set "PORT=8080"
set "PROFILE=%~2"

REM ---- CRITICAL: this env var overrides server.port and points at an occupied
REM ---- port (3703) on this machine, which makes the app fail to start.
set "SERVER__PORT="
set "SERVER_PORT="

set "JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.13.11-hotspot"
if not exist "%JAVA_HOME%\bin\java.exe" (
  echo [ERROR] JDK not found: %JAVA_HOME%
  echo         Edit JAVA_HOME in this script.
  pause
  exit /b 1
)

set "MVN=D:\apache-maven-3.8.1\bin\mvn.cmd"
if not exist "%MVN%" (
  echo [ERROR] Maven not found: %MVN%
  echo         Edit MVN in this script.
  pause
  exit /b 1
)
set "MVN_REPO=D:\apache-maven-3.8.1\repo"

set "ARGS=--server.port=%PORT%"
if not "%PROFILE%"=="" set "ARGS=%ARGS% --spring.profiles.active=%PROFILE%"

cd /d "%~dp0..\plms-service"

echo.
echo  [PLMS] Starting backend on port %PORT% ...
if not "%PROFILE%"=="" echo  [PLMS] Profile: %PROFILE%
echo  [PLMS] Health: http://127.0.0.1:%PORT%/api/system/health
echo.

call "%MVN%" -B -Dmaven.repo.local="%MVN_REPO%" spring-boot:run "-Dspring-boot.run.arguments=%ARGS%"

echo.
echo  [PLMS] Backend stopped.
pause
