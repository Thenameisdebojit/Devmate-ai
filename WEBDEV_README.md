# DevMate Web Development Studio

## Overview
The Web Development section of DevMate is a comprehensive, browser-based IDE and AI-powered project generator that allows you to create complete, production-ready web applications from natural language descriptions.

## Features

### 🤖 AI-Powered Generation
- **Multi-Model Support**: Intelligently routes between GPT-5, Gemini 2.5 Pro, and Grok 4 based on task complexity
- **Complete Code Generation**: Generates ALL files needed - no placeholders or TODOs
- **Smart Failover**: Automatically switches to backup models if primary model fails

### 🎨 User Interface
- **PromptBox**: Natural language input with example prompts
- **PlanView**: Detailed architecture preview before generation
- **GeneratorView**: Real-time generation progress and file preview
- **HistoryPanel**: Track previously generated projects

### 🌍 Internationalization
- Full i18n support with English and Odia translations
- Easy to add more languages via JSON configuration files

### 📦 Project Templates
- Next.js Starter (App Router + TypeScript + Tailwind)
- Express REST API (TypeScript + PostgreSQL + JWT)
- Full-Stack Todo App (Next.js + Express + Prisma)
- Blog CMS (Markdown support + SQLite)

## Architecture

```
app/webdev/               # Main Web Dev pages
├── page.tsx             # Main interface
├── editor/              # Code editor (Monaco)
└── preview/             # Live preview

components/webdev/       # UI Components
├── PromptBox.tsx        # Prompt input
├── PlanView.tsx         # Architecture preview
├── GeneratorView.tsx    # Generation progress
└── HistoryPanel.tsx     # Project history

app/api/webdev/          # Backend APIs
├── plan/                # Planning endpoint
├── generate/            # Generation endpoint
└── download/            # Download ZIP

templates/               # Project templates
└── catalog.json         # Template metadata

public/i18n/             # Translations
├── en.json              # English
└── od.json              # Odia
```

## How It Works

### 1. Planning Phase
User submits a natural language description → AI analyzes and creates:
- Architecture overview
- List of files to create
- Database schema (if needed)
- API routes
- Dependencies

### 2. Generation Phase
AI generates complete, production-ready code:
- All files with full implementation
- Error handling and validation
- Comments for complex logic
- Setup instructions

### 3. Output
- Download as ZIP
- Create in workspace
- View/edit files in browser

## API Endpoints

### POST /api/webdev/plan
Creates implementation plan from prompt.

**Request:**
```json
{
  "prompt": "Create a Next.js blog app with..."
}
```

**Response:**
```json
{
  "plan": {
    "architecture": "...",
    "files": ["...", "..."],
    "database": "...",
    "dependencies": ["...", "..."]
  },
  "modelUsed": "openai:gpt-5"
}
```

### POST /api/webdev/generate
Generates complete project files.

**Request:**
```json
{
  "prompt": "Create a Next.js blog app...",
  "plan": { /* plan object */ }
}
```

**Response:** Server-Sent Events stream
```
data: {"type":"status","message":"Starting..."}
data: {"type":"project","data":{...}}
data: {"type":"done"}
```

### POST /api/webdev/download
Creates downloadable ZIP of generated project.

## AI Model Routing

The system intelligently chooses models based on:

1. **Web Development domain**: Always uses GPT-5 or GPT-4o for code generation
2. **Explicit user preference**: Users can manually select Grok 4, Gemini 2.5 Pro, etc.
3. **Task complexity**:
   - Code generation → GPT-5
   - Explanations → Gemini 2.5 Flash (faster)
   - Short queries → Gemini 2.5 Flash
   - Complex architecture → GPT-5 or Grok 4

**Available Models:**
- `openai:gpt-5` - Latest GPT model (default for code)
- `openai:gpt-4o` - Alternative GPT model
- `google:gemini-2.5-pro` - Powerful Gemini model
- `google:gemini-2.5-flash` - Fast Gemini model
- `xai:grok-4` - Latest Grok model
- `xai:grok-2-1212` - Grok 2 (text-only, 131k context)
- `xai:grok-vision-beta` - Grok with vision support

## Example Prompts

### 1. Next.js Blog
```
Create a Next.js blog app with SQLite and Prisma. Features: 
markdown posts, server-side search, comments saved to DB, 
auth via email link. Provide run instructions, Prisma schema, 
and unit tests for the posts API.
```

### 2. Express + React ToDo
```
Create a lightweight Express + React ToDo app with JWT auth, 
Postgres DB, Dockerfile, and Github Actions CI. Include E2E 
Playwright test skeleton.
```

### 3. Landing Page
```
Scaffold a landing page with hero, pricing, and contact form 
that posts to an API route which emails using a mocked SMTP 
service. Provide i18n keys for English and Odia.
```

## Development

### Running Locally
```bash
# Install dependencies
npm install

# Add environment variables
# OPENAI_API_KEY, GEMINI_API_KEY, XAI_API_KEY, MONGODB_URI, JWT_SECRET, TAVILY_API_KEY

# Run development server
npm run dev

# Navigate to http://localhost:5000/webdev
```

### Adding New Templates
1. Add template configuration to `templates/catalog.json`
2. Create template files in `templates/[template-name]/`
3. Update template selection UI in PromptBox

### Adding New Languages
1. Create `public/i18n/[lang-code].json`
2. Copy structure from `en.json`
3. Translate all keys
4. Update language selector component

## Security Features

- Input sanitization on all user prompts
- CSP headers configured
- Rate limiting on API endpoints (TODO: implement)
- Secure cookie flags for sessions
- No secrets in generated code

## Performance Optimizations

- Streaming responses for real-time feedback
- Lazy loading of components
- Code splitting for better load times
- Caching of AI responses (TODO: implement)
- Parallel API requests where possible

## Future Enhancements

- [ ] Monaco editor integration for inline code editing
- [ ] Live preview in iframe
- [ ] Real-time collaboration
- [ ] GitHub integration for direct commits
- [ ] Automated testing of generated code
- [ ] Deploy to Replit with one click
- [ ] Template marketplace
- [ ] AI code review before download

## Troubleshooting

### AI Generation Fails
- Check that all API keys are configured
- Verify internet connection
- Try with a different model
- Simplify your prompt

### Generated Code Has Errors
- AI-generated code should be reviewed before production use
- Run tests if included
- Check dependencies match your environment

### Download Not Working
- Ensure archiver package is installed
- Check browser console for errors
- Try downloading individual files

## Support

For issues or questions:
1. Check the documentation above
2. Review example prompts
3. Try with different AI models
4. Contact support with error logs

## License

Part of DevMate v2.0 - AI-Powered Development Assistant
