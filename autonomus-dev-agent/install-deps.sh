#!/bin/bash

echo "Installing Python dependencies for autonomus-dev-agent..."
echo

cd "$(dirname "$0")"

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed"
    echo "Please install Python 3.8+ from https://www.python.org/"
    exit 1
fi

echo "Installing dependencies from requirements.txt..."
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt

if [ $? -ne 0 ]; then
    echo
    echo "ERROR: Failed to install dependencies"
    exit 1
fi

echo
echo "Successfully installed all dependencies!"
echo

