/**
 * PHASE C¾: Provider Execution Routing
 * 
 * Explicit per-provider execution paths.
 * No shared logic, no inferred behavior, no flags.
 */

import type { ProviderName } from './providerCapabilities'

/**
 * Provider Execution Configuration
 * 
 * Defines explicit execution methods for each provider.
 * Flags don't choose APIs - execution paths do.
 */
export interface ProviderExecutionConfig {
  supportsStreaming: boolean
  streamMethod: 'openai-stream' | 'gemini-stream' | null
  nonStreamMethod: 'openai-completion' | 'gemini-generateContent' | 'openai-compatible'
  modelMap: Record<string, string> // UI name → API model ID
}

/**
 * PHASE C¾: Provider Execution Configuration Matrix
 */
export const ProviderExecutionConfigs: Record<ProviderName, ProviderExecutionConfig> = {
  openai: {
    supportsStreaming: true,
    streamMethod: 'openai-stream',
    nonStreamMethod: 'openai-completion',
    modelMap: {
      'gpt-5.1': 'gpt-3.5-turbo', // Use gpt-3.5-turbo (works with billing setup)
      'gpt-4o': 'gpt-3.5-turbo', // Use 3.5-turbo (gpt-4o requires paid tier)
      'gpt-4o-mini': 'gpt-3.5-turbo', // Use 3.5-turbo (gpt-4o-mini requires paid tier)
      'gpt-3.5-turbo': 'gpt-3.5-turbo', // Primary model
    },
  },
  gemini: {
    supportsStreaming: false, // IMPORTANT: Gemini streaming disabled due to API inconsistencies
    streamMethod: null,
    nonStreamMethod: 'gemini-generateContent',
    modelMap: {
      'gemini-3-pro': 'gemini-pro-latest', // Use gemini-pro-latest (available in v1beta)
      'gemini-2.5-flash': 'gemini-2.5-flash', // Use gemini-2.5-flash directly
      'gemini-1.5-pro': 'gemini-pro-latest', // Map deprecated to latest
      'gemini-1.5-flash': 'gemini-2.5-flash', // Map deprecated to 2.5-flash
      'gemini-pro': 'gemini-pro-latest', // Use latest alias
      'gemini-pro-latest': 'gemini-pro-latest', // Direct mapping
    },
  },
  xai: {
    supportsStreaming: false, // IMPORTANT: xAI does NOT support streaming
    streamMethod: null,
    nonStreamMethod: 'openai-compatible',
    modelMap: {
      'grok-4': 'grok-beta', // Revert to grok-beta (official model name)
      'grok-beta': 'grok-beta',
      'grok-2-1212': 'grok-2-1212',
    },
  },
  deepseek: {
    supportsStreaming: true,
    streamMethod: 'openai-stream',
    nonStreamMethod: 'openai-compatible',
    modelMap: {
      'deepseek-3': 'deepseek-chat',
      'deepseek-chat': 'deepseek-chat',
    },
  },
  moonshot: {
    supportsStreaming: true,
    streamMethod: 'openai-stream',
    nonStreamMethod: 'openai-compatible',
    modelMap: {
      'kimi-k2': 'moonshot-v1-8k',
      'moonshot-v1-8k': 'moonshot-v1-8k',
      'moonshot-v1-32k': 'moonshot-v1-32k',
      'moonshot-v1-128k': 'moonshot-v1-128k',
    },
  },
}

/**
 * PHASE C¾: Normalize model name for provider
 */
export function normalizeModelName(provider: ProviderName, uiModelName: string): string {
  const config = ProviderExecutionConfigs[provider]
  
  // Defensive check: if config doesn't exist, return original
  if (!config || !config.modelMap) {
    console.warn(`[providerExecution] No config found for provider "${provider}", using model name as-is: ${uiModelName}`)
    return uiModelName
  }
  
  const normalized = config.modelMap[uiModelName] || config.modelMap[uiModelName.toLowerCase()]
  
  if (normalized) {
    return normalized
  }
  
  // Fallback: return original if not in map
  console.warn(`[providerExecution] Model name "${uiModelName}" not in map for ${provider}, using as-is`)
  return uiModelName
}

/**
 * PHASE C¾: Get execution method for provider
 */
export function getExecutionMethod(
  provider: ProviderName,
  stream: boolean
): ProviderExecutionConfig['streamMethod'] | ProviderExecutionConfig['nonStreamMethod'] {
  const config = ProviderExecutionConfigs[provider]
  
  if (stream && config.supportsStreaming && config.streamMethod) {
    return config.streamMethod
  }
  
  return config.nonStreamMethod
}
