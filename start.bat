@echo off
echo 🚀 Starting DevMate v2.0...
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 Installing dependencies...
    call npm install
    echo.
)

REM Start the development server
echo 🌐 Starting Next.js server on port 5000...
npm run dev
