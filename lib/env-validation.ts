/**
 * Environment Variable Validation
 * This module ensures all required environment variables are set before the app starts
 */

const REQUIRED_ENV_VARS = [
  'MONGODB_URI',
  'JWT_SECRET',
] as const

const OPTIONAL_ENV_VARS = {
  AI_PROVIDERS: ['OPENAI_API_KEY', 'GEMINI_API_KEY'],
  RESEARCH: ['TAVILY_API_KEY'],
  AUTH: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
} as const

export function validateEnvironmentVariables(): void {
  const missing: string[] = []

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  const hasAtLeastOneAIProvider = OPTIONAL_ENV_VARS.AI_PROVIDERS.some(
    key => process.env[key]
  )

  if (!hasAtLeastOneAIProvider) {
    missing.push('At least one AI provider (OPENAI_API_KEY or GEMINI_API_KEY)')
  }

  if (missing.length > 0) {
    const errorMessage = `
╔═══════════════════════════════════════════════════════════════╗
║                  ENVIRONMENT VARIABLES MISSING                ║
╚═══════════════════════════════════════════════════════════════╝

The following required environment variables are not set:
${missing.map(v => `  • ${v}`).join('\n')}

Please configure these in your Replit Secrets or .env.local file.
`
    
    if (process.env.NODE_ENV === 'production') {
      console.error(errorMessage + '\nApplication cannot start without these variables.')
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    } else {
      console.warn(errorMessage + '\n⚠️  Running in development mode with missing secrets.\n⚠️  Some features will not work until secrets are configured.\n')
    }
  }

  const warnings: string[] = []
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    warnings.push('Google OAuth not configured - users can only use credentials login')
  }
  if (!process.env.TAVILY_API_KEY) {
    warnings.push('Tavily API not configured - research features will be limited')
  }

  if (warnings.length > 0 && process.env.NODE_ENV !== 'production') {
    console.warn('\n⚠️  Optional features disabled:\n' + warnings.map(w => `  • ${w}`).join('\n') + '\n')
  }
}

validateEnvironmentVariables()
