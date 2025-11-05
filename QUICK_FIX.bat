@echo off
echo.
echo ========================================
echo   DevMate v2.0 - Environment Setup
echo ========================================
echo.

REM Check if .env.local exists
if not exist ".env.local" (
    echo [ERROR] .env.local file not found!
    echo Creating .env.local from template...
    copy .env.local.example .env.local
    echo.
)

echo Checking .env.local file...
echo.

REM Check if GEMINI_API_KEY is set
findstr /C:"GEMINI_API_KEY=" .env.local | findstr /V /C:"GEMINI_API_KEY=$" | findstr /V /C:"GEMINI_API_KEY= " > nul
if errorlevel 1 (
    echo [!] GEMINI_API_KEY is NOT configured
    echo     Get it from: https://makersuite.google.com/app/apikey
) else (
    echo [OK] GEMINI_API_KEY is configured
)

REM Check if MONGODB_URI is set
findstr /C:"MONGODB_URI=" .env.local | findstr /V /C:"MONGODB_URI=$" | findstr /V /C:"MONGODB_URI= " > nul
if errorlevel 1 (
    echo [!] MONGODB_URI is NOT configured
    echo     Get it from: https://www.mongodb.com/cloud/atlas
) else (
    echo [OK] MONGODB_URI is configured
)

REM Check if JWT_SECRET is set
findstr /C:"JWT_SECRET=" .env.local | findstr /V /C:"JWT_SECRET=$" | findstr /V /C:"JWT_SECRET= " > nul
if errorlevel 1 (
    echo [!] JWT_SECRET is NOT configured
    echo     Use any random secure string (32+ characters)
) else (
    echo [OK] JWT_SECRET is configured
)

echo.
echo ========================================
echo.

REM Check if all are configured
findstr /C:"GEMINI_API_KEY=" .env.local | findstr /V /C:"GEMINI_API_KEY=$" | findstr /V /C:"GEMINI_API_KEY= " > nul
if errorlevel 1 goto missing

findstr /C:"MONGODB_URI=" .env.local | findstr /V /C:"MONGODB_URI=$" | findstr /V /C:"MONGODB_URI= " > nul
if errorlevel 1 goto missing

findstr /C:"JWT_SECRET=" .env.local | findstr /V /C:"JWT_SECRET=$" | findstr /V /C:"JWT_SECRET= " > nul
if errorlevel 1 goto missing

echo All environment variables are configured!
echo.
echo You can now start the app with:
echo   start.bat
echo.
pause
exit /b 0

:missing
echo.
echo [ACTION REQUIRED] Please edit .env.local and fill in the missing values.
echo.
echo Opening .env.local in Notepad...
timeout /t 2 >nul
notepad .env.local
echo.
echo After saving, run this script again to verify.
echo.
pause
