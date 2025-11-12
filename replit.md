# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a modern, full-stack AI coding assistant that leverages multiple AI models (OpenAI GPT-5, Google Gemini 2.5 Pro, and optionally xAI Grok) to provide intelligent code generation, explanation, rewriting, and debugging capabilities. Built with Next.js 14, it features a ChatGPT-like interface with domain-specific assistance, real-time streaming responses, and comprehensive chat management.

The application supports multiple coding domains (General, Web Development, Machine Learning, Data Science, Academic Research, and Prompt Engineering) and intelligently routes requests to the most appropriate AI model based on task complexity and requirements.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router and TypeScript

**State Management**: 
- Zustand for global state (chat messages, user authentication, domain selection, AI model preferences)
- React Context for theming and internationalization

**UI/UX Design System**:
- Industrial-grade glassmorphism with dark/light/system theme support
- CSS variables for comprehensive color tokens and theme consistency
- Typography: Inter for UI components, JetBrains Mono for code blocks
- Framer Motion for smooth animations with `prefers-reduced-motion` support
- Tailwind CSS for utility-first styling with custom extensions

**Key Components**:
- **ChatWindow**: Main conversation interface with message history
- **InputSection**: Multi-line text input with file upload support (images, documents)
- **MonacoCodeOutput**: Lazy-loaded Monaco Editor for syntax-highlighted code display
- **Sidebar**: Fixed navigation with chat history, new chat, settings, and user profile
- **CommandBar**: Global command palette (Cmd/Ctrl+K) with fuzzy search for quick actions
- **DomainSelector**: Dropdown for switching between coding domains
- **ThemeToggle**: Cycles between dark, light, and system themes

**Responsive Layout Strategy**:
- Desktop: 2-column split (chat on left, Monaco code editor on right)
- Tablet: Grid layout with side-by-side panels
- Mobile: Stacked layout with view switching between chat, input, and code output

### Backend Architecture

**API Routes** (Next.js API Routes in `/app/api`):
- `/api/chat`: Main chat endpoint with streaming support for AI responses
- `/api/codegen`: Full application generation with file structure creation
- `/api/research`: Web research integration using Tavily API
- `/api/share`: Create shareable conversation links
- `/api/chats`: CRUD operations for chat history
- `/api/auth/*`: Authentication endpoints (login, signup, logout, session management)
- `/api/webdev/*`: Web development project generation (plan, generate, download)

**AI Orchestration**:
- Smart model selection based on task complexity and domain
- Fallback mechanism: GPT-5 → GPT-4o → Gemini 2.5 Pro → Gemini 2.5 Flash
- Optional xAI Grok integration for advanced reasoning tasks
- Configurable via `USE_AI_ORCHESTRATOR` environment variable

**Prompt Engineering**:
- YAML-based prompt templates for Generate, Explain, Rewrite, and Fix actions
- Domain-specific system instructions injected per conversation
- Temperature control and few-shot examples for consistent output quality

### Data Storage Solutions

**Database**: MongoDB with Mongoose ODM

**Data Models**:
- **User**: Stores user credentials (bcrypt-hashed passwords), profile information, OAuth provider data
- **Chat**: Chat sessions with messages array, user reference, timestamps
- **SharedChat**: Publicly shareable conversations with view counts and expiration
- **Settings**: User preferences (notifications, privacy, accessibility)

**Authentication Strategy**:
- JWT-based session management using `jose` library
- Optional NextAuth integration for Google OAuth
- Secure password hashing with bcryptjs
- HTTP-only cookies for token storage

**Data Persistence**:
- Chat history auto-saved for authenticated users (up to 50 recent conversations)
- LocalStorage for theme preferences, language selection, and temporary state
- Session caching to minimize database queries

### External Dependencies

**AI Services**:
- **OpenAI API**: GPT-5 and GPT-4o models for code generation and reasoning
- **Google Generative AI (Gemini)**: Gemini 2.5 Pro and Flash for multimodal tasks
- **xAI (Optional)**: Grok-4 for advanced reasoning (requires XAI_API_KEY)
- **Tavily API**: Web search integration for research panel

**Third-Party Libraries**:
- **Monaco Editor** (`@monaco-editor/react`): Rich code editing experience
- **Framer Motion**: Animation library for microinteractions
- **React Hot Toast**: Non-intrusive notification system
- **React Markdown + React Syntax Highlighter**: Markdown rendering with code highlighting
- **Fuse.js**: Fuzzy search for command bar
- **Archiver**: ZIP file generation for project downloads
- **Formidable/Multer**: File upload handling
- **Mammoth, pdf-parse, csv-parser**: Document parsing for uploaded files

**Development Tools**:
- **Playwright**: End-to-end testing framework
- **TypeScript**: Type safety across frontend and backend
- **ESLint**: Code quality enforcement

**Deployment Targets**:
- Vercel (recommended for Next.js)
- Replit (development environment with built-in secrets management)

**Environment Configuration**:
Required environment variables validated at startup:
- `OPENAI_API_KEY`: OpenAI API access
- `GEMINI_API_KEY`: Google Generative AI access
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Session encryption key (32+ characters recommended)
- `USE_AI_ORCHESTRATOR`: Enable/disable hybrid AI routing (boolean)
- `XAI_API_KEY`: Optional xAI Grok access
- `TAVILY_API_KEY`: Optional web search integration