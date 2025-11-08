# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a hybrid AI-powered coding assistant built with Next.js 14, leveraging both OpenAI GPT-5 and Google Gemini 2.5 Pro for intelligent code generation, explanation, rewriting, and debugging. The application features a modern glassmorphism UI with dark/light theme support, real-time streaming responses, and comprehensive chat management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (November 2025)

### Google OAuth Integration
- Added NextAuth configuration with Google OAuth provider
- Updated User model to support both OAuth and credential-based authentication
- Modified AuthModal component to include "Continue with Google" button
- Implemented session management with JWT callbacks
- All Google OAuth credentials configured via Replit secrets

### Academic Research RAG Pipeline
- Implemented 7-stage research workflow as specified in requirements:
  1. **Intent Classification**: Analyzes query type (factual, conceptual, comparative, etc.)
  2. **Query Expansion**: Generates 2-3 related search queries for comprehensive coverage
  3. **Parallel Web Retrieval**: Uses Tavily API with Promise.all for fast parallel searches
  4. **Neural Ranking**: LLM-based credibility scoring and source filtering
  5. **Citation Extraction**: Tracks and verifies all source URLs
  6. **Hallucination Guard**: Regex-based citation verification with retry logic
  7. **Transparent Fallback**: When Tavily unavailable, explicitly warns users and labels content as "AI Training Data (Oct 2023 cutoff)" with clear limitations
- Created ResearchPanel UI component with expandable source citations
- Integrated into existing domain selector - activates when "Academic/Research" domain selected
- Fallback mechanism provides transparent warnings about data limitations when web search is unavailable

## System Architecture

### Frontend Architecture

**Framework & Core Technologies**
- Next.js 14 with App Router for server-side rendering and routing
- React 18 for UI components with TypeScript for type safety
- Tailwind CSS for utility-first styling with custom design tokens
- Framer Motion for smooth animations and microinteractions

**State Management**
- Zustand for lightweight global state management
  - `useChatStore`: Manages chat messages, domains, AI model selection, and conversation state
  - `useAuthStore`: Handles user authentication state and session management
- Local storage persistence for theme preferences, domain selection, and model choices

**UI/UX Design System**
- Glassmorphism design with backdrop blur effects and gradient overlays
- CSS custom properties for theming (dark/light/system modes)
- Inter font for UI elements, JetBrains Mono for code blocks
- Responsive layout: Desktop (2-column split), Tablet (grid), Mobile (stacked)
- Command palette (Cmd/Ctrl+K) for quick actions using Fuse.js fuzzy search

**Key Components**
- `ChatWindow`: Main conversation interface with message bubbles
- `InputSection`: Multi-line text input with file upload support
- `MonacoCodeOutput`: Lazy-loaded Monaco Editor for syntax-highlighted code viewing/editing
- `Sidebar`: Navigation with chat history, user profile, and settings
- `DomainSelector`: Dropdown for context switching (General, Web Dev, ML, Data Science, etc.)
- `ThemeProvider`: Context-based theme management with system preference detection
- `CommandBar`: Global command palette with template selection

**Code Highlighting & Rendering**
- React Markdown with remark-gfm for GitHub-flavored markdown
- React Syntax Highlighter with Prism for code blocks
- Monaco Editor for interactive code editing with language detection

### Backend Architecture

**API Routes (Next.js App Router)**
- `/api/chat`: Streaming AI responses with model orchestration
- `/api/codegen`: Full application generation with project scaffolding
- `/api/research`: Web search integration via Tavily API
- `/api/auth/*`: Authentication endpoints (login, signup, session management)
- `/api/chats`: CRUD operations for chat history
- `/api/share`: Generate shareable conversation links
- `/api/settings`: User preference management

**AI Orchestration Layer**
- Intelligent model routing between OpenAI GPT-5, GPT-4o, Gemini 2.5 Pro, Gemini 2.5 Flash
- Optional xAI Grok support (grok-4, grok-2-1212, grok-vision-beta)
- Environment-based model preference with `USE_AI_ORCHESTRATOR` flag
- Prompt template system using YAML configuration for Generate/Explain/Rewrite/Fix actions
- Temperature and max token configuration per action type

**Authentication System**
- JWT-based authentication using Jose library for token signing/verification
- bcryptjs for password hashing
- NextAuth integration for OAuth providers (Google)
- Session persistence with HTTP-only cookies
- Protected API routes with middleware authentication checks

**Prompt Engineering**
- YAML-based prompt templates with few-shot examples
- Domain-specific system instructions (Web Dev, ML, Data Science, etc.)
- Temperature control (0.2-0.4 for code generation, higher for explanations)
- Context injection for multi-turn conversations

### Data Storage Solutions

**Database**
- MongoDB with Mongoose ODM for schema modeling
- Connection pooling with cached connections for serverless optimization
- Collections:
  - `users`: User profiles, credentials, OAuth provider data
  - `chats`: Conversation history with nested message arrays
  - `settings`: User preferences (notifications, privacy, accessibility)
  - `sharedchats`: Public shareable conversation links with view tracking

**Data Models**
- `User`: name, email, password (hashed), avatar, provider (credentials/google), timestamps
- `Chat`: userId (ref), title, messages array (id, type, content, action, domain, timestamp)
- `Settings`: userId (ref), notifications, privacy, accessibility options
- `SharedChat`: shareId (unique), chatId, title, messages, userId, isPublic, viewCount, expiresAt

**Caching Strategy**
- Mongoose connection caching for serverless environments
- Client-side localStorage for theme, domain, and model preferences
- Browser cache for static assets with Vercel CDN optimization

### Authentication & Authorization

**Session Management**
- JWT tokens with 7-day expiration
- HTTP-only cookies for XSS protection
- Server-side token verification on protected routes
- Automatic session refresh on valid token

**OAuth Integration**
- Google OAuth via NextAuth
- Credential-based signup/login fallback
- User profile sync between OAuth and local database

**Security Measures**
- Password hashing with bcrypt (10 salt rounds)
- CORS configuration for development/production environments
- Environment variable validation on startup
- Input sanitization for API endpoints

## External Dependencies

**AI & Machine Learning**
- OpenAI API (GPT-5, GPT-4o): Primary code generation and reasoning
- Google Generative AI SDK (@google/genai): Gemini 2.5 Pro/Flash models
- xAI API (optional): Grok models for alternative AI backend
- Tavily API (@tavily/core): Web search and research capabilities

**Database & Storage**
- MongoDB Atlas: Cloud-hosted MongoDB instance
- Mongoose: ODM for schema validation and connection management

**Authentication**
- NextAuth: OAuth provider integration
- Jose: JWT signing and verification
- bcryptjs: Password hashing

**UI & Frontend Libraries**
- Monaco Editor (@monaco-editor/react): Browser-based code editor
- Framer Motion: Animation library for microinteractions
- React Hot Toast: Non-blocking toast notifications
- Fuse.js: Fuzzy search for command palette
- React Icons: Icon component library

**File Processing**
- Formidable/Multer: File upload handling
- Archiver: ZIP file creation for project downloads
- Mammoth: DOCX file parsing
- pdf-parse: PDF text extraction
- csv-parser: CSV file processing

**Development & Testing**
- Playwright: End-to-end testing framework
- TypeScript: Static type checking
- ESLint: Code linting
- Tailwind CSS: Utility-first CSS framework

**Environment Variables Required**
- `OPENAI_API_KEY`: OpenAI API access
- `GEMINI_API_KEY`: Google Gemini API access
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: JWT token signing secret (32+ characters)
- `USE_AI_ORCHESTRATOR`: Enable hybrid AI routing (optional)
- `XAI_API_KEY`: xAI Grok API access (optional)
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET`: Google OAuth secret (optional)