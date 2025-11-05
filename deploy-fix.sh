#!/bin/bash

echo "🔧 Preparing files for Vercel deployment..."
echo ""

# Show what will be committed
echo "📝 Files to be committed:"
echo "  - .gitignore (removed lib/ exclusion)"
echo "  - lib/auth.ts (authentication utilities)"
echo "  - lib/mongodb.ts (database connection)"
echo "  - .env.example (environment variable template)"
echo ""

# Add files
echo "📦 Staging files..."
git add .gitignore lib/ .env.example

# Show status
echo ""
echo "📊 Git status:"
git status --short

echo ""
echo "✅ Files staged! Now run:"
echo ""
echo "   git commit -m \"Fix: Add lib files for Vercel deployment\""
echo "   git push origin main"
echo ""
echo "After pushing, Vercel will automatically rebuild with the lib files! 🚀"
