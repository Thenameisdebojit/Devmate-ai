# Devmate v2.0 - AI Coding Assistant

A modern, full-stack AI coding assistant powered by Google's Gemini AI, built with Next.js 14.

## ⚠️ IMPORTANT: First Time Setup

**Before running the app, you MUST configure environment variables:**

1. **Run the quick setup checker:**
   ```bash
   node check-env.js
   ```
   or on Windows:
   ```batch
   QUICK_FIX.bat
   ```

2. **Edit `.env.local` and fill in your API keys:**
   - `GEMINI_API_KEY` - Get from https://makersuite.google.com/app/apikey
   - `MONGODB_URI` - Get from https://www.mongodb.com/cloud/atlas
   - `JWT_SECRET` - Any random secure string (32+ characters)

3. **See detailed instructions:** Check `SETUP_LOCAL.md` for step-by-step guide

---

## 📋 Changelog - v2.1 (Enhanced UI/UX)

### 🎨 Design System
- **Industrial-Grade Glassmorphism**: Enhanced glassmorphism design with dark/light theme support
- **CSS Variables**: Comprehensive color tokens and theme variables for consistent styling
- **Typography**: Inter font for UI, JetBrains Mono for code blocks
- **Animations**: Smooth fade-in, slide-in, and scale transitions with `prefers-reduced-motion` support

### 🖥️ Layout & Components
- **Desktop 2-Column Layout**: Chat + Input on left, Monaco Code Output on right
- **Tablet Responsive**: Grid layout with side-by-side panels
- **Mobile Optimized**: Stacked layout with view switching between chat, input, and code
- **Monaco Editor Integration**: Lazy-loaded code editor with syntax highlighting, copy/download/regenerate actions
- **Command Bar (Cmd/Ctrl+K)**: Global command palette with fuzzy search for quick actions and template switching

### 🔧 Features
- **Prompt Templates**: YAML-based templates for Generate, Explain, Rewrite, Fix with temperature control and few-shot examples
- **Theme Modes**: Dark, Light, and System theme support with localStorage persistence
- **Framer Motion Animations**: Smooth microinteractions on messages, buttons, and modal components
- **Enhanced Accessibility**: ARIA labels, keyboard navigation, focus management, WCAG AA contrast

### 🚀 Performance
- **Lazy Loading**: Dynamic imports for Monaco Editor to reduce initial bundle size
- **Code Splitting**: Route-level code splitting for optimal performance
- **Optimized Assets**: Compressed images and minimal initial bundle

### 🛠️ Developer Experience
- **TypeScript**: Full type safety across all components
- **Modular Architecture**: Clean component structure with separation of concerns
- **Reusable Utilities**: Shared utilities for prompt templates and theme management

## 🚀 Features

- **Code Generation** - Generate production-ready code from natural language prompts
- **Code Explanation** - Get detailed step-by-step explanations of any code
- **Code Rewriting** - Improve code quality, readability, and performance
- **Code Fixing** - Fix bugs and errors with AI assistance
- **Domain Selection** - Specialized support for Python, JavaScript, TypeScript, React, Node.js, Go, and Rust
- **Real-time Streaming** - ChatGPT-like streaming responses for better UX
- **Glassmorphism UI** - Beautiful modern interface with frosted glass effects
- **Dark/Light Mode** - Smooth theme switching with persistent preferences
- **Copy & Download** - One-click copy to clipboard and smart file downloads
- **Conversation Management** - Export chat history and clear conversations

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom glassmorphism
- **State**: Zustand
- **AI**: Google Gemini 2.5 pro
- **Notifications**: React Hot Toast
- **Animations**: Framer Motion
- **Code Editor**: Monaco Editor (lazy-loaded)
- **Search**: Fuse.js (fuzzy search)
- **Config**: YAML (js-yaml)

## ⌨️ Keyboard Shortcuts

- **Cmd/Ctrl + K**: Open command palette
- **ESC**: Close command palette / modals
- **Arrow Keys**: Navigate command palette
- **Enter**: Execute selected command
- **Tab**: Switch between input tabs

## 🚀 Quick Start

### Option 1: One-Click Start (Recommended)

**Windows:**
```batch
start.bat
```
Just double-click `start.bat` in the project folder!

**Linux/Mac:**
```bash
./start.sh
```

The script will automatically:
- Install dependencies if needed
- Start the development server on port 5000
- Open at http://localhost:5000

### Option 2: Manual Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd devmate
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file and add your Gemini API key:
```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

Get your API key from: https://aistudio.google.com/app/apikey

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:5000](http://localhost:5000) in your browser.
## 🎨 UI Components

- **Header**: Domain selector, export, clear, theme toggle
- **ChatWindow**: Conversation display with empty state
- **InputSection**: 4-tab interface (Generate/Explain/Rewrite/Fix)
- **MessageBubble**: Individual messages with copy/download buttons
- **ThemeProvider**: Dark/light mode management

## 🔑 API Routes

### POST /api/chat
Main AI endpoint with streaming support.

**Request Body:**
```json
{
  "action": "generate|explain|rewrite|fix",
  "prompt": "Your prompt here",
  "code": "Code to process",
  "instructions": "Optional instructions for rewrite",
  "error": "Optional error message for fix",
  "domain": "Python|JavaScript|TypeScript|..."
}
```

**Response:** Server-Sent Events stream with AI-generated text

### GET /api/health
Health check endpoint - returns 503 if API key is not configured.

## 📝 Usage Examples

### Generate Code
1. Select "Generate" tab
2. Enter your prompt: "Create a React component for a todo list"
3. Click "Generate"
4. Copy or download the generated code

### Explain Code
1. Select "Explain" tab
2. Paste your code
3. Click "Explain"
4. Get step-by-step explanation

### Rewrite Code
1. Select "Rewrite" tab
2. Paste your code
3. Optionally add specific instructions
4. Click "Rewrite"
5. Get improved version

### Fix Code
1. Select "Fix" tab
2. Paste your buggy code
3. Optionally add the error message
4. Click "Fix"
5. Get corrected code with explanations

## 🎯 Key Features

- **Streaming Responses**: Real-time token streaming like ChatGPT
- **Smart Downloads**: Automatic file extension detection (.py, .js, .ts, etc.)
- **Persistent Theme**: Your theme preference is saved locally
- **Responsive Design**: Works beautifully on mobile and desktop
- **Toast Notifications**: Instant feedback for all actions
- **Conversation Export**: Save your chat history as .txt

## 🔧 Configuration

### next.config.js
Basic Next.js configuration with React strict mode.

### tailwind.config.js
Custom dark mode and glassmorphism utilities.

### vercel.json
Deployment configuration for Vercel platform.

## 🚨 Important Notes

- The app runs on port 5000
- Conversation history is not persisted (memory-only)
- API key must be configured in `.env.local`
- Temperature is set to 0.4 for accuracy-focused responses

## 📄 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 💬 Support

For issues and questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and Gemini AI
