# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a hybrid AI-powered coding assistant that intelligently routes between multiple AI providers (OpenAI GPT-5, Google Gemini 2.5 Pro, and optionally xAI Grok) to deliver optimal code generation, explanation, debugging, and rewriting capabilities. Built with Next.js 14 App Router, the application features a modern glassmorphism UI with real-time chat, Monaco code editor integration, and comprehensive project generation tools.

The system supports domain-specific assistance across web development, machine learning, data science, and general programming, with full internationalization support and advanced features like research integration, file uploads, and shareable conversation links.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router and TypeScript
- **UI Framework**: React 18 with Tailwind CSS for styling
- **State Management**: Zustand for global state (chat messages, user auth, settings)
- **Design System**: Custom glassmorphism theme with dark/light/system mode support via ThemeProvider
- **Animation**: Framer Motion for transitions and microinteractions
- **Key Features**:
  - Two-column desktop layout (chat + Monaco editor)
  - Responsive mobile/tablet layouts with view switching
  - Command palette (Cmd/Ctrl+K) for quick actions
  - Real-time streaming AI responses with loading states
  - Markdown rendering with syntax highlighting (react-markdown + react-syntax-highlighter)
  - File upload support (images, documents) via formidable/multer

### Backend Architecture

**API Routes**: Next.js API routes serving as REST endpoints
- **Authentication**: JWT-based auth with bcrypt password hashing
  - Session management via HTTP-only cookies
  - OAuth support via NextAuth (Google provider)
- **AI Orchestration**: Intelligent model routing system
  - Primary models: GPT-5 (OpenAI), Gemini 2.5 Pro (Google)
  - Optional: Grok 4 (xAI) when API key provided
  - Automatic failover between providers
  - Environment-based model preferences
- **Core API Endpoints**:
  - `/api/chat` - Main AI conversation streaming endpoint
  - `/api/auth/*` - Login, signup, session management
  - `/api/chats` - Chat history CRUD operations
  - `/api/share` - Generate shareable conversation links
  - `/api/research` - Tavily-powered web research integration
  - `/api/webdev/*` - Full-stack project generation endpoints

### Data Storage

**Database**: MongoDB via Mongoose ODM
- **Models**:
  - `User` - User profiles with credentials/OAuth data
  - `Chat` - Conversation threads with messages array
  - `SharedChat` - Public shareable conversation snapshots
  - `Settings` - Per-user preferences (notifications, privacy, accessibility)
- **Caching Strategy**: Global mongoose connection caching to prevent connection pool exhaustion
- **Indexing**: userId + createdAt composite indexes for efficient chat history queries

### Authentication & Authorization

**Strategy**: Hybrid JWT + NextAuth
- **JWT Implementation**: jose library for token signing/verification
  - 7-day token expiration
  - Secure HTTP-only cookie storage
- **NextAuth Integration**: OAuth flows with Google provider
  - Automatic user creation on first OAuth login
  - Session callbacks for user ID injection
- **Password Security**: bcryptjs with salt rounds = 10
- **Middleware**: Token verification via `getCurrentUser()` utility

### AI Model Integration

**Multi-Provider Architecture**:
- **OpenAI Client**: Official `openai` SDK
  - Models: gpt-5 (default), gpt-4o (fallback)
  - Environment override: `PREFERRED_GPT_MODEL`
- **Google Gemini Client**: `@google/genai` SDK
  - Models: gemini-2.5-pro, gemini-2.5-flash
- **xAI Client**: Optional OpenAI-compatible client
  - Base URL: `https://api.x.ai/v1`
  - Models: grok-4, grok-2-1212, grok-vision-beta
- **Orchestration Logic** (`lib/aiOrchestrator.ts`):
  - Task complexity assessment
  - Model selection based on domain and action
  - Retry logic with fallback providers
  - Streaming response handling

### Prompt Engineering System

**Template-Based Prompts**: YAML/Markdown templates stored in filesystem
- **Actions**: Generate, Explain, Rewrite, Fix
- **Features**:
  - Domain-specific system instructions
  - Few-shot examples
  - Temperature control (0.2-0.4 for code)
  - Token limit management
- **Loading**: Lazy-loaded via `loadAllTemplates()` utility
- **Search**: Fuse.js fuzzy search integration for command bar

### Web Development Studio

**Full-Stack Project Generator**:
- **Planning Phase**: `/api/webdev/plan` endpoint
  - Architecture analysis
  - File structure generation
  - Dependency resolution
- **Generation Phase**: `/api/webdev/generate` endpoint
  - Complete codebase generation (no placeholders)
  - Multi-file streaming
  - Model usage tracking
- **Templates**: Pre-configured starters (Next.js, Express, Full-stack)
- **Download**: `/api/webdev/download` endpoint with archiver for ZIP export
- **History**: LocalStorage-based project history (last 50 items)

### Research Integration

**Tavily API Integration** (`@tavily/core`):
- Search depth: basic/advanced
- Configurable max results
- Source extraction with metadata
- AI-powered summarization via selected model
- Citation formatting

## External Dependencies

### Core Services

- **MongoDB Atlas**: Primary database (connection string via `MONGODB_URI`)
- **OpenAI API**: GPT-5/GPT-4o models (requires `OPENAI_API_KEY`)
- **Google AI Studio**: Gemini 2.5 models (requires `GEMINI_API_KEY`)
- **xAI API** (Optional): Grok models (requires `XAI_API_KEY`)
- **Tavily API** (Optional): Web research (requires `TAVILY_API_KEY`)

### Third-Party NPM Packages

**AI/ML**:
- `openai` - OpenAI SDK
- `@google/genai` - Google Gemini SDK
- `@tavily/core` - Research API client

**Authentication**:
- `next-auth` - OAuth flows
- `jose` - JWT operations
- `jsonwebtoken` - Legacy JWT support
- `bcryptjs` - Password hashing

**UI/UX**:
- `framer-motion` - Animations
- `react-hot-toast` - Notifications
- `react-icons` - Icon library
- `react-markdown` - Markdown rendering
- `react-syntax-highlighter` - Code highlighting
- `@monaco-editor/react` - Code editor
- `fuse.js` - Fuzzy search

**Utilities**:
- `archiver` - ZIP file creation
- `formidable` - File upload parsing
- `multer` - Multipart form handling
- `mammoth` - DOCX parsing
- `pdf-parse` - PDF text extraction
- `csv-parser` - CSV parsing
- `js-yaml` - YAML template parsing
- `nanoid` - Unique ID generation
- `zod` - Schema validation

### Environment Variables

**Required**:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret for JWT signing
- At least one AI provider key (OPENAI_API_KEY or GEMINI_API_KEY)

**Optional**:
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - OAuth
- `XAI_API_KEY` - Grok model access
- `TAVILY_API_KEY` - Research features
- `PREFERRED_GPT_MODEL` - Override default GPT model
- `USE_AI_ORCHESTRATOR` - Enable hybrid routing (recommended: `true`)

### Deployment Considerations

- **Platform**: Optimized for Vercel deployment
- **Build**: Next.js static optimization with API routes
- **CORS**: Development-only CORS headers via `next.config.js`
- **Validation**: Startup environment check via `lib/env-validation.ts`
- **Monitoring**: Client-side error boundaries and toast notifications