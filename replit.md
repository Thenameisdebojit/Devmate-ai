# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a full-stack AI coding assistant built with Next.js 14 that provides intelligent code generation, explanation, rewriting, and debugging capabilities. The application features a hybrid AI routing system powered by OpenAI GPT-5 and Google Gemini 2.5 Pro, with automatic model selection based on task complexity and user preferences.

The platform offers a ChatGPT-like interface with real-time streaming responses, syntax-highlighted code output, domain-specific assistance, and persistent chat history. It's designed as a developer-first tool with keyboard shortcuts, command palette, and extensive customization options.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router and TypeScript
- Server-side rendering with client-side hydration
- API routes for serverless backend functionality
- Dynamic imports for code splitting (Monaco Editor lazy-loaded)

**State Management**: Zustand
- `useChatStore`: Manages messages, conversation state, domain selection, and AI model preferences
- `useAuthStore`: Handles user authentication state, login/logout, and session persistence

**UI/UX Design System**:
- **Glassmorphism**: Dark-first design with backdrop blur, soft gradients, and semi-transparent panels
- **Theme System**: Dark, Light, and System modes with CSS variables and localStorage persistence
- **Typography**: Inter for UI text, JetBrains Mono for code blocks
- **Responsive Layout**: 
  - Desktop: 2-column split (chat + Monaco editor)
  - Tablet: Grid layout with side-by-side panels
  - Mobile: Stacked layout with view switching
- **Animations**: Framer Motion for microinteractions, smooth transitions with `prefers-reduced-motion` support

**Key Components**:
- `ChatWindow`: Scrollable message display with auto-scroll
- `InputSection`: Multi-line input with file upload, model selection, and keyboard shortcuts
- `MonacoCodeOutput`: Lazy-loaded code editor with syntax highlighting and code actions
- `CommandBar`: Global command palette (Cmd/Ctrl+K) with fuzzy search
- `DomainSelector`: Domain context switching (General, Web Dev, ML, Data Science, etc.)
- `Sidebar`: Navigation with chat history, new chat, settings, and profile

### Backend Architecture

**API Routes** (Next.js App Router):
- `/api/chat`: Main AI conversation endpoint with streaming support
- `/api/ai`: Generic AI request handler with model orchestration
- `/api/codegen`: Full application generation with project structure
- `/api/analyze`: File analysis and image processing
- `/api/auth/*`: Authentication endpoints (login, signup, logout, session validation)
- `/api/chats`: Chat history CRUD operations

**AI Orchestration Layer** (`lib/aiOrchestrator.ts`):
- **Model Selection**: Intelligent routing between GPT-5 and Gemini 2.5 Pro
- **Failover Logic**: Automatic fallback if primary model fails
- **Streaming Support**: Real-time token streaming for both OpenAI and Gemini
- **Intent Detection**: Analyzes prompts to distinguish between conversational queries and code generation tasks

**Prompt Engineering**:
- YAML-based prompt templates (`public/config/prompts/`)
- Few-shot examples for Generate, Explain, Rewrite, Fix actions
- Temperature control (0.2-0.4 for code generation, higher for creative tasks)
- Domain-specific system instructions injected per request

### Data Storage

**Database**: MongoDB with Mongoose ODM
- **Connection Management**: Cached connection pattern to prevent connection exhaustion in serverless environment
- **Models**:
  - `User`: Name, email, hashed password (bcrypt), avatar, timestamps
  - `Chat`: User reference, title, messages array, timestamps (indexed on userId + createdAt)
  - `Settings`: User preferences for notifications, privacy, accessibility

**Authentication**:
- JWT tokens with JOSE library (HS256 algorithm)
- Tokens stored in HTTP-only cookies (7-day expiration)
- Password hashing with bcryptjs (10 salt rounds)
- Session validation on protected routes

**Storage Strategy**:
- Chat messages stored as embedded documents in Chat collection
- Maximum 50 recent chats per user
- LocalStorage for theme preference and domain selection
- No client-side password storage

### External Dependencies

**AI Services**:
- **OpenAI API**: GPT-5 and GPT-4o models via official SDK
- **Google Gemini API**: Gemini 2.5 Pro and Flash models via `@google/genai` SDK
- Environment variable `USE_AI_ORCHESTRATOR` enables hybrid routing

**Database**:
- **MongoDB Atlas**: Cloud-hosted MongoDB (connection via `MONGODB_URI` environment variable)

**Third-Party Libraries**:
- `@monaco-editor/react`: Code editor component
- `framer-motion`: UI animations and transitions
- `react-markdown` + `react-syntax-highlighter`: Markdown rendering with code highlighting
- `react-hot-toast`: Toast notifications
- `fuse.js`: Fuzzy search for command palette
- `js-yaml`: YAML template parsing
- `archiver`: Project file compression for downloads

**Development Tools**:
- Playwright for end-to-end testing
- ESLint for code quality
- Tailwind CSS with PostCSS for styling

**Deployment**:
- Vercel for hosting (optimized for Next.js)
- Environment variables required: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `MONGODB_URI`, `JWT_SECRET`