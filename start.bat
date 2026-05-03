@echo off
title Q11 Fitness - Gym Management
color 0A

echo ========================================
echo    Q11 FITNESS - GYM MANAGEMENT SYSTEM
echo ========================================
echo.

:: Verifică dacă Node.js este instalat
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [EROARE] Node.js nu este instalat!
    echo Instaleaza Node.js de la https://nodejs.org/
    pause
    exit /b
)

:: Oprește orice proces care folosește portul 8080
echo [1/4] Opreste procesele vechi...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>nul
)

:: Pornește serverul NFC
echo [2/4] Porneste serverul NFC...
start /min cmd /c "node server.js"

:: Așteaptă 3 secunde pentru ca serverul să pornească
timeout /t 3 /nobreak >nul

:: Deschide aplicația în browser
echo [3/4] Deschide aplicatia...
start http://localhost:8080

:: Deschide Chrome în modul aplicație (fără bara de adrese)
start chrome --app=http://localhost:8080

echo [4/4] Sistem pornit cu succes!
echo.
echo ========================================
echo    APLICATIA RULEAZA!
echo    Nu inchide aceasta fereastra!
echo ========================================
echo.

pause