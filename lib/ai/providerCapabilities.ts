/**
 * PHASE C½: Provider Capability Matrix
 * 
 * Pure metadata defining provider capabilities.
 * No logic, no provider SDK imports, no side effects.
 */

export type ProviderName = 'openai' | 'gemini' | 'xai' | 'deepseek' | 'moonshot'

export interface ProviderCapability {
  streaming: boolean
  systemPrompt: boolean
}

/**
 * Provider Capability Matrix
 * 
 * Defines what each provider supports.
 * Used by ProviderRouter to adapt transport without changing authority.
 */
export const ProviderCapabilities: Record<ProviderName, ProviderCapability> = {
  openai: {
    streaming: true,
    systemPrompt: true,
  },
  gemini: {
    streaming: true,
    systemPrompt: false, // Gemini uses systemInstruction in request, not system role
  },
  xai: {
    streaming: false, // IMPORTANT: xAI does NOT support streaming here
    systemPrompt: true,
  },
  deepseek: {
    streaming: true,
    systemPrompt: true,
  },
  moonshot: {
    streaming: true,
    systemPrompt: true,
  },
}
