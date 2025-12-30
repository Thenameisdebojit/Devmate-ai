@echo off
echo 🚀 Starting DevMate v2.0...
echo.

REM Check if node_modules exists
if not exist "node_modules\" (
    echo 📦 Installing Node.js dependencies...
    call npm install
    echo.
)

REM Check if Python dependencies are installed for autonomus-dev-agent
echo 🔍 Checking Python dependencies for App Generator...
cd autonomus-dev-agent
python -c "import langchain_google_genai" >nul 2>&1
if errorlevel 1 (
    echo ⚠️  Python dependencies not found. Installing...
    python -m pip install --upgrade pip >nul 2>&1
    python -m pip install -r requirements.txt
    if errorlevel 1 (
        echo ❌ Failed to install Python dependencies. App Generator may not work.
        echo    Please run manually: cd autonomus-dev-agent ^&^& pip install -r requirements.txt
    ) else (
        echo ✅ Python dependencies installed successfully!
    )
) else (
    echo ✅ Python dependencies are installed.
)
cd ..

echo.
REM Start the development server
echo 🌐 Starting Next.js server on port 5000...
npm run dev
