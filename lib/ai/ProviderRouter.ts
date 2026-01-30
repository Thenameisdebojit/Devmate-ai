/**
 * PHASE C: Provider Router
 * 
 * Single authoritative router for all LLM provider calls.
 * 
 * RULES:
 * - ALL provider calls go through this router
 * - No direct provider SDK usage outside this module
 * - Proper error taxonomy (AUTH_ERROR, QUOTA_ERROR, TRANSPORT_ERROR, etc.)
 * - Fail fast on CONFIG/AUTH errors
 * - Retry only on TRANSPORT errors with exponential backoff
 */

import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ProviderCapabilities } from './providerCapabilities'
import type { ProviderName } from './providerCapabilities'
import { ProviderExecutionConfigs, normalizeModelName, getExecutionMethod } from './providerExecution'

// PHASE C: Error Taxonomy
export enum ProviderErrorType {
  AUTH_ERROR = 'AUTH_ERROR',        // Invalid / missing API key
  QUOTA_ERROR = 'QUOTA_ERROR',      // Actual quota exhaustion
  TRANSPORT_ERROR = 'TRANSPORT_ERROR', // Network / streaming failure
  PROVIDER_ERROR = 'PROVIDER_ERROR',   // Provider-side 5xx
  CONFIG_ERROR = 'CONFIG_ERROR',    // Missing env / misrouting
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND', // Model doesn't exist
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ProviderError {
  provider: string
  errorType: ProviderErrorType
  message: string
  retryable: boolean
  originalError?: any
}

export interface CompletionRequest {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  systemInstruction?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
  metadata?: Record<string, any>
}

export interface CompletionResponse {
  text: string
  provider: string
  model: string
  metadata?: Record<string, any>
}

// Provider client initialization (only once at module load)
let openaiClient: OpenAI | null = null
let geminiClient: GoogleGenerativeAI | null = null
let xaiClient: OpenAI | null = null
let deepseekClient: OpenAI | null = null
let moonshotClient: OpenAI | null = null

// PHASE C: Initialize clients (called once at startup after env validation)
export function initializeProviderClients(): void {
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  
  if (process.env.GEMINI_API_KEY) {
    geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  
  if (process.env.XAI_API_KEY) {
    xaiClient = new OpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey: process.env.XAI_API_KEY
    })
  }
  
  if (process.env.DEEPSEEK_API_KEY) {
    deepseekClient = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: process.env.DEEPSEEK_API_KEY
    })
  }
  
  if (process.env.MOONSHOT_API_KEY) {
    moonshotClient = new OpenAI({
      baseURL: 'https://api.moonshot.cn/v1',
      apiKey: process.env.MOONSHOT_API_KEY
    })
  }
}

// PHASE C: Classify error into proper taxonomy
function classifyError(error: any, provider: string): ProviderError {
  const status = error.status || error.statusCode || error.code
  const message = error.message || String(error)
  const lowerMessage = message.toLowerCase()
  
  // CONFIG_ERROR: Missing client (should be caught before call)
  if (!openaiClient && provider === 'openai') {
    return {
      provider,
      errorType: ProviderErrorType.CONFIG_ERROR,
      message: 'OpenAI client not initialized. OPENAI_API_KEY missing or invalid.',
      retryable: false,
      originalError: error
    }
  }
  
  if (!geminiClient && provider === 'gemini') {
    return {
      provider,
      errorType: ProviderErrorType.CONFIG_ERROR,
      message: 'Gemini client not initialized. GEMINI_API_KEY missing or invalid.',
      retryable: false,
      originalError: error
    }
  }
  
  // AUTH_ERROR: 401, 403, or authentication-related messages
  if (status === 401 || status === 403 || 
      lowerMessage.includes('api key') || 
      lowerMessage.includes('authentication') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('invalid api key') ||
      lowerMessage.includes('incorrect api key')) {
    return {
      provider,
      errorType: ProviderErrorType.AUTH_ERROR,
      message: `Authentication failed: ${message}`,
      retryable: false,
      originalError: error
    }
  }
  
  // QUOTA_ERROR: 429 or quota-related messages
  if (status === 429 || 
      lowerMessage.includes('quota') || 
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('insufficient balance') ||
      lowerMessage.includes('billing') ||
      lowerMessage.includes('payment required')) {
    return {
      provider,
      errorType: ProviderErrorType.QUOTA_ERROR,
      message: `Quota exceeded: ${message}`,
      retryable: false, // Don't retry quota errors
      originalError: error
    }
  }
  
  // MODEL_NOT_FOUND: 404 or model-related messages
  if (status === 404 || 
      lowerMessage.includes('not found') || 
      lowerMessage.includes('model') && lowerMessage.includes('does not exist') ||
      lowerMessage.includes('model') && lowerMessage.includes('not available')) {
    return {
      provider,
      errorType: ProviderErrorType.MODEL_NOT_FOUND,
      message: `Model not found: ${message}`,
      retryable: false,
      originalError: error
    }
  }
  
  // PROVIDER_ERROR: 5xx errors
  if (status >= 500 && status < 600) {
    return {
      provider,
      errorType: ProviderErrorType.PROVIDER_ERROR,
      message: `Provider error (${status}): ${message}`,
      retryable: true,
      originalError: error
    }
  }
  
  // TRANSPORT_ERROR: Network errors, timeouts, connection issues
  if (error.name === 'AbortError' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      lowerMessage.includes('network') ||
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('fetch failed') ||
      lowerMessage.includes('stream')) {
    return {
      provider,
      errorType: ProviderErrorType.TRANSPORT_ERROR,
      message: `Transport error: ${message}`,
      retryable: true,
      originalError: error
    }
  }
  
  // UNKNOWN_ERROR: Everything else
  return {
    provider,
    errorType: ProviderErrorType.UNKNOWN_ERROR,
    message: `Unknown error: ${message}`,
    retryable: false,
    originalError: error
  }
}

// PHASE C: Generate completion (unified interface)
export async function generateCompletion(
  request: CompletionRequest
): Promise<CompletionResponse> {
  const { provider, model, messages, systemInstruction, temperature = 0.7, maxTokens = 4096, stream } = request
  
  // PHASE C¾: Validate provider and get execution config
  const providerName = provider as ProviderName
  const caps = ProviderCapabilities[providerName]
  const execConfig = ProviderExecutionConfigs[providerName]
  
  if (!caps || !execConfig) {
    throw new Error(`Unknown provider: ${provider}`)
  }
  
  // PHASE C¾: Normalize model name per provider (prevents 404 errors)
  const normalizedModel = normalizeModelName(providerName, model)
  
  // PHASE C¾: Determine execution method (explicit, not inferred)
  const requestedStream = stream === true
  const effectiveStream = requestedStream && execConfig.supportsStreaming
  const executionMethod = getExecutionMethod(providerName, effectiveStream)
  
  // PHASE C¾: Diagnostics
  console.log(`[ProviderRouter] Execution routing:`, {
    provider: providerName,
    uiModel: model,
    normalizedModel,
    requestedStream,
    supportsStreaming: execConfig.supportsStreaming,
    effectiveStream,
    executionMethod,
  })
  
  // PHASE C¾: Final guard - force non-streaming for unsupported providers
  if (requestedStream && !execConfig.supportsStreaming) {
    console.warn(
      `[ProviderRouter] Streaming disabled for ${providerName}:${normalizedModel} (provider does not support streaming)`
    )
    console.log(`[ProviderRouter] Capability downgrade applied → stream=false for ${providerName}`)
  }
  
  try {
    // PHASE C¾: Explicit provider execution routing (no shared logic)
    switch (providerName) {
      case 'openai': {
        if (!openaiClient) {
          throw new Error('OpenAI client not initialized')
        }
        
        const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
        if (systemInstruction) {
          openaiMessages.push({ role: 'system', content: systemInstruction })
        }
        openaiMessages.push(...messages as any[])
        
        // PHASE C¾: Use normalized model name
        const modelName = normalizedModel
        
        // PHASE C¾: Explicit execution path - OpenAI supports streaming but generateCompletion is non-streaming
        const response = await openaiClient.chat.completions.create({
          model: modelName,
          messages: openaiMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false, // PHASE C¾: Explicit non-streaming for generateCompletion
        })
        
        return {
          text: response.choices[0]?.message?.content || '',
          provider: 'openai',
          model: modelName,
        }
      }
      
      case 'gemini': {
        if (!geminiClient) {
          throw new Error('Gemini client not initialized')
        }
        
        // PHASE C¾: Use normalized model name (prevents 404 errors)
        const modelName = normalizedModel
        
        // PHASE C¾: Explicit execution path - ALWAYS use generateContent (non-streaming)
        // Gemini streaming is disabled due to API inconsistencies
        const modelInstance = geminiClient.getGenerativeModel({ model: modelName })
        
        // Build prompt with system instruction
        let fullPrompt = messages.map(m => m.content).join('\n')
        if (systemInstruction) {
          fullPrompt = `${systemInstruction}\n\nUser: ${fullPrompt}\n\nAssistant:`
        }
        
        // PHASE C¾: Explicit non-streaming call (never generateContentStream)
        const result = await modelInstance.generateContent(fullPrompt)
        const text = result.response.text()
        
        console.log(`[ProviderRouter] Gemini execution: model=${modelName}, method=generateContent (non-streaming)`)
        
        return {
          text,
          provider: 'gemini',
          model: modelName,
        }
      }
      
      case 'xai': {
        if (!xaiClient) {
          throw new Error('xAI client not initialized')
        }
        
        const xaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
        if (systemInstruction) {
          xaiMessages.push({ role: 'system', content: systemInstruction })
        }
        xaiMessages.push(...messages as any[])
        
        // PHASE C¾: Use normalized model name
        const modelName = normalizedModel
        
        // PHASE C¾: Explicit execution path - ALWAYS non-streaming (xAI does NOT support streaming)
        const response = await xaiClient.chat.completions.create({
          model: modelName,
          messages: xaiMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false, // PHASE C¾: Explicit non-streaming (prevents misleading 400 errors)
        })
        
        console.log(`[ProviderRouter] xAI execution: model=${modelName}, method=chat.completions.create (non-streaming)`)
        
        return {
          text: response.choices[0]?.message?.content || '',
          provider: 'xai',
          model: modelName,
        }
      }
      
      case 'deepseek': {
        if (!deepseekClient) {
          throw new Error('DeepSeek client not initialized')
        }
        
        const deepseekMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
        if (systemInstruction) {
          deepseekMessages.push({ role: 'system', content: systemInstruction })
        }
        deepseekMessages.push(...messages as any[])
        
        // PHASE C¾: Use normalized model name
        const modelName = normalizedModel
        
        // PHASE C¾: Explicit execution path - OpenAI-compatible API
        const response = await deepseekClient.chat.completions.create({
          model: modelName,
          messages: deepseekMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false, // PHASE C¾: Explicit non-streaming for generateCompletion
        })
        
        return {
          text: response.choices[0]?.message?.content || '',
          provider: 'deepseek',
          model: modelName,
        }
      }
      
      case 'moonshot': {
        if (!moonshotClient) {
          throw new Error('Moonshot client not initialized')
        }
        
        const moonshotMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []
        if (systemInstruction) {
          moonshotMessages.push({ role: 'system', content: systemInstruction })
        }
        moonshotMessages.push(...messages as any[])
        
        // PHASE C¾: Use normalized model name
        const modelName = normalizedModel
        
        // PHASE C¾: Explicit execution path - OpenAI-compatible API
        const response = await moonshotClient.chat.completions.create({
          model: modelName,
          messages: moonshotMessages,
          temperature,
          max_tokens: maxTokens,
          stream: false, // PHASE C¾: Explicit non-streaming for generateCompletion
        })
        
        return {
          text: response.choices[0]?.message?.content || '',
          provider: 'moonshot',
          model: modelName,
        }
      }
      
      default:
        throw new Error(`Unsupported provider: ${provider}`)
    }
  } catch (error: any) {
    const classifiedError = classifyError(error, provider)
    throw classifiedError
  }
}

// PHASE C: Get provider health status
export function getProviderHealth(): Record<string, 'ready' | 'misconfigured'> {
  return {
    openai: openaiClient ? 'ready' : 'misconfigured',
    gemini: geminiClient ? 'ready' : 'misconfigured',
    xai: xaiClient ? 'ready' : 'misconfigured',
    deepseek: deepseekClient ? 'ready' : 'misconfigured',
    moonshot: moonshotClient ? 'ready' : 'misconfigured',
  }
}
