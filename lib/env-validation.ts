/**
 * Environment Variable Validation
 * This module ensures all required environment variables are set before the app starts
 */

const REQUIRED_ENV_VARS = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'MONGODB_URI',
  'JWT_SECRET',
] as const

export function validateEnvironmentVariables(): void {
  const missing: string[] = []

  for (const varName of REQUIRED_ENV_VARS) {
    if (!process.env[varName]) {
      missing.push(varName)
    }
  }

  if (missing.length > 0) {
    const errorMessage = `
╔═══════════════════════════════════════════════════════════════╗
║                  ENVIRONMENT VARIABLES MISSING                ║
╚═══════════════════════════════════════════════════════════════╝

The following required environment variables are not set:
${missing.map(v => `  • ${v}`).join('\n')}

Please configure these in your Replit Secrets or .env.local file.

Application cannot start without these variables.
`
    console.error(errorMessage)
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}

if (process.env.NODE_ENV !== 'production') {
  validateEnvironmentVariables()
}
