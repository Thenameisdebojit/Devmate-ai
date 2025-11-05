#!/bin/bash

echo "🚀 Starting DevMate v2.0 in Production Mode..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Build the application
echo "🔨 Building application..."
npm run build
echo ""

# Start the production server
echo "🌐 Starting production server on port 5000..."
npm run start
