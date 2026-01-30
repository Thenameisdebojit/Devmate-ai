/**
 * PHASE C: Environment Validation
 * 
 * Explicit environment validation at server startup.
 * Fails fast with clear errors if providers are misconfigured.
 */

export type ProviderName = 'openai' | 'gemini' | 'xai' | 'deepseek' | 'moonshot'

export interface ProviderValidationResult {
  provider: ProviderName
  valid: boolean
  error?: string
}

// PHASE C: Basic API key format validation (sanity checks)
function validateKeyFormat(key: string, provider: ProviderName): boolean {
  if (!key || key.trim().length === 0) {
    return false
  }
  
  // Basic format checks (provider-specific)
  switch (provider) {
    case 'openai':
      // OpenAI keys typically start with 'sk-' and are 51+ chars
      return key.startsWith('sk-') && key.length >= 20
    case 'gemini':
      // Gemini keys are typically 39 chars alphanumeric
      return key.length >= 20 && /^[A-Za-z0-9_-]+$/.test(key)
    case 'xai':
      // xAI keys are typically similar to OpenAI format
      return key.length >= 20
    case 'deepseek':
      // DeepSeek keys similar format
      return key.length >= 20
    case 'moonshot':
      // Moonshot keys similar format
      return key.length >= 20
    default:
      return key.length >= 10 // Generic minimum
  }
}

// PHASE C: Validate provider environment
export function validateProviderEnv(provider: ProviderName): ProviderValidationResult {
  const envKeyMap: Record<ProviderName, string> = {
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    xai: 'XAI_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    moonshot: 'MOONSHOT_API_KEY',
  }
  
  const envKey = envKeyMap[provider]
  const apiKey = process.env[envKey]
  
  if (!apiKey) {
    return {
      provider,
      valid: false,
      error: `${envKey} not set in environment variables`,
    }
  }
  
  if (!validateKeyFormat(apiKey, provider)) {
    return {
      provider,
      valid: false,
      error: `${envKey} has invalid format (too short or malformed)`,
    }
  }
  
  return {
    provider,
    valid: true,
  }
}

// PHASE C: Validate all providers and log readiness ONCE at startup
export function validateAllProviders(): Record<ProviderName, ProviderValidationResult> {
  const providers: ProviderName[] = ['openai', 'gemini', 'xai', 'deepseek', 'moonshot']
  const results: Record<ProviderName, ProviderValidationResult> = {} as any
  
  console.log('[envValidation] Validating provider environments...')
  
  for (const provider of providers) {
    const result = validateProviderEnv(provider)
    results[provider] = result
    
    if (result.valid) {
      console.log(`[envValidation] ✓ ${provider.toUpperCase()}: ready`)
    } else {
      console.warn(`[envValidation] ✗ ${provider.toUpperCase()}: ${result.error}`)
    }
  }
  
  // Check if at least one provider is configured
  const hasAtLeastOne = Object.values(results).some(r => r.valid)
  if (!hasAtLeastOne) {
    console.error('[envValidation] CRITICAL: No providers configured. At least one API key is required.')
    if (process.env.NODE_ENV === 'production') {
      throw new Error('No LLM providers configured. At least one API key is required in production.')
    }
  }
  
  return results
}
