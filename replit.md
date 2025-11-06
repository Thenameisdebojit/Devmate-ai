# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a full-stack AI coding assistant built with Next.js 14, featuring hybrid AI model routing between OpenAI GPT-5 and Google Gemini 2.5 Pro. The application provides intelligent code generation, explanation, rewriting, and debugging capabilities with a modern glassmorphism UI and comprehensive user authentication.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router
- **UI Library**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: Zustand for global state (chat, authentication)
- **Animations**: Framer Motion for microinteractions and transitions
- **Code Editor**: Monaco Editor (lazy-loaded) for syntax-highlighted code output
- **Theming**: Custom theme provider supporting dark, light, and system modes with localStorage persistence

**Key Design Decisions**:
- **Glassmorphism Design System**: Backdrop blur effects with semi-transparent panels, gradient accents, and CSS variables for consistent theming
- **Responsive Layout**: Desktop uses 2-column split (chat + Monaco editor), tablet uses flexible grid, mobile stacks vertically
- **Command Palette**: Global keyboard shortcut (Cmd/Ctrl+K) with fuzzy search for quick actions and template switching
- **Accessibility**: ARIA labels, keyboard navigation, focus management, WCAG AA contrast compliance

### Backend Architecture

**API Routes** (Next.js serverless functions):
- `/api/chat` - Main AI chat endpoint with streaming support
- `/api/ai` - Orchestrated AI routing with model selection
- `/api/auth/*` - Authentication endpoints (login, signup, logout, session check)
- `/api/chats` - Chat history CRUD operations
- `/api/upload` - File upload handling (images, documents)
- `/api/analyze` - File analysis endpoint
- `/api/codegen` - Full application generation

**AI Model Orchestration**:
- Intelligent model routing based on task type (code generation → GPT-5, reasoning → Gemini 2.5 Pro)
- Automatic failover between OpenAI and Google Gemini models
- Configurable via `USE_AI_ORCHESTRATOR` environment variable
- Supports streaming responses for real-time output

**Authentication System**:
- JWT-based authentication using `jose` library
- Password hashing with bcryptjs
- HTTP-only cookies for token storage
- Session persistence and automatic token refresh

**Prompt Engineering**:
- YAML-based prompt templates stored in `/config/prompts/`
- Templates include system instructions, few-shot examples, and temperature settings
- Four action types: Generate, Explain, Rewrite, Fix
- Domain-specific context injection

### Data Architecture

**Database**: MongoDB with Mongoose ODM

**Schemas**:
1. **User Model** (`models/User.ts`)
   - Fields: name, email, password (hashed), avatar, timestamps
   - Index on email for fast lookups

2. **Chat Model** (`models/Chat.ts`)
   - Fields: userId (reference), title, messages array, timestamps
   - Composite index on userId and createdAt
   - Supports up to 50 chat histories per user

3. **Settings Model** (`models/Settings.ts`)
   - User-specific preferences for notifications, privacy, accessibility
   - One-to-one relationship with User

**State Management**:
- `useChatStore` - Messages, current domain, last request tracking
- `useAuthStore` - User session, authentication state, login/logout actions
- LocalStorage used for theme preference and domain selection persistence

### File Upload & Processing

**Supported Formats**:
- Images: Analyzed using GPT-4o vision model
- Documents: PDF, DOCX, CSV parsing for code context
- Multi-file upload with preview and removal functionality

**Processing Pipeline**:
1. FormData received at `/api/upload`
2. Files converted to base64 or parsed text
3. Content sent to AI model for analysis
4. Results streamed back to client

## External Dependencies

### AI Services
- **OpenAI API**: GPT-5 and GPT-4o models for code generation
  - Required environment variable: `OPENAI_API_KEY`
  - Fallback model configurable via `PREFERRED_GPT_MODEL`
  
- **Google Gemini API**: Gemini 2.5 Pro and Flash for reasoning tasks
  - Required environment variable: `GEMINI_API_KEY`
  - SDK: `@google/genai`

### Database
- **MongoDB Atlas**: Cloud-hosted MongoDB instance
  - Required environment variable: `MONGODB_URI`
  - Connection pooling via Mongoose with cached connections

### Core Libraries
- **Authentication**: `jose` (JWT), `bcryptjs` (password hashing), `jsonwebtoken`
- **File Processing**: `formidable`, `multer`, `archiver`, `pdf-parse`, `mammoth`, `csv-parser`
- **UI Components**: `react-hot-toast` (notifications), `react-markdown`, `react-syntax-highlighter`, `@monaco-editor/react`
- **Utilities**: `fuse.js` (fuzzy search), `js-yaml` (template parsing), `remark-gfm` (Markdown rendering)

### Development Tools
- **Testing**: Playwright for end-to-end tests
- **Linting**: ESLint with Next.js config
- **CSS Processing**: PostCSS with Autoprefixer

### Environment Variables
Required for production:
```
OPENAI_API_KEY          # OpenAI API access (GPT-5, GPT-4o)
GEMINI_API_KEY          # Google Gemini API access (2.5 Pro, 2.5 Flash)
MONGODB_URI             # MongoDB connection string (optional for AI features)
JWT_SECRET              # JWT signing secret (32+ characters, optional)
USE_AI_ORCHESTRATOR     # Enable hybrid AI routing (recommended: true)
PREFERRED_GPT_MODEL     # Optional: 'gpt-4o' or 'gpt-5' (default: gpt-5)
```

## Multi-Model AI System (Updated 2025-11-06)

**Status: ✅ FULLY OPERATIONAL**

DevMate features an intelligent hybrid AI system with automatic failover:

**Model Selection Logic:**
- **Code tasks** (generate, build, web development) → OpenAI GPT-5 or GPT-4o
- **Reasoning tasks** (explain, analyze, summarize) → Google Gemini 2.5 Pro
- **Automatic failover**: If primary model fails → tries alternative GPT → falls back to Gemini

**Failover Chain:**
- GPT-5 fails → GPT-4o → Gemini 2.5 Pro
- GPT-4o fails → GPT-5 → Gemini 2.5 Pro  
- Gemini fails → Preferred GPT model

**Configuration:**
Set `PREFERRED_GPT_MODEL=gpt-4o` to use GPT-4o as primary instead of GPT-5.

**API Endpoints:**
- `/api/ai` - Direct AI completions with automatic model routing
- `/api/chat` - Chat interface with history and file upload support

See `AI_SYSTEM_DOCUMENTATION.md` for complete details.

### Deployment Considerations
- **Platform**: Optimized for Vercel deployment
- **Build**: Static generation where possible, SSR for dynamic routes
- **Port**: Configurable via `-p` flag (default: 5000 for local development)
- **CORS**: Enabled for cross-origin API requests