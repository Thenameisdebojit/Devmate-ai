# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a modern full-stack AI coding assistant that provides intelligent code generation, explanation, rewriting, and debugging capabilities. Built with Next.js 14 and powered by multiple AI models (OpenAI GPT-5/GPT-4o, Google Gemini 2.5 Pro/Flash, and xAI Grok 4/2/Vision), it features a sophisticated hybrid AI routing system that automatically selects the optimal model for each task.

The application combines a glassmorphic UI with dark/light theme support, real-time streaming responses, sticky header/footer navigation, and Monaco code editor integration. It includes user authentication, persistent chat history storage, conversation export (Markdown/Text), and a comprehensive settings system. The architecture emphasizes performance through lazy loading, code splitting, and efficient state management with Zustand.

## Recent Changes (November 2025)

### November 7, 2025 - Replit Migration & Feature Updates
- **Platform Migration**: Successfully migrated from Vercel to Replit with proper port configuration (5000) and environment setup
- **Grok 4 Integration**: Added xAI's Grok 4 model to the AI orchestrator with full streaming support and UI integration
- **UI/UX Improvements**:
  - Sticky header and footer with backdrop blur for better navigation during scrolling
  - Floating/sticky copy buttons on code blocks that remain visible during scroll
  - Copy and edit buttons added to user messages for easier interaction
  - Improved model badges showing all AI models correctly (GPT-5, GPT-4o, Grok 4, Grok 2, Grok Vision, Gemini Pro, Gemini Flash)
- **Export Feature**: Added conversation export functionality (Markdown and Text formats) replacing broken share links
- **Model Support**: All models (OpenAI, Gemini, Grok) fully integrated with proper error handling and failover logic

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Routing**
- Next.js 14 with App Router for file-based routing and server components
- TypeScript for type safety across the codebase
- React 18 with client/server component separation

**State Management**
- Zustand stores for global state (authentication, chat messages, domain selection)
- localStorage persistence for theme preferences, domain selection, and AI model choice
- Server-side session management with JWT tokens stored in HTTP-only cookies

**UI Design System**
- TailwindCSS with custom design tokens and CSS variables for theming
- Glassmorphism design pattern with backdrop-blur effects and semi-transparent panels
- Framer Motion for animations and microinteractions with accessibility support (prefers-reduced-motion)
- Responsive breakpoints: mobile-first stacked layout, tablet grid, desktop 2-column split
- Typography: Inter for UI text, JetBrains Mono for code blocks

**Component Architecture**
- Lazy-loaded Monaco Editor for code output to reduce initial bundle size
- Command palette (Cmd/Ctrl+K) with Fuse.js fuzzy search
- YAML-based prompt template system for AI actions (Generate, Explain, Rewrite, Fix)
- Modular components: ChatWindow, InputSection, Sidebar, MessageBubble, SettingsModal, ShareChatButton
- Sticky header/footer navigation with backdrop blur for better UX during scrolling
- Floating copy buttons on code blocks that remain visible during scroll
- Conversation export feature (Markdown and Text formats)
- Accessible components with ARIA labels, keyboard navigation, and focus management

### Backend Architecture

**API Routes (Next.js API Routes)**
- RESTful endpoints under `/api/*` using Next.js route handlers
- Authentication endpoints: `/api/auth/login`, `/api/auth/signup`, `/api/auth/me`
- AI endpoints: `/api/ai` (main AI orchestration), `/api/analyze` (file analysis), `/api/analyze-image` (vision)
- Chat management: `/api/chats` (CRUD operations for chat history)
- Health check: `/api/health`

**AI Orchestration Layer**
- Intelligent model selection based on prompt complexity, action type, and domain
- Supported models: GPT-5, GPT-4o, Gemini 2.5 Pro, Gemini 2.5 Flash, Grok 4, Grok 2, Grok Vision
- Failover system: GPT-5 → Gemini 2.5 Pro → Gemini 2.5 Flash
- Streaming support for real-time response delivery across all models
- Environment-based model preference (GPT-5 vs GPT-4o configurable)
- Temperature and token controls per action type via prompt templates
- User can manually select specific models or use auto mode for intelligent routing

**Authentication System**
- JWT-based authentication using `jose` library for token signing/verification
- bcryptjs for password hashing with salt rounds
- HTTP-only cookies for token storage (7-day expiration)
- Middleware-style auth checks in API routes using `getCurrentUser()`

**Prompt Engineering**
- YAML configuration files in `/config/prompts/` for each action type
- Few-shot examples included in templates for improved AI accuracy
- Domain-specific system instructions injected based on user selection
- Temperature ranges: 0.2-0.4 for code generation, higher for explanations

### Data Storage Solutions

**Database**
- MongoDB with Mongoose ODM
- Connection pooling with global caching to prevent connection exhaustion
- Collections: Users, Chats, Settings

**Schema Design**
- **User Model**: name, email, hashed password, avatar (optional), timestamps
- **Chat Model**: userId (ref), title, messages array (embedded documents), timestamps
  - Message subdocuments: id, type (user/assistant), content, action, domain, timestamp
- **Settings Model**: userId (ref), notifications object, privacy object, accessibility object

**Indexes**
- User email index for login lookups
- Chat userId + createdAt compound index for efficient history queries

**Session Management**
- JWT tokens with 7-day expiration stored in HTTP-only cookies
- Server-side verification on protected routes
- Client-side auth state synced via Zustand store

### External Dependencies

**AI Services**
- **OpenAI API**: GPT-5 and GPT-4o models for code generation and analysis
  - Vision support via GPT-4o for image analysis
  - Streaming completions for real-time responses
- **Google Gemini API**: Gemini 2.5 Pro and 2.5 Flash models
  - Used as primary or fallback depending on task complexity
  - ADK/CLI integration via `@google/genai` package
- **xAI Grok**: Grok-4 (latest, most intelligent), Grok-2-1212, Grok-vision-beta
  - Requires XAI_API_KEY environment variable
  - Used via OpenAI-compatible API endpoint at https://api.x.ai/v1
  - Fully integrated with streaming support and model selection UI

**Database Service**
- **MongoDB Atlas**: Cloud-hosted MongoDB instance
  - Connection via MONGODB_URI environment variable
  - Automatic connection retry and caching

**Third-Party Libraries**
- **@monaco-editor/react**: Embedded VS Code editor for code output
- **Fuse.js**: Fuzzy search for command palette
- **react-markdown + remark-gfm**: Markdown rendering with GitHub-flavored syntax
- **react-syntax-highlighter**: Code syntax highlighting with Prism themes
- **Framer Motion**: Animation library for UI transitions
- **react-hot-toast**: Toast notification system
- **js-yaml**: YAML parsing for prompt templates
- **archiver**: ZIP file generation for code exports
- **formidable/multer**: File upload handling

**Development Tools**
- **Playwright**: End-to-end testing framework
- **ESLint**: Code linting with Next.js configuration
- **Autoprefixer**: CSS vendor prefixing
- **TypeScript**: Type checking and IntelliSense

**Environment Configuration**
- Required variables: OPENAI_API_KEY, GEMINI_API_KEY, MONGODB_URI, JWT_SECRET
- Optional variables: XAI_API_KEY, USE_AI_ORCHESTRATOR, PREFERRED_GPT_MODEL
- Validation on startup via `lib/env-validation.ts`
- Setup checker script: `check-env.js` for first-time configuration