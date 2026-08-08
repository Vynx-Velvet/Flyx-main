@echo off
setlocal enabledelayedexpansion

echo.
echo   ==========================================
echo          Flyx 3.0 — Setup (Windows^)
echo   ==========================================
echo.
echo   This script does everything up to 'flyx setup'.
echo   You'll only need to answer the config wizard's questions.
echo.

REM ── Check Node.js ──────────────────────────────────────────────

echo   [1/4] Checking prerequisites...

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   X  Node.js not found. Please install Node.js 20+ from https://nodejs.org
    echo      Make sure to check "Add to PATH" during install.
    pause
    exit /b 1
)

for /f "tokens=1,2,3 delims=." %%a in ('node -v 2^>^&1 ^| findstr /r "^v[0-9]"') do (
    set NODE_MAJOR=%%a
)
set NODE_MAJOR=%NODE_MAJOR:v=%
if %NODE_MAJOR% lss 20 (
    echo   X  Node.js %NODE_MAJOR% found. Flyx requires Node.js 20+.
    echo      Update at https://nodejs.org
    pause
    exit /b 1
)
echo   ✓  Node.js !NODE_MAJOR! detected

where git >nul 2>&1
if %errorlevel% neq 0 (
    echo   X  Git not found. Please install Git from https://git-scm.com
    pause
    exit /b 1
)
echo   ✓  Git detected

REM ── Determine directory ────────────────────────────────────────

set REPO_DIR=%cd%

REM Check if we're already inside the Flyx repo
if exist "package.json" (
    findstr /c:"\"name\": \"flyx\"" package.json >nul 2>&1
    if !errorlevel! equ 0 (
        echo   ✓  Already in Flyx repo: %REPO_DIR%
        goto :install
    )
)

REM Ask for install location
echo.
echo   Where should Flyx be installed?
echo     Default: %USERPROFILE%\Flyx
echo.
set /p INSTALL_DIR="  Folder path (press Enter for default): "
if "!INSTALL_DIR!"=="" set INSTALL_DIR=%USERPROFILE%\Flyx

REM ── Clone repo ─────────────────────────────────────────────────

echo.
echo   [2/4] Cloning Flyx...

if exist "!INSTALL_DIR!" (
    echo   !  Directory already exists: !INSTALL_DIR!
    set /p OVERWRITE="  Delete and re-clone? [y/N]: "
    if /i "!OVERWRITE!"=="y" (
        rmdir /s /q "!INSTALL_DIR!"
    ) else (
        set REPO_DIR=!INSTALL_DIR!
        cd /d "!REPO_DIR!"
        goto :install
    )
)

git clone https://github.com/Vynx-Velvet/Flyx-main.git "!INSTALL_DIR!"
if %errorlevel% neq 0 (
    echo   X  Failed to clone. Check your internet connection.
    pause
    exit /b 1
)
set REPO_DIR=!INSTALL_DIR!
cd /d "!REPO_DIR!"

REM ── Install dependencies ───────────────────────────────────────

:install
echo.
echo   [3/4] Installing dependencies (this may take a minute^)...

call npm install --allow-scripts
if %errorlevel% neq 0 (
    echo.
    echo   X  npm install failed.
    echo      Try running manually: npm install --allow-scripts
    pause
    exit /b 1
)
echo   ✓  Dependencies installed

REM ── Link CLI ────────────────────────────────────────────────────

echo.
echo   [4/4] Linking 'flyx' command...

call npm run cli:link
if %errorlevel% neq 0 (
    echo   X  Failed to link flyx command.
    echo      Try running manually: npm run cli:link
    pause
    exit /b 1
)
echo   ✓  'flyx' command linked

REM ── Done ────────────────────────────────────────────────────────

echo.
echo   ==========================================
echo         Setup complete! Next step:
echo.
echo         flyx setup
echo.
echo     This runs the guided config wizard.
echo     It asks 4-5 questions, then builds +
echo     launches your private streaming hub.
echo   ==========================================
echo.

endlocal
