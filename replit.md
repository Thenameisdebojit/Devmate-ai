# Devmate v2.0 - Hybrid AI Coding Assistant

## Project Overview
A modern, full-stack AI coding assistant powered by OpenAI GPT-5 and Google Gemini 2.5 Pro, built with Next.js 14. Features intelligent model routing, full application generation capabilities, and a beautiful glassmorphism UI.

## Current State
**Status**: ✅ Successfully migrated from Vercel to Replit - running in development mode
**Last Updated**: November 7, 2025
**Version**: 2.0.0
**Environment**: Development (ready for production deployment)

## Recent Changes

### November 7, 2025 - Vercel to Replit Migration
- Migrated entire project from Vercel to Replit environment
- Configured all required environment variables in Replit Secrets (OPENAI_API_KEY, GEMINI_API_KEY, MONGODB_URI, JWT_SECRET)
- Set up development workflow (npm run dev on port 5000 with 0.0.0.0 binding)
- Configured deployment settings for autoscale production publishing (verified in .replit file)
  - Build command: `npm run build`
  - Run command: `npm run start`
  - Deployment target: autoscale
- Verified all API endpoints are functioning correctly
  - Health check endpoint (`/api/health`) returns 200 OK
  - Auth endpoints (`/api/auth/me`) return expected 401 for unauthenticated requests
  - Confirmed MongoDB Atlas connection is working (no connection errors in logs)
- Application successfully running in development mode with no errors
- Created comprehensive documentation (replit.md)
- Verified production build and start commands work correctly
  - `npm run build` completes successfully with expected dynamic route warnings
  - `npm run start` starts production server on port 5000
  - Production health check verified: API returns `{"status":"ok"}`
- Migration complete - ready for production deployment via Replit Publish button

## Environment Configuration

### Required Environment Variables (Configured in Replit Secrets)
- `OPENAI_API_KEY` - OpenAI API key for GPT-5 code generation
- `GEMINI_API_KEY` - Google Gemini API key for AI reasoning
- `MONGODB_URI` - MongoDB Atlas connection string
- `JWT_SECRET` - Secret key for JWT authentication (32+ characters)

### Optional Environment Variables
- `USE_AI_ORCHESTRATOR` - Set to 'true' to enable hybrid AI routing (default: true)
- `PREFERRED_GPT_MODEL` - Choose between 'gpt-4o' or 'gpt-5' (default: 'gpt-5')

## Project Architecture

### Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom glassmorphism
- **State Management**: Zustand
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with HTTP-only cookies
- **AI Models**: 
  - OpenAI GPT-5 (code generation, building, complex tasks)
  - Google Gemini 2.5 Pro/Flash (reasoning, explanations, analysis)
- **Code Editor**: Monaco Editor (lazy-loaded)
- **Animations**: Framer Motion
- **Notifications**: React Hot Toast

### Project Structure
```
devmate/
├── app/                    # Next.js App Router pages and components
│   ├── api/               # API routes (auth, chat, health)
│   ├── components/        # React components
│   ├── store/             # Zustand state stores
│   └── utils/             # Utility functions
├── lib/                   # Server-side utilities
│   ├── aiOrchestrator.ts  # AI model routing logic
│   ├── auth.ts            # JWT authentication
│   └── mongodb.ts         # MongoDB connection
├── models/                # Mongoose data models
├── config/                # Configuration files
└── public/                # Static assets
```

### Key Features
- Hybrid AI System with intelligent model routing
- Full application generator for web development
- Code generation, explanation, rewriting, and fixing
- Multi-domain support (General, Web Dev, ML, Data Science, DevOps, Mobile)
- Real-time streaming responses
- Dark/Light mode with theme persistence
- Command palette (Cmd/Ctrl+K) with fuzzy search
- Authentication and chat history persistence

## Development

### Running Locally
The application is configured to run on port 5000:
```bash
npm run dev
```
Opens at: http://localhost:5000

### Build for Production
```bash
npm run build
npm run start
```

## Deployment on Replit

### Deployment Configuration
- **Target**: Autoscale (stateless web application)
- **Build Command**: `npm run build`
- **Run Command**: `npm run start`
- **Port**: 5000 (configured in package.json scripts)

### Publishing
To publish your app to production:
1. Ensure all environment secrets are configured
2. Click the "Publish" button in Replit
3. The app will build and deploy automatically

## Security Notes
- All API keys are stored securely in Replit Secrets
- JWT tokens use HTTP-only cookies for security
- Environment variables are validated on startup
- MongoDB connection uses secure connection string
- Client/server separation is properly maintained

## Known Behavior
- Initial page load shows "Loading..." while auth check completes (expected)
- First compilation in development mode takes ~15 seconds (expected)
- App requires authentication for full features
- Without authentication, users see the welcome page

## Troubleshooting

### App won't start
1. Check that all required environment variables are set in Replit Secrets
2. Verify MongoDB connection string is valid
3. Check workflow logs for specific errors

### API errors
1. Verify API keys (OPENAI_API_KEY, GEMINI_API_KEY) are valid
2. Check MongoDB connection is active
3. Review server logs for detailed error messages

### Loading indefinitely
1. Clear browser cache
2. Restart the workflow
3. Check browser console for JavaScript errors

## Contact & Support
For issues or questions, refer to the GitHub repository or contact the development team.
