# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a hybrid AI-powered coding assistant that intelligently routes requests between OpenAI GPT-5, Google Gemini 2.5 Pro, and xAI Grok models. Built with Next.js 14, it provides code generation, explanation, debugging, and rewriting capabilities across multiple programming domains. The application features a ChatGPT-like interface with real-time streaming responses, domain-specific context switching, and comprehensive chat history management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router and TypeScript, deployed on Vercel

**State Management**: Zustand for global state (chat messages, user authentication, domain selection, AI model preferences)

**UI/UX Design Pattern**: 
- Glassmorphism design system with dark/light/system theme support
- Two-panel desktop layout: chat interface (left) + Monaco code editor (right)
- Mobile-responsive with stacked layout and view switching
- Framer Motion for animations with `prefers-reduced-motion` support
- CSS variables for theming consistency across components

**Key UI Components**:
- `ChatWindow`: Message display with auto-scroll
- `InputSection`: Multi-line prompt input with file upload support (images, folders)
- `MonacoCodeOutput`: Lazy-loaded code editor with syntax highlighting and actions (copy/download/regenerate)
- `Sidebar`: Navigation for new chats, history, settings, user profile
- `CommandBar`: Global command palette (Cmd/Ctrl+K) with fuzzy search via Fuse.js
- `DomainSelector`: Context switcher for General, Web Dev, ML, Data Science, Academic, Prompt Engineering domains

**Internationalization**: i18n support with English and Odia translations via JSON configuration files

### Backend Architecture

**API Layer**: Next.js API routes serving as Node.js backend

**AI Orchestration Strategy**:
- Environment flag `USE_AI_ORCHESTRATOR` enables intelligent model routing
- Primary: GPT-5 for complex reasoning and generation
- Fallback: Gemini 2.5 Pro for vision tasks and high-volume requests
- Optional: Grok-4 for specialized tasks (requires XAI_API_KEY)
- Model selection persists in Zustand store and adapts based on task complexity

**Prompt Engineering**:
- YAML-based prompt templates for Generate, Explain, Rewrite, Fix actions
- Few-shot examples and temperature control (0.2-0.4 for code generation)
- Domain-specific system instructions injected based on user selection
- Template catalog at `/templates/catalog.json`

**Authentication System**:
- NextAuth.js with dual provider support: Google OAuth + JWT-based credentials
- Password hashing via bcryptjs
- JWT token creation/verification using `jose` library
- Session persistence with HTTP-only cookies
- User model stores subscription tier, usage quotas, and provider metadata

**Chat Persistence**:
- Each chat stored with userId, title, messages array, timestamps
- Auto-save on message send (if authenticated)
- History limited to last 50 chats per user
- Share functionality generates public links with optional expiration

### Data Storage

**Database**: MongoDB with Mongoose ODM

**Schema Design**:
- `User`: authentication credentials, subscription status (free/pro/pro_plus), usage quotas, OAuth provider data
- `Chat`: userId reference, message history with action metadata, domain context
- `Settings`: user preferences for notifications, privacy, accessibility
- `SharedChat`: public sharing with shareId, view counter, expiration dates

**Connection Pooling**: Global cached connection pattern to prevent multiple instances in serverless environment

### External Dependencies

**AI Services**:
- OpenAI API (GPT-5, GPT-4o) via `openai` SDK
- Google Gemini API (2.5 Pro, 2.5 Flash) via `@google/genai`
- xAI Grok API (Grok-4, Grok-2, Grok-Vision) via OpenAI-compatible client

**Third-Party Integrations**:
- MongoDB Atlas for database hosting
- Vercel for frontend/API deployment
- Tavily API (`@tavily/core`) for research and web search capabilities
- Stripe (inferred from subscription schema) for payment processing

**Development Tools**:
- Playwright for end-to-end testing
- Monaco Editor for code editing and syntax highlighting
- Archiver for project ZIP downloads in web development studio
- Mammoth, PDF-parse, CSV-parser for document processing

**Required Environment Variables**:
- `OPENAI_API_KEY`: OpenAI API access
- `GEMINI_API_KEY`: Google Gemini API access
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Token signing secret (32+ characters)
- `USE_AI_ORCHESTRATOR`: Enable hybrid routing (true/false)
- `XAI_API_KEY`: Optional xAI Grok access
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: OAuth credentials
- `PREFERRED_GPT_MODEL`: Override default GPT-5 with GPT-4o

**Runtime Validation**: `lib/env-validation.ts` enforces required variables before app startup