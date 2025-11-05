# Devmate v2.0 - AI Coding Assistant

## Overview

Devmate is a full-stack AI coding assistant powered by OpenAI's GPT models, built with Next.js 14 (App Router). The application provides intelligent code generation, explanation, rewriting, and debugging capabilities across multiple programming domains. It features a modern glassmorphism UI with dark/light theme support, user authentication, chat history persistence, and an advanced Monaco code editor integration.

The system is designed as a ChatGPT-like experience for developers, offering multi-turn conversations, domain-specific context switching, file upload capabilities (images, PDFs, Word documents), and prompt template management with few-shot learning examples.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router and React 18
- **UI Components**: Modular component architecture with Framer Motion animations
- **State Management**: Zustand for global state (auth, chat messages, settings)
- **Styling**: TailwindCSS with custom design tokens for glassmorphism and theme variables
- **Code Editor**: Monaco Editor (lazy-loaded) for syntax highlighting and code manipulation
- **Responsive Design**: Mobile-first approach with desktop 2-column layout (chat + code output)

**Key Design Patterns**:
- **Glassmorphism Design System**: CSS variables for consistent theming across dark/light modes
- **Command Palette**: Global Cmd/Ctrl+K shortcut using Fuse.js for fuzzy search across actions and templates
- **Theme Management**: Client-side theme provider with localStorage persistence and system preference detection
- **Animation System**: Framer Motion for microinteractions with `prefers-reduced-motion` support
- **Accessibility**: ARIA labels, keyboard navigation, focus management, WCAG AA contrast compliance

**Component Structure**:
- `ChatWindow`: Message display with auto-scroll and skeleton loaders
- `InputSection`: Multi-line textarea with file upload (images, PDFs, DOCX)
- `MonacoCodeOutput`: Lazy-loaded code editor with copy/download/regenerate actions
- `Sidebar`: Fixed navigation with chat history, profile, settings, and user guide
- `CommandBar`: Fuzzy-searchable action palette for quick template switching
- `AuthModal`, `SettingsModal`, `OnboardingModal`, `HelpModal`: Feature-specific modals

### Backend Architecture

**Runtime**: Node.js API routes within Next.js 14
- **API Design**: RESTful endpoints using Next.js Route Handlers
- **Authentication**: JWT-based auth using `jose` library with HTTP-only cookies
- **Password Security**: bcryptjs for hashing with salt rounds

**Core API Endpoints**:
- `/api/chat` - Streaming AI responses with intent detection (conversation vs code generation)
- `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/auth/me` - User authentication flow
- `/api/chats` - CRUD operations for chat history
- `/api/settings` - User preference management
- `/api/upload` - Multi-format file processing (images, PDFs, DOCX)
- `/api/analyze-image` - GPT-4 Vision integration for image analysis
- `/api/health` - Service health checks

**AI Integration**:
- **Primary Model**: OpenAI GPT-4 (configurable via templates)
- **Temperature Control**: 0.2-0.4 for code generation, higher for explanations
- **System Prompts**: Elite software engineer persona with production-grade code emphasis
- **Intent Detection**: Heuristic-based classification (greetings, code requests, general questions)
- **Streaming**: Real-time token streaming for ChatGPT-like UX
- **Context Management**: Multi-turn conversation history with domain-specific context injection

**Prompt Template System**:
- YAML-based templates stored in `/config/prompts/` (generate.yaml, explain.yaml, rewrite.yaml, fix.yaml)
- Each template includes: model, temperature, max_tokens, system instructions, few-shot examples
- Runtime template loading with caching for performance

### Data Storage

**Database**: MongoDB with Mongoose ODM
- **Connection Management**: Connection pooling with cached singleton pattern to prevent connection exhaustion
- **Models**:
  - `User`: name, email, hashed password, avatar, timestamps
  - `Chat`: userId reference, title, messages array (id, type, content, action, domain, timestamp), timestamps
  - `Settings`: userId reference, notifications preferences, privacy settings, accessibility options

**Data Flow**:
1. User authenticates → JWT token stored in HTTP-only cookie
2. Chat messages stored in Zustand (client) + MongoDB (server) when authenticated
3. File uploads processed server-side, converted to base64 or text extraction
4. Settings synchronized between client localStorage and MongoDB

**Indexing Strategy**:
- User model: email index for fast login lookups
- Chat model: compound index on userId + createdAt for efficient history queries

### Authentication & Authorization

**Mechanism**: JWT with `jose` library (JOSE standard)
- **Token Creation**: HS256 algorithm with 7-day expiration
- **Storage**: HTTP-only cookies (secure in production, SameSite=lax)
- **Session Persistence**: Server-side validation on protected routes via `getCurrentUser()` middleware
- **Password Policy**: Minimum 6 characters, bcrypt hashing with default salt rounds (10)

**Protected Routes**:
- All `/api/chats/*`, `/api/settings/*`, `/api/analyze/*` require valid JWT
- Unauthorized requests return 401 with error message
- Frontend auth store manages authentication state and auto-checks on mount

## External Dependencies

### Third-Party APIs

1. **OpenAI API** (primary AI provider)
   - **Models Used**: GPT-4, GPT-4 Vision (for image analysis)
   - **Features**: Chat completions, streaming responses, vision analysis
   - **Configuration**: Requires `OPENAI_API_KEY` environment variable
   - **Fallback**: Application displays 503 if API key not configured

2. **Google Gemini API** (legacy references, not actively used)
   - **Note**: Package `@google/generative-ai` installed but code uses OpenAI exclusively
   - **Recommendation**: Remove if not planning Gemini integration

### Database Services

**MongoDB Atlas** (cloud-hosted MongoDB)
- **Connection String**: `MONGODB_URI` environment variable
- **Features**: User data, chat history, settings persistence
- **Error Handling**: Connection failures caught and cached; warnings logged if URI missing

### NPM Packages

**Core Framework**:
- `next@14.2.33` - React framework with App Router
- `react@18.3.1`, `react-dom@18.3.1` - UI library

**AI & API**:
- `openai@6.8.1` - OpenAI SDK for GPT integration
- `@google/generative-ai@0.21.0` - Google Gemini SDK (unused)

**Authentication & Security**:
- `jose@6.1.0` - JWT creation and verification
- `bcryptjs@3.0.2` - Password hashing
- `jsonwebtoken@9.0.2` - Alternative JWT library (jose preferred)

**Database**:
- `mongoose@8.19.1` - MongoDB ODM

**UI & Animation**:
- `framer-motion@12.23.22` - Animation library
- `@monaco-editor/react@4.7.0` - Code editor component
- `react-icons@5.5.0` - Icon library
- `react-hot-toast@2.6.0` - Toast notifications
- `tailwindcss@3.x` (dev) - Utility-first CSS framework

**Markdown & Code Highlighting**:
- `react-markdown@10.1.0` - Markdown rendering
- `react-syntax-highlighter@15.6.6` - Code syntax highlighting
- `remark-gfm@4.0.1` - GitHub Flavored Markdown support

**File Processing**:
- `pdf-parse@2.4.5` - PDF text extraction
- `mammoth@1.11.0` - DOCX to HTML/text conversion
- `formidable@3.5.4`, `multer@2.0.2` - File upload handling
- `csv-parser@3.2.0` - CSV file processing

**Utilities**:
- `zustand@5.0.8` - Lightweight state management
- `fuse.js@7.1.0` - Fuzzy search for command palette
- `js-yaml@4.1.0` - YAML template parsing

**Testing**:
- `@playwright/test@1.56.0` - End-to-end testing framework

### Environment Variables

**Required**:
- `OPENAI_API_KEY` - OpenAI API key from platform.openai.com
- `MONGODB_URI` - MongoDB connection string from MongoDB Atlas
- `JWT_SECRET` - Secret key for JWT signing (32+ characters recommended)

**Setup**:
- Environment variables stored in `.env.local` (gitignored)
- Template file: `.env.local.example`
- Validation script: `check-env.js` (Node.js script to verify setup)
- Quick fix utility: `QUICK_FIX.bat` (Windows) or `node check-env.js` (cross-platform)

### Deployment

**Target Platform**: Vercel (optimized for Next.js)
- **Build Command**: `npm run build`
- **Start Command**: `npm start -p 5000 -H 0.0.0.0`
- **Node Version**: 20.x (via package.json engines field)
- **Edge Runtime**: Not used (all API routes use Node.js runtime)

**Configuration**:
- `next.config.js` sets CORS headers for API routes
- `vercel.json` (if present) for platform-specific settings
- Environment variables must be set in Vercel dashboard

**Known Issues**:
- Build failures if `lib/mongodb.ts` or `lib/auth.ts` missing (ensure all files committed)
- MongoDB connection errors if URI not set in production environment
- API rate limits from OpenAI (no built-in retry logic)