# Devmate v2.0 - Hybrid AI Coding Assistant

## Overview

Devmate v2.0 is a full-stack AI coding assistant built with Next.js 14, combining the power of OpenAI's GPT-5 and Google's Gemini 2.5 Pro models. The application provides intelligent code generation, explanation, rewriting, and debugging capabilities through a ChatGPT-like interface with industrial-grade design.

The system features hybrid AI orchestration that intelligently routes requests between GPT-5 and Gemini based on query complexity, domain context, and model availability. Users can interact through a responsive glassmorphism UI with real-time streaming responses, Monaco code editor integration, and comprehensive chat history management.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: Next.js 14 with App Router and React 18  
**Rationale**: Provides server-side rendering, API routes, and modern React features in a single framework. App Router enables better code organization and streaming capabilities.

**State Management**: Zustand  
**Rationale**: Lightweight state management with minimal boilerplate. Two primary stores manage application state:
- `useChatStore`: Manages messages, chat history, domain selection, and model preferences
- `useAuthStore`: Handles user authentication state and session management

**Styling**: Tailwind CSS with custom design system  
**Rationale**: Utility-first CSS framework enabling rapid UI development with consistent design tokens. Custom theme variables support dark/light modes with glassmorphism effects.

**Component Architecture**:
- Lazy-loaded Monaco Editor for code display and editing
- Framer Motion for smooth animations and transitions
- Command Bar (Cmd/K) with fuzzy search using Fuse.js
- Responsive layout: desktop 2-column (chat + code), mobile stacked views

### Backend Architecture

**Runtime**: Node.js API Routes (Next.js)  
**Rationale**: Serverless-ready API routes co-located with frontend code, eliminating need for separate backend deployment.

**AI Orchestration Layer** (`lib/aiOrchestrator.ts`):
- Intelligent model selection based on prompt complexity and domain
- Automatic failover between GPT-5 and Gemini 2.5 Pro
- Streaming support for real-time response rendering
- Model preference: GPT-5 (default) with environment variable override

**Authentication**: JWT-based with Jose library  
**Rationale**: Stateless authentication suitable for serverless deployment. Tokens stored in HTTP-only cookies for security.

**Password Security**: bcryptjs for hashing  
**Rationale**: Industry-standard password hashing with salt rounds.

### Data Storage

**Database**: MongoDB with Mongoose ODM  
**Rationale**: Flexible document schema ideal for storing variable-length chat histories and user data. Connection pooling handled globally to prevent exhaustion in serverless environments.

**Schema Design**:
- **User Model**: Stores authentication credentials, profile data (name, email, avatar)
- **Chat Model**: Stores conversation history with messages array, indexed by userId and timestamps
- **Settings Model**: User preferences for notifications, privacy, and accessibility

**Caching Strategy**: Global connection caching prevents reconnection overhead in serverless functions.

### Authentication & Authorization

**Strategy**: JWT tokens with 7-day expiration  
**Rationale**: Balances security and user convenience. Long-lived tokens reduce re-authentication friction while maintaining reasonable security posture.

**Flow**:
1. User signup/login → credentials validated → JWT generated
2. Token stored in HTTP-only cookie
3. Middleware validates token on protected routes
4. User context available via `getCurrentUser()` helper

### AI Integration

**Primary Models**:
- OpenAI GPT-5 (default for complex reasoning)
- Google Gemini 2.5 Pro (fallback and alternative)

**Model Selection Logic**:
- Short queries (<50 chars) → Gemini Flash for speed
- Code generation/debugging → GPT-5 for accuracy
- Explanations → Gemini Pro for detail
- Domain-specific contexts influence model choice

**Prompt Engineering**:
- YAML-based templates stored in `/config/prompts/`
- Templates include system instructions, temperature, max_tokens, and few-shot examples
- Actions: Generate, Explain, Rewrite, Fix

**Streaming Implementation**:
- Server-sent events for real-time response rendering
- Incremental message updates via `updateLastMessage()` in Zustand store
- Graceful error handling with automatic retry

### File Upload & Analysis

**Supported Formats**: Images, PDFs, DOCX, CSV  
**Processing**: 
- Files converted to base64 for API transmission
- Image analysis uses GPT-4o vision capabilities
- Document parsing via specialized libraries (pdf-parse, mammoth, csv-parser)

**Security**: File size limits enforced, type validation on upload

### API Structure

**Core Endpoints**:
- `/api/chat` - Main AI conversation endpoint (streaming)
- `/api/ai` - Generic AI completion endpoint
- `/api/auth/login` - User authentication
- `/api/auth/signup` - User registration  
- `/api/auth/me` - Get current user session
- `/api/chats` - CRUD operations for chat history
- `/api/analyze` - File upload and analysis
- `/api/analyze-image` - Image-specific analysis with vision models
- `/api/codegen` - Full application generation (advanced feature)

**Response Format**: Consistent JSON structure with error handling
```typescript
{ success: boolean, data?: any, error?: string }
```

## External Dependencies

### AI Services
- **OpenAI API** (GPT-5, GPT-4o) - Primary AI model provider
- **Google Gemini API** (2.5 Pro, 2.5 Flash) - Alternative AI provider
- Required environment variables: `OPENAI_API_KEY`, `GEMINI_API_KEY`

### Database
- **MongoDB Atlas** - Cloud-hosted MongoDB instance
- Required environment variable: `MONGODB_URI`
- Connection string format: `mongodb+srv://...`

### Authentication
- **JWT Secret** - Custom secret key for token signing
- Required environment variable: `JWT_SECRET`
- Should be 32+ character random string

### Frontend Libraries
- **@monaco-editor/react** - VS Code-style code editor
- **framer-motion** - Animation library
- **react-hot-toast** - Toast notifications
- **react-markdown** - Markdown rendering
- **react-syntax-highlighter** - Code syntax highlighting
- **fuse.js** - Fuzzy search for command bar
- **js-yaml** - YAML parsing for prompt templates

### File Processing
- **formidable** - Multipart form data parsing
- **pdf-parse** - PDF text extraction
- **mammoth** - DOCX to HTML conversion
- **csv-parser** - CSV file parsing
- **archiver** - ZIP file creation for project downloads

### Development Tools
- **TypeScript** - Type safety
- **ESLint** - Code linting
- **Autoprefixer** - CSS vendor prefixing
- **@playwright/test** - E2E testing framework

### Optional Features
- Environment flag `USE_AI_ORCHESTRATOR` - Enables/disables hybrid model routing (default: true)
- Environment flag `PREFERRED_GPT_MODEL` - Choose between 'gpt-5' (default) or 'gpt-4o'