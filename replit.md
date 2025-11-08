# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a hybrid AI coding assistant that combines OpenAI GPT-5 and Google Gemini 2.5 Pro to provide intelligent code generation, explanation, refactoring, and debugging capabilities. Built with Next.js 14 and TypeScript, it features a modern glassmorphism UI with dark/light theme support, real-time streaming responses, and full user authentication with MongoDB-backed chat history persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Language**
- Next.js 14 with App Router architecture for server and client components
- TypeScript for type safety across the entire application
- React 18 for component rendering and state management

**UI/UX Design System**
- Tailwind CSS for utility-first styling with custom design tokens
- Framer Motion for smooth animations and microinteractions
- Glassmorphism design pattern with backdrop blur effects
- Responsive layouts: mobile-first stacked design, desktop 2-column split (chat + Monaco editor)
- Dark/Light/System theme modes with localStorage persistence
- Custom CSS variables for consistent color theming

**State Management**
- Zustand for global state (chat messages, authentication, domain selection)
- Separate stores: `useAuthStore` for user session, `useChatStore` for conversation state
- Local state for component-specific UI (modals, dropdowns, loading states)

**Key UI Components**
- Monaco Editor integration for syntax-highlighted code output with copy/download/regenerate actions
- Command Bar (Cmd/Ctrl+K) with fuzzy search for quick actions and template switching
- Real-time streaming message bubbles with markdown and syntax highlighting (react-markdown + react-syntax-highlighter)
- Modal system: Auth, Settings, Onboarding, Help, Share
- Sidebar with chat history, domain selector, and user profile

### Backend Architecture

**API Routes (Next.js 14)**
- `/api/ai/route.ts` - Main AI orchestration endpoint with streaming support
- `/api/auth/*` - JWT-based authentication (login, signup, logout, session check)
- `/api/chats/*` - CRUD operations for chat history
- `/api/share` - Generate shareable conversation links
- `/api/analyze` - File upload and analysis (images, documents)
- `/api/codegen` - Full application generation endpoint

**AI Orchestration Strategy**
- Intelligent model routing based on task complexity, domain, and user preference
- Automatic failover between OpenAI GPT-5, GPT-4o, Gemini 2.5 Pro, and Gemini 2.5 Flash
- Optional xAI Grok integration if API key is provided
- Streaming responses for real-time UX
- Temperature and token control per action type (generate, explain, rewrite, fix)

**Prompt Engineering**
- YAML-based prompt templates stored in `/public/config/prompts/`
- Few-shot learning examples embedded in templates
- Domain-specific system instructions injected at runtime
- Template caching for performance optimization

**Authentication & Authorization**
- JWT tokens (jose library) with 7-day expiration
- bcryptjs for password hashing (salt rounds: 10)
- HTTP-only cookies for token storage (not yet implemented, currently storing in memory)
- Middleware to protect authenticated routes
- Session persistence across page reloads

### Data Storage

**Database**
- MongoDB with Mongoose ODM for schema definition and validation
- Connection pooling with cached connections to optimize serverless performance
- Collections: Users, Chats, Settings, SharedChats

**Schemas**
- **User**: name, email, password (hashed), avatar, timestamps
- **Chat**: userId (ref), title, messages array (nested), createdAt, updatedAt
- **Settings**: userId (ref), notifications, privacy, accessibility preferences
- **SharedChat**: shareId (unique), chatId, title, messages, userId, viewCount, expiresAt

**Data Flow**
- Client → API Route → MongoDB (CRUD operations)
- Optimistic UI updates with Zustand store
- Auto-save chat messages on user send or assistant response completion
- Chat history limited to 50 most recent conversations per user

### External Dependencies

**AI Services**
- OpenAI API (GPT-5, GPT-4o) - Primary model for complex tasks
- Google Gemini API (2.5 Pro, 2.5 Flash) - Fallback and lightweight tasks
- xAI Grok API (optional) - Additional model diversity

**Cloud Services**
- MongoDB Atlas - Production database hosting
- Vercel - Frontend and API deployment platform (intended)
- Replit - Development and prototyping environment

**Third-Party Libraries**
- `@monaco-editor/react` - In-browser code editor (4.7.0)
- `framer-motion` - Animation library (12.23.22)
- `react-hot-toast` - Toast notifications (2.6.0)
- `fuse.js` - Fuzzy search for command bar (7.1.0)
- `js-yaml` - YAML parsing for prompt templates (4.1.0)
- `nanoid` - Unique ID generation (5.1.6)
- `next-auth` - Authentication utilities (4.24.11)
- `archiver` - File compression for exports (7.0.1)
- `csv-parser`, `mammoth`, `pdf-parse` - Document parsing for file uploads

**Environment Variables Required**
- `OPENAI_API_KEY` - OpenAI platform API key
- `GEMINI_API_KEY` - Google AI Studio API key
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - Secret key for JWT signing (32+ characters)
- `XAI_API_KEY` (optional) - xAI Grok API key
- `USE_AI_ORCHESTRATOR` - Enable hybrid routing (recommended: true)

**Security Considerations**
- Password hashing before storage
- JWT secret validation on startup
- Environment variable validation before app initialization
- CORS headers for development mode
- Input sanitization for user prompts and file uploads