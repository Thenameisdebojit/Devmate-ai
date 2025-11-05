# DevMate - AI Coding Assistant

## Overview
DevMate is a ChatGPT-like AI coding assistant built with the MERN stack (MongoDB, Express, React/Next.js, Node.js), powered by Google Gemini API. The application provides AI-powered coding assistance including code generation, explanation, rewriting, and debugging capabilities.

## Recent Changes (October 10, 2025)

### UI/UX Enhancements - ChatGPT Style
- **Settings Modal**: Implemented expandable settings panel accessible from user avatar/name in top-right corner
  - Expandable sections: General, Personalization, Notifications, Data Controls, Security, My Account, Parental Controls
  - Includes User Guide and Logout options
  - Settings persisted to MongoDB via `/api/settings` endpoint

- **File Upload Feature**: Added file attachment capability
  - Plus (+) icon beside input bar for file selection
  - Image preview with remove option
  - File analysis backend at `/api/analyze` endpoint using Multer
  - Supports images and text files

- **Light Mode Optimization**: Enhanced light mode with better visibility
  - Improved contrast ratios
  - Pastel gradient backgrounds
  - Soft shadows and rounded corners
  - Professional color palette

- **Performance Optimizations**:
  - Lazy loading for modals (AuthModal, SettingsModal, OnboardingModal, HelpModal)
  - React.memo for optimized re-renders
  - LoadingBar component (ChatGPT-style progress indicator)
  - SkeletonLoader for initial page load

## Project Architecture

### Tech Stack
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB (via Mongoose)
- **AI**: Google Gemini API
- **Authentication**: JWT-based auth with bcryptjs
- **State Management**: Zustand
- **File Upload**: Multer
- **UI Libraries**: Framer Motion, React Icons, React Markdown, React Syntax Highlighter

### Key Components
- `app/page.tsx` - Main app container
- `app/components/ChatWindow.tsx` - Chat interface
- `app/components/InputSection.tsx` - Message input with file upload
- `app/components/SettingsModal.tsx` - User settings panel
- `app/components/WelcomePage.tsx` - Landing page
- `app/components/Sidebar.tsx` - Chat history sidebar
- `app/components/LoadingBar.tsx` - Progress indicator
- `app/components/SkeletonLoader.tsx` - Initial loading state

### API Routes
- `/api/auth/*` - Authentication endpoints (login, register, me)
- `/api/chat` - AI chat interaction
- `/api/settings` - User settings (GET/PUT)
- `/api/analyze` - File upload and analysis
- `/api/history` - Chat history management
- `/api/health` - Health check endpoint

### Database Models
- `User` - User accounts with authentication
- `Chat` - Chat sessions and history
- `Settings` - User preferences and settings

### State Management (Zustand)
- `useAuthStore` - Authentication state
- `useChatStore` - Chat messages and history
- `useTheme` - Theme preferences (light/dark)

## Environment Variables
- `GEMINI_API_KEY` - Google Gemini API key
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret

## Current Status
✅ All major UI/UX enhancements completed
✅ File upload feature implemented
✅ Settings modal with expandable sections
✅ Light mode optimized
✅ Performance optimizations added
⚠️ Minor issue: Initial page load may show loading state longer than expected

## User Preferences
- Clean, modern ChatGPT-like interface preferred
- Pastel colors and soft shadows for professional look
- Performance and responsiveness prioritized

## Development
- Server runs on port 5000
- Uses Next.js dev server with hot reload
- Command: `npm run dev`
