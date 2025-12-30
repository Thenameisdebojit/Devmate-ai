# Quick Fix for App Generator

## The Problem
The App Generator is failing because Python dependencies are not installed.

## Solution

### Step 1: Install Python Dependencies

**Windows:**
```cmd
cd autonomus-dev-agent
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

**Or use the batch file:**
```cmd
cd autonomus-dev-agent
install-deps.bat
```

**Linux/Mac:**
```bash
cd autonomus-dev-agent
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
```

**Or use the shell script:**
```bash
cd autonomus-dev-agent
chmod +x install-deps.sh
./install-deps.sh
```

### Step 2: Set Environment Variable

Make sure you have `GOOGLE_API_KEY` set in your environment:

**Windows (Command Prompt):**
```cmd
set GOOGLE_API_KEY=your_api_key_here
```

**Windows (PowerShell):**
```powershell
$env:GOOGLE_API_KEY="your_api_key_here"
```

**Linux/Mac:**
```bash
export GOOGLE_API_KEY=your_api_key_here
```

Or add it to your `.env.local` file in the project root:
```
GOOGLE_API_KEY=your_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

### Step 3: Restart the Server

After installing dependencies, restart your Next.js server:
```cmd
npm run dev
```

### Step 4: Test the App Generator

1. Go to the App Generator domain
2. Enter a prompt like "build a simple calculator app"
3. Click "Generate Full App"
4. Wait for generation to complete
5. Download the ZIP file

## Automatic Installation

The `start.bat` script now automatically checks and installs Python dependencies when you start the server. Just run:

```cmd
start.bat
```

## Troubleshooting

### "ModuleNotFoundError: No module named 'langchain_google_genai'"
- Make sure you ran the pip install command in the `autonomus-dev-agent` directory
- Check that Python is installed: `python --version`
- Try: `python -m pip install langchain-google-genai`

### "Python script failed"
- Check that `GOOGLE_API_KEY` is set
- Verify Python dependencies are installed
- Check the console for detailed error messages

### Still not working?
1. Check Python version: `python --version` (should be 3.8+)
2. Verify dependencies: `python -c "import langchain_google_genai; print('OK')"`
3. Check environment variables are set
4. Review error messages in the browser console

