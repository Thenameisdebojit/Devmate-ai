#!/bin/bash

echo "🚀 Starting DevMate v2.0..."
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Start the development server
echo "🌐 Starting Next.js server on port 5000..."
npm run dev
