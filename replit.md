# Devmate v2.0 - Hybrid AI Coding Assistant

## Overview

Devmate is a modern AI-powered coding assistant built with Next.js 14, featuring a hybrid AI system that intelligently routes requests between **OpenAI GPT-5** and **Google Gemini 2.5 Pro** for optimal performance. The application provides a ChatGPT-like experience with specialized features for developers, including full application generation, Monaco code editor integration, domain-specific assistance, and multi-file analysis capabilities.

The platform supports authenticated users with persistent chat history, customizable settings, and a responsive glassmorphic UI that works seamlessly across desktop and mobile devices.

### Key Enhancements (Latest Update)
- **Hybrid AI System**: Intelligent model routing between GPT-5 (for code/building) and Gemini 2.5 Pro (for reasoning/analysis)
- **Full App Generator**: Generate complete applications (React, Next.js, Express, Flask, etc.) from natural language descriptions
- **Project Export**: ZIP download of generated applications with complete file structure
- **Real-time Progress**: Live generation progress indicators and logs
- **Automatic Failover**: Seamless switching between AI models if one fails

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router
- TypeScript for type safety
- Server and client components separation
- App directory structure for routing

**UI/UX Design System**:
- **Styling**: Tailwind CSS with custom design tokens
- **Theme System**: Dark/light/system modes with localStorage persistence
- **Animation**: Framer Motion for microinteractions and page transitions
- **Typography**: Inter for UI, JetBrains Mono for code blocks
- **Design Pattern**: Glassmorphism with backdrop blur effects and soft gradients

**State Management**:
- Zustand for client-side state (chat messages, auth, domain selection)
- React Context for theme provider
- Local storage for preferences persistence

**Key Components**:
- `ChatWindow`: Message display with markdown rendering
- `MonacoCodeOutput`: Lazy-loaded Monaco editor for code viewing/editing
- `InputSection`: Multi-line prompt input with file upload support
- `CommandBar`: Global command palette (Cmd/Ctrl+K) with fuzzy search
- `Sidebar`: Navigation with chat history and user menu
- `DomainSelector`: Dropdown for context switching (General, Web Dev, ML, Data Science, etc.)

**Responsive Layout**:
- Desktop: 2-column split (chat + Monaco editor side-by-side)
- Tablet: Grid layout with flexible panels
- Mobile: Stacked layout with view switching

### Backend Architecture

**API Routes** (Next.js API handlers):
- `/api/chat`: Main AI interaction endpoint with streaming support
- `/api/auth/*`: Authentication endpoints (login, signup, logout, me)
- `/api/chats`: Chat history CRUD operations
- `/api/settings`: User settings management
- `/api/upload`: Multi-file processing (PDF, DOCX, images, CSV)
- `/api/analyze`: File content analysis
- `/api/analyze-image`: Vision API integration for image analysis
- `/api/health`: Service health check

**AI Integration**:
- **Hybrid System**: OpenAI GPT-5 + Google Gemini 2.5 Pro with intelligent routing
- **AI Orchestrator** (`lib/aiOrchestrator.ts`): Chooses best model per task
  - GPT-5 for: code generation, building, complex implementations, Web Development domain
  - Gemini 2.5 Pro for: reasoning, explanations, analysis, retrieval tasks
  - Automatic failover between models
- **Streaming Support**: Real-time responses for both OpenAI and Gemini
- **Temperature Control**: 0.2-0.4 for code generation, 0.8 for conversations
- **Context-Aware Prompting**: Domain specialization with intent detection
- **Full App Generation** (`/api/codegen`): Complete application generation with multi-framework support

**Prompt Engineering**:
- YAML-based template system stored in `/config/prompts/`
- Actions: Generate, Explain, Rewrite, Fix
- Few-shot examples for improved accuracy
- Domain-specific system instructions
- Template caching for performance

**Authentication**:
- JWT-based authentication using `jose` library
- Password hashing with `bcryptjs`
- HTTP-only cookies for token storage
- Session persistence across page refreshes

**File Processing**:
- PDF parsing via `pdf-parse`
- DOCX extraction via `mammoth`
- CSV parsing via `csv-parser`
- Image analysis via OpenAI Vision API
- Multi-file upload support with `formidable`

### Data Storage

**Database**: MongoDB with Mongoose ODM

**Schema Design**:
- `User`: Authentication and profile data (name, email, hashed password, avatar)
- `Chat`: Conversation history with embedded messages array (userId reference, title, timestamps)
- `Settings`: User preferences (notifications, privacy, accessibility)

**Indexing Strategy**:
- User email (unique index)
- Chat queries by userId + createdAt (compound index for efficient history retrieval)

**Connection Management**:
- Global singleton pattern for connection reuse
- Connection caching to prevent multiple database connections
- Graceful error handling with environment variable validation

### Performance Optimizations

- **Code Splitting**: Dynamic imports for Monaco Editor and heavy components
- **Lazy Loading**: Suspense boundaries for auth/settings modals
- **Caching**: Prompt template caching, MongoDB connection pooling
- **Bundle Optimization**: Next.js automatic code splitting per route
- **Image Optimization**: Base64 encoding for small assets, lazy loading for large files

### Accessibility Features

- ARIA labels and semantic HTML throughout
- Keyboard navigation support (Tab, Enter, Escape)
- Focus management for modals and dropdowns
- WCAG AA contrast ratios in both themes
- `prefers-reduced-motion` media query support
- Screen reader-friendly error messages

### Security Considerations

- HTTP-only cookies prevent XSS token theft
- CORS headers configured in `next.config.js`
- Password hashing before storage (bcrypt with salt rounds)
- Environment variable validation on startup
- JWT expiration (7-day default)
- Input sanitization for file uploads

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4 for chat completions and Vision API for image analysis
  - Required: `OPENAI_API_KEY` environment variable
  - Fallback model support (can be configured)

### Database
- **MongoDB Atlas**: Cloud-hosted MongoDB database
  - Required: `MONGODB_URI` environment variable
  - Connection string format: `mongodb+srv://...`

### Authentication
- **JWT Secret**: Custom secret key for token signing
  - Required: `JWT_SECRET` environment variable (32+ characters recommended)

### Third-Party Packages
- **Core Framework**: `next@14.2.33`, `react@18.3.1`, `react-dom@18.3.1`
- **AI/ML**: `openai@6.8.1`, `@google/genai@1.28.0` (legacy Gemini support)
- **Database**: `mongoose@8.19.1`, `mongodb` (peer dependency)
- **Authentication**: `jose@6.1.0`, `bcryptjs@3.0.2`, `jsonwebtoken@9.0.2`
- **UI Components**: `framer-motion@12.23.22`, `@monaco-editor/react@4.7.0`
- **File Processing**: `pdf-parse@2.4.5`, `mammoth@1.11.0`, `csv-parser@3.2.0`, `formidable@3.5.4`
- **Markdown Rendering**: `react-markdown@10.1.0`, `remark-gfm@4.0.1`, `react-syntax-highlighter@15.6.6`
- **Utilities**: `zustand@5.0.8`, `react-hot-toast@2.6.0`, `fuse.js@7.1.0`, `js-yaml@4.1.0`

### Development Dependencies
- TypeScript and type definitions
- Tailwind CSS with PostCSS and Autoprefixer
- ESLint with Next.js config
- Playwright for E2E testing

### Deployment Platform
- **Vercel**: Optimized for Next.js deployment
  - Environment variables configured via Vercel dashboard
  - Automatic HTTPS and CDN distribution
  - Serverless function support for API routes