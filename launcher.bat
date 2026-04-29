@echo off
chcp 65001 >nul 2>&1
title Tiki Taka Toe - Launcher
color 0A

:MENU
cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║                                              ║
echo  ║     ⚽  TIKI TAKA TOE  ⚽                    ║
echo  ║     TikTok Live Football Grid Game           ║
echo  ║                                              ║
echo  ╠══════════════════════════════════════════════╣
echo  ║                                              ║
echo  ║   [1]  Install Dependencies                  ║
echo  ║   [2]  Generate Game Data (Scraper)          ║
echo  ║   [3]  Start Game (Backend + Frontend)       ║
echo  ║   [4]  Full Setup (Install + Data + Start)   ║
echo  ║   [5]  Exit                                  ║
echo  ║                                              ║
echo  ╚══════════════════════════════════════════════╝
echo.
set /p choice="  Select option [1-5]: "

if "%choice%"=="1" goto INSTALL
if "%choice%"=="2" goto SCRAPER
if "%choice%"=="3" goto START
if "%choice%"=="4" goto FULLSETUP
if "%choice%"=="5" goto EXIT
echo.
echo  [!] Invalid option. Please try again.
timeout /t 2 >nul
goto MENU

:INSTALL
cls
echo.
echo  ══════════════════════════════════════
echo   Installing Dependencies...
echo  ══════════════════════════════════════
echo.
echo  [1/3] Installing root dependencies...
call npm install
echo.
echo  [2/3] Installing frontend dependencies...
cd frontend
call npm install
cd ..
echo.
echo  [3/3] Installing scraper dependencies...
cd scraper
call npm install
cd ..
echo.
echo  ══════════════════════════════════════
echo   All dependencies installed!
echo  ══════════════════════════════════════
echo.
pause
goto MENU

:SCRAPER
cls
echo.
echo  ══════════════════════════════════════
echo   Generating Game Data...
echo  ══════════════════════════════════════
echo.
echo  This will download player data from
echo  Transfermarkt and generate puzzle grids.
echo  (May take 1-3 minutes on first run)
echo.
cd scraper
call node index.js
cd ..
echo.
echo  ══════════════════════════════════════
echo   Game data generated successfully!
echo  ══════════════════════════════════════
echo.
pause
goto MENU

:START
cls
echo.
echo  ══════════════════════════════════════
echo   Start Tiki Taka Toe
echo  ══════════════════════════════════════
echo.
set /p username="  Enter TikTok username: @"
if "%username%"=="" (
    echo  [!] Username cannot be empty!
    timeout /t 2 >nul
    goto START
)
echo.
echo  Starting game for @%username%...
echo  Frontend: http://localhost:5173
echo.
echo  Press Ctrl+C to stop the game.
echo  ══════════════════════════════════════
echo.
call node start.js %username%
pause
goto MENU

:FULLSETUP
cls
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║         FULL SETUP - One Click Install       ║
echo  ╚══════════════════════════════════════════════╝
echo.
echo  [Step 1/3] Installing dependencies...
echo  ────────────────────────────────────
call npm install
cd frontend
call npm install
cd ..
cd scraper
call npm install
cd ..
echo.
echo  [Step 2/3] Generating game data...
echo  ────────────────────────────────────
cd scraper
call node index.js
cd ..
echo.
echo  [Step 3/3] Ready to launch!
echo  ────────────────────────────────────
echo.
set /p username="  Enter TikTok username: @"
if "%username%"=="" (
    echo  [!] Username cannot be empty!
    timeout /t 2 >nul
    goto MENU
)
echo.
echo  Starting game for @%username%...
echo  Frontend: http://localhost:5173
echo.
echo  Press Ctrl+C to stop the game.
echo  ══════════════════════════════════════
echo.
call node start.js %username%
pause
goto MENU

:EXIT
cls
echo.
echo  Thanks for playing Tiki Taka Toe! ⚽
echo.
timeout /t 2 >nul
exit
