# Devmate v2.0 - Hybrid AI Coding Assistant

## Overview

Devmate is a modern full-stack AI coding assistant built with Next.js 14, featuring intelligent hybrid routing between OpenAI GPT-5 and Google Gemini 2.5 Pro. The application provides code generation, explanation, debugging, and rewriting capabilities with a ChatGPT-inspired user interface. It includes user authentication, chat history persistence, and a responsive design system with dark/light theme support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing**
- Next.js 14 with App Router for server-side rendering and API routes
- TypeScript for type safety across the application
- React 18 with client-side state management via Zustand

**UI/UX Design System**
- Tailwind CSS with custom design tokens for glassmorphism effects
- Dark/light/system theme support with persistent localStorage
- Framer Motion for animations and microinteractions
- Inter font for UI, JetBrains Mono for code blocks
- Responsive layout: desktop 2-column (chat + Monaco editor), mobile stacked views

**Key Components**
- `ChatWindow`: Main conversation interface with message bubbles
- `MonacoCodeOutput`: Lazy-loaded Monaco Editor for syntax-highlighted code viewing/editing
- `InputSection`: Multi-modal input with file upload support (images, documents)
- `Sidebar`: Navigation with chat history, settings, and user profile
- `CommandBar`: Global command palette (Cmd/Ctrl+K) with fuzzy search
- `DomainSelector`: Context switching for specialized AI assistance (Web Dev, ML, Data Science, etc.)
- `AuthModal`, `SettingsModal`, `OnboardingModal`: User management interfaces

**State Management**
- Zustand stores for chat state (`useChatStore`) and authentication (`useAuthStore`)
- LocalStorage persistence for theme, domain preferences, and model selection
- Real-time message streaming with progressive updates

### Backend Architecture

**API Routes (Next.js App Router)**
- `/api/chat`: Main AI interaction endpoint with streaming support
- `/api/ai`: Generic AI orchestration endpoint with model selection
- `/api/auth/*`: Authentication endpoints (login, signup, logout, session check)
- `/api/chats/*`: Chat history CRUD operations
- `/api/analyze`: File analysis (images, documents) using GPT-4o vision
- `/api/codegen`: Application generation endpoint

**AI Orchestration Layer** (`lib/aiOrchestrator.ts`)
- Intelligent model routing based on prompt complexity, action type, and domain
- Automatic failover between GPT-5 and Gemini 2.5 Pro
- Environment variable `USE_AI_ORCHESTRATOR` to enable/disable hybrid mode
- Model preference: GPT-5 (default) or GPT-4o via `PREFERRED_GPT_MODEL`
- Support for streaming responses with proper error handling

**Authentication & Session Management** (`lib/auth.ts`)
- JWT-based authentication using jose library
- Password hashing with bcryptjs
- HTTP-only cookie storage for auth tokens (7-day expiration)
- Server-side session verification via `getCurrentUser()`

**Prompt Engineering**
- YAML-based prompt templates (`app/utils/promptTemplates.ts`)
- Domain-specific system instructions with few-shot examples
- Temperature control (0.2-0.4 for code generation)
- Action-specific templates: Generate, Explain, Rewrite, Fix

### Data Storage

**Database**
- MongoDB with Mongoose ODM for schema validation
- Connection pooling via cached global connection pattern
- Collections:
  - `users`: User profiles (name, email, hashed password, avatar)
  - `chats`: Conversation history (userId, title, messages array, timestamps)
  - `settings`: User preferences (notifications, privacy, accessibility)

**Schemas**
- `User`: name, email, password (bcrypt hashed), avatar, timestamps
- `Chat`: userId reference, title, messages array (id, type, content, action, domain, timestamp)
- `Settings`: userId reference, notification preferences, privacy settings, accessibility options

**Indexing Strategy**
- User email index for fast authentication lookups
- Chat userId + createdAt composite index for history retrieval (sorted, limited to 50)

### External Dependencies

**AI Services**
- OpenAI API (GPT-5, GPT-4o) via `openai` npm package
- Google Gemini API (2.5-pro, 2.5-flash) via `@google/genai`
- Required environment variables: `OPENAI_API_KEY`, `GEMINI_API_KEY`

**Database**
- MongoDB Atlas or self-hosted MongoDB instance
- Required environment variable: `MONGODB_URI`

**File Processing**
- `formidable` or `multer` for multipart form handling
- `pdf-parse` for PDF text extraction
- `mammoth` for DOCX parsing
- `csv-parser` for CSV processing
- Base64 encoding for image uploads to vision models

**UI & Developer Tools**
- Monaco Editor (`@monaco-editor/react`) for code editing with lazy loading
- React Markdown with `remark-gfm` for message rendering
- Syntax highlighting via `react-syntax-highlighter`
- Fuse.js for fuzzy search in command palette
- React Hot Toast for notifications
- React Icons (Feather icons)
- Framer Motion for animations

**Build & Development**
- Next.js build system with Turbopack (dev mode)
- Tailwind CSS with autoprefixer
- TypeScript strict mode enabled
- ESLint for code quality

**Security & Validation**
- JWT token signing/verification with jose
- Password hashing with bcryptjs (10 rounds)
- Environment variable validation on startup (`lib/env-validation.ts`)
- CORS headers configured for development mode

**Deployment Considerations**
- Designed for Vercel deployment with serverless functions
- Environment variables must be configured in deployment platform
- MongoDB connection uses connection pooling for serverless compatibility
- Static assets and fonts served from CDN (Google Fonts)