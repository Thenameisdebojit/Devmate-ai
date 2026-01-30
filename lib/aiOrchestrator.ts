import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { ProviderExecutionConfigs, normalizeModelName } from '@/lib/ai/providerExecution'
import { ProviderCapabilities } from '@/lib/ai/providerCapabilities'
import type { ProviderName } from '@/lib/ai/providerCapabilities'

// DON'T DELETE THIS COMMENT - from blueprint:javascript_openai
// Updated to GPT-5.1 as requested by user

// DON'T DELETE THIS COMMENT - from blueprint:javascript_gemini
// Updated to Gemini 3 Pro as requested by user, removed Gemini 2.5 Pro

// DON'T DELETE THIS COMMENT - from blueprint:javascript_xai
// Grok models available: grok-4 (latest, most intelligent) - Grok 2 removed as requested

if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.MOONSHOT_API_KEY && !process.env.DEEPSEEK_API_KEY) {
  // Allow starting without keys, but warn
  console.warn('No AI API keys found in environment variables')
}

// Initialize OpenAI with diagnostics
const openai = process.env.OPENAI_API_KEY ? (() => {
  const apiKey = process.env.OPENAI_API_KEY
  const apiKeyPrefix = apiKey.substring(0, 10)
  const apiKeySuffix = apiKey.substring(Math.max(0, apiKey.length - 4))
  const apiKeyLength = apiKey.length
  const apiKeyHash = apiKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 10000
  
  console.log('[aiOrchestrator] Initializing OpenAI with API key:', apiKeyPrefix + '...' + apiKeySuffix, `(length: ${apiKeyLength}, hash: ${apiKeyHash})`)
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:22',message:'OpenAI client initialization',data:{apiKeyPrefix,apiKeySuffix,apiKeyLength,apiKeyHash,hasWhitespace:apiKey.trim() !== apiKey,nodeEnv:process.env.NODE_ENV},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
  // #endregion
  
  const client = new OpenAI({ apiKey: apiKey.trim() }) // Trim whitespace just in case
  console.log('[aiOrchestrator] ✓ OpenAI initialized successfully')
  
  // Verify API key works by trying to list models (async, don't block)
  if (process.env.OPENAI_API_KEY) {
    client.models.list().then((models) => {
      // #region agent log
      const modelIds = models.data.map(m => m.id).filter(id => id.includes('gpt')).slice(0, 5)
      console.log(`[DEBUG] OpenAI API key verified - available models: ${modelIds.join(', ')}`)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:28',message:'OpenAI API key verification',data:{availableModels:modelIds,count:models.data.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      console.log(`[aiOrchestrator] ✓ OpenAI API key verified - ${models.data.length} models available`)
    }).catch((err: any) => {
      // #region agent log
      console.error(`[DEBUG] OpenAI API key verification failed:`, err.message, err.status)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:35',message:'OpenAI API key verification failed',data:{error:err.message,status:err.status,code:err.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      console.warn(`[aiOrchestrator] ⚠ OpenAI API key verification failed: ${err.message}`)
    })
  }
  
  return client
})() : (() => {
  console.warn('[aiOrchestrator] OPENAI_API_KEY not found in environment variables')
  return null
})()

// Initialize GoogleGenerativeAI with proper error handling
let gemini: GoogleGenerativeAI | null = null
let availableGeminiModels: string[] = [] // Cache available models
try {
  if (process.env.GEMINI_API_KEY) {
    const geminiKey = process.env.GEMINI_API_KEY
    const geminiKeyPrefix = geminiKey.substring(0, 10)
    const geminiKeySuffix = geminiKey.substring(Math.max(0, geminiKey.length - 4))
    const geminiKeyLength = geminiKey.length
    const geminiKeyHasWhitespace = geminiKey.trim() !== geminiKey
    console.log('[aiOrchestrator] Initializing GoogleGenerativeAI with API key:', geminiKeyPrefix + '...' + geminiKeySuffix, `(length: ${geminiKeyLength}, hasWhitespace: ${geminiKeyHasWhitespace})`)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:66',message:'Gemini client initialization',data:{apiKeyPrefix:geminiKeyPrefix,apiKeySuffix:geminiKeySuffix,apiKeyLength:geminiKeyLength,hasWhitespace:geminiKeyHasWhitespace},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    try {
      gemini = new GoogleGenerativeAI(geminiKey.trim()) // Trim whitespace
      console.log('[aiOrchestrator] ✓ GoogleGenerativeAI initialized successfully')
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:72',message:'Gemini client initialized successfully',data:{clientType:typeof gemini,hasGetGenerativeModel:typeof gemini?.getGenerativeModel === 'function',hasListModels:typeof gemini?.listModels === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
    } catch (initError: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:75',message:'Gemini client initialization failed',data:{error:initError.message,stack:initError.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      console.error('[aiOrchestrator] ✗ GoogleGenerativeAI initialization failed:', initError.message)
      gemini = null
    }
    
    // Try to list available models (async, don't block initialization)
    if (typeof gemini.listModels === 'function') {
      // #region agent log
      console.log('[DEBUG] Calling gemini.listModels()...')
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:42',message:'Calling listModels',data:{hasListModels:typeof gemini.listModels === 'function'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      
      gemini.listModels().then((response: any) => {
        // #region agent log
        const responseStr = JSON.stringify(response).substring(0, 1000)
        console.log('[DEBUG] listModels response structure:', responseStr)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:46',message:'listModels response received',data:{responseType:typeof response,hasModels:!!response?.models,responseKeys:Object.keys(response || {}),responsePreview:responseStr,firstModel:response?.models?.[0],modelsLength:response?.models?.length || 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        
        // Handle different response structures
        const models = response?.models || response || []
        availableGeminiModels = models
          .map((m: any) => {
            // Extract model name (handle both object and string formats)
            const name = typeof m === 'string' ? m : (m.name || m.model || '')
            return name.replace(/^models\//, '')
          })
          .filter((n: string) => n && (n.includes('gemini') || n.includes('models/gemini')))
        
        // #region agent log
        console.log('[DEBUG] Parsed available Gemini models:', availableGeminiModels)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:60',message:'Parsed available models',data:{availableModels:availableGeminiModels,count:availableGeminiModels.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
        
        console.log('[aiOrchestrator] Available Gemini models:', availableGeminiModels)
        if (availableGeminiModels.length > 0) {
          console.log('[aiOrchestrator] First available model:', availableGeminiModels[0])
        } else {
          console.warn('[aiOrchestrator] No Gemini models found in listModels response')
        }
      }).catch((err: any) => {
        console.warn('[aiOrchestrator] Could not list Gemini models:', err.message)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:70',message:'listModels failed',data:{error:err.message,stack:err.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        // #endregion
      })
    } else {
      // #region agent log
      console.warn('[DEBUG] gemini.listModels is not a function, trying REST API directly')
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:82',message:'listModels not available, trying REST',data:{geminiType:typeof gemini,hasListModels:false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
      // #endregion
      
      // Try REST API directly to list models
      if (process.env.GEMINI_API_KEY) {
        fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`)
          .then(async (response) => {
            if (response.ok) {
              const data = await response.json()
              // #region agent log
              const modelsList = data?.models?.map((m: any) => m.name?.replace(/^models\//, '')).filter((n: string) => n?.includes('gemini')) || []
              console.log('[DEBUG] REST API listed models:', modelsList)
              fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:90',message:'REST API models listed',data:{models:modelsList,count:modelsList.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
              // #endregion
              availableGeminiModels = modelsList
              console.log('[aiOrchestrator] Available Gemini models (from REST API):', availableGeminiModels)
            }
          })
          .catch((err: any) => {
            console.warn('[aiOrchestrator] REST API listModels also failed:', err.message)
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:98',message:'REST API listModels failed',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
            // #endregion
          })
      }
    }
  } else {
    console.warn('[aiOrchestrator] GEMINI_API_KEY not found in environment variables')
  }
} catch (error: any) {
  console.error('[aiOrchestrator] ✗ Failed to initialize GoogleGenerativeAI:', error.message)
  // Will throw error when actually used if not initialized
}

// DON'T DELETE THIS COMMENT - from blueprint:javascript_xai
// xAI client is optional - only initialized if XAI_API_KEY is available
// Grok Vision removed as requested by user
let xai: OpenAI | null = null
if (process.env.XAI_API_KEY) {
  const xaiKey = process.env.XAI_API_KEY
  const xaiKeyPrefix = xaiKey.substring(0, 10)
  const xaiKeySuffix = xaiKey.substring(Math.max(0, xaiKey.length - 4))
  const xaiKeyLength = xaiKey.length
  const xaiKeyHasWhitespace = xaiKey.trim() !== xaiKey
  console.log('[aiOrchestrator] Initializing xAI with API key:', xaiKeyPrefix + '...' + xaiKeySuffix, `(length: ${xaiKeyLength}, hasWhitespace: ${xaiKeyHasWhitespace})`)
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:153',message:'xAI client initialization',data:{apiKeyPrefix:xaiKeyPrefix,apiKeySuffix:xaiKeySuffix,apiKeyLength:xaiKeyLength,hasWhitespace:xaiKeyHasWhitespace,baseURL:'https://api.x.ai/v1'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  try {
  xai = new OpenAI({ 
    baseURL: 'https://api.x.ai/v1',
      apiKey: xaiKey.trim() // Trim whitespace
    })
    console.log('[aiOrchestrator] ✓ xAI initialized successfully')
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:160',message:'xAI client initialized successfully',data:{clientType:typeof xai,hasChatCompletions:!!xai?.chat?.completions},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
  } catch (initError: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:163',message:'xAI client initialization failed',data:{error:initError.message,stack:initError.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    console.error('[aiOrchestrator] ✗ xAI initialization failed:', initError.message)
    xai = null
  }
} else {
  console.warn('[aiOrchestrator] XAI_API_KEY not found in environment variables')
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:169',message:'XAI_API_KEY not found',data:{envKeys:Object.keys(process.env).filter(k => k.includes('XAI') || k.includes('GROK'))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
}

// DeepSeek AI client - uses OpenAI-compatible API
let deepseek: OpenAI | null = null
if (process.env.DEEPSEEK_API_KEY) {
  console.log('[aiOrchestrator] Initializing DeepSeek with API key:', process.env.DEEPSEEK_API_KEY ? `${process.env.DEEPSEEK_API_KEY.substring(0, 10)}...` : 'NOT SET')
  deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: process.env.DEEPSEEK_API_KEY
  })
  console.log('[aiOrchestrator] ✓ DeepSeek initialized successfully')
} else {
  console.warn('[aiOrchestrator] DEEPSEEK_API_KEY not found in environment variables')
}

// Moonshot AI (Kimi) client - uses OpenAI-compatible API
let moonshot: OpenAI | null = null
if (process.env.MOONSHOT_API_KEY) {
  console.log('[aiOrchestrator] Initializing Moonshot AI with API key:', process.env.MOONSHOT_API_KEY ? `${process.env.MOONSHOT_API_KEY.substring(0, 10)}...` : 'NOT SET')
  moonshot = new OpenAI({
    baseURL: 'https://api.moonshot.cn/v1',
    apiKey: process.env.MOONSHOT_API_KEY
  })
  console.log('[aiOrchestrator] ✓ Moonshot AI initialized successfully')
} else {
  console.warn('[aiOrchestrator] MOONSHOT_API_KEY not found in environment variables')
}

// Environment-based model preference
const PREFERRED_GPT_MODEL = process.env.PREFERRED_GPT_MODEL === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o' // Default to 4o as 5 is not out

export type AIModel = 'openai:gpt-5.1' | 'google:gemini-3-pro' | 'google:gemini-2.5-flash' | 'xai:grok-4' | 'moonshot:kimi-k2' | 'deepseek:deepseek-3'

export interface AIRequest {
  prompt: string
  domain?: string
  action?: string
  systemInstruction?: string
  temperature?: number
  maxTokens?: number
  stream?: boolean
}

export interface AIResponse {
  text: string
  modelUsed: AIModel
}

export function chooseModel(
  prompt: string, 
  action?: string, 
  domain?: string, 
  userPreference?: string
): AIModel {
  // If user explicitly selected a model (not 'auto'), use it
  if (userPreference && userPreference !== 'auto') {
    // Handle new provider:model format (from AIModelSelector)
    const validModels: AIModel[] = [
      'openai:gpt-5.1',
      'google:gemini-3-pro',
      'google:gemini-2.5-flash',
      'xai:grok-4', 
      'moonshot:kimi-k2',
      'deepseek:deepseek-3'
    ]
    
    if (validModels.includes(userPreference as AIModel)) {
      return userPreference as AIModel
    }
    
    // Handle legacy format for backward compatibility
    if (userPreference === 'chatgpt-5' || userPreference === 'gpt-5' || userPreference === 'gpt-5.1') {
      return 'openai:gpt-5.1'
    } else if (userPreference === 'gpt-4o' || userPreference === 'gpt-4o-mini') {
      // GPT-4o removed - map to GPT-5.1
      return 'openai:gpt-5.1'
    } else if (userPreference === 'gemini-3-pro' || userPreference === 'gemini-3') {
      return 'google:gemini-3-pro'
    } else if (userPreference === 'gemini-2.5-flash' || userPreference === 'gemini-2.5-flash-exp') {
      return 'google:gemini-2.5-flash'
    } else if (userPreference === 'gemini-1.5-flash' || userPreference === 'gemini-1.5-pro') {
      // Gemini 1.5 models removed - map to 2.5 Flash or 3 Pro
      return 'google:gemini-2.5-flash'
    } else if (userPreference === 'kimi-k2' || userPreference === 'kimi') {
      return 'moonshot:kimi-k2'
    } else if (userPreference === 'deepseek-3' || userPreference === 'deepseek') {
      return 'deepseek:deepseek-3'
    } else if (userPreference === 'grok-4') {
      return 'xai:grok-4'
    }
    // Note: Grok 2 removed - any grok-2-1212 or grok-2 preference will fall through to default auto-choose
    // Removed: grok-vision-beta as requested
  }
  
  // Auto mode: intelligent routing with performance optimization
  const lowerPrompt = prompt.toLowerCase()
  const lowerDomain = domain?.toLowerCase() || ''
  const promptLength = prompt.length
  
  // Short queries (< 100 chars) -> Gemini 2.5 Flash for speed
  const shortQuery = promptLength < 100
  const simpleKeywords = ['hi', 'hello', 'what', 'how', 'why', 'explain', 'tell me', 'can you']
  const isSimpleQuery = simpleKeywords.some(k => lowerPrompt.startsWith(k))
  
  if (shortQuery && isSimpleQuery && action !== 'generate') {
    return 'google:gemini-2.5-flash'
  }
  
  // Code generation and building tasks -> GPT-5.1 or Gemini 3 Pro
  const codeKeywords = ['code', 'build', 'create', 'generate', 'implement', 'function', 'class', 'backend', 'frontend', 'api', 'database', 'app', 'application', 'website', 'program']
  const hasCodeKeywords = codeKeywords.some(k => lowerPrompt.includes(k) || lowerDomain.includes(k))
  
  // Actions that benefit from smarter models
  const codeActions = ['generate', 'rewrite', 'fix']
  const isCodeAction = action && codeActions.includes(action)
  
  // Web Development domain always uses GPT-5.1
  if (lowerDomain.includes('web') || lowerDomain.includes('development')) {
    return 'openai:gpt-5.1'
  }
  
  // Code-related tasks use GPT-5.1
  if (hasCodeKeywords || isCodeAction) {
    return 'openai:gpt-5.1'
  }
  
  // Reasoning, summaries, explanations -> Gemini 3 Pro or 2.5 Flash for speed
  const reasoningKeywords = ['explain', 'analyze', 'summarize', 'what is', 'how does', 'why', 'describe', 'compare']
  const hasReasoningKeywords = reasoningKeywords.some(k => lowerPrompt.includes(k))
  
  if (hasReasoningKeywords || action === 'explain') {
    return promptLength > 500 ? 'google:gemini-3-pro' : 'google:gemini-2.5-flash'
  }
  
  // Default: use GPT-5.1 for complex tasks, Gemini 2.5 Flash for simple ones
  return promptLength > 200 || hasCodeKeywords 
    ? 'openai:gpt-5.1'
    : 'google:gemini-2.5-flash'
}

// Helper function to check if error is a rate limit/quota/billing error
function isRateLimitError(error: any): boolean {
  if (!error) return false
  const errorMessage = error.message || error.toString() || ''
  const errorCode = error.code || error.status || error.statusCode
  
  return (
    errorCode === 429 ||
    errorCode === 402 || // 402 = Insufficient Balance (DeepSeek, Moonshot)
    errorMessage.includes('429') ||
    errorMessage.includes('402') ||
    errorMessage.includes('quota') ||
    errorMessage.includes('insufficient balance') ||
    errorMessage.includes('insufficient_balance') ||
    errorMessage.includes('suspended due to insufficient') ||
    errorMessage.includes('RESOURCE_EXHAUSTED') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('rate_limit')
  )
}

// Helper function to extract retry delay from error message
function extractRetryDelay(error: any): number {
  if (!error) return 5000 // Default 5 seconds
  
  const errorMessage = error.message || error.toString() || ''
  const delayMatch = errorMessage.match(/retry in ([\d.]+)s/i) || 
                     errorMessage.match(/retry-after[:\s]+(\d+)/i)
  
  if (delayMatch) {
    const seconds = parseFloat(delayMatch[1])
    return Math.min(seconds * 1000, 60000) // Max 60 seconds
  }
  
  return 5000 // Default 5 seconds
}

export async function callAIModel(
  model: AIModel,
  request: AIRequest,
  retryCount: number = 0
): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.3, maxTokens = 4096 } = request
  
  // PHASE C¾: Extract provider and normalize model name (same logic as streamAIModel)
  const rawProvider = model.split(':')[0]
  const provider: ProviderName = rawProvider === 'google' ? 'gemini' : (rawProvider as ProviderName)
  const execConfig = ProviderExecutionConfigs[provider]
  
  // Defensive check: if provider config doesn't exist, throw error
  if (!execConfig) {
    const errorMsg = `[aiOrchestrator] Provider "${provider}" (from model "${model}") not found in ProviderExecutionConfigs. Available providers: ${Object.keys(ProviderExecutionConfigs).join(', ')}`
    console.error(errorMsg)
    throw new Error(`Unsupported provider: ${provider}. Model: ${model}`)
  }
  
  const uiModelName = model.split(':')[1] || model
  const normalizedModel = normalizeModelName(provider, uiModelName)
  
  // #region agent log
  console.log(`[DEBUG] callAIModel entry: model=${model}, provider=${provider}, uiModelName=${uiModelName}, normalizedModel=${normalizedModel}`)
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:250',message:'callAIModel entry',data:{model,provider,uiModelName,normalizedModel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
  // #endregion
  
  try {
    if (model.startsWith('openai')) {
      if (!openai) {
        throw new Error('OpenAI API key not configured')
      }
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
      
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction })
      }
      
      messages.push({ role: 'user', content: prompt })
      
      // PHASE C¾: Use normalized model name
      const modelName = normalizedModel
      
      // #region agent log
      console.log(`[DEBUG] OpenAI non-streaming request: model=${modelName}, apiKey=${process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'NOT SET'}, apiKeyLength=${process.env.OPENAI_API_KEY?.length || 0}`)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:347',message:'OpenAI non-streaming request',data:{model:modelName,apiKeyPrefix:process.env.OPENAI_API_KEY?.substring(0,10) || 'NOT SET',apiKeyLength:process.env.OPENAI_API_KEY?.length || 0,maxTokens},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      
      const response = await openai.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens, // FIX: Changed from max_completion_tokens to max_tokens (correct OpenAI parameter)
      })
      
      return response.choices[0]?.message?.content || ''
    }
    
    if (model.startsWith('google')) {
      if (!gemini) {
        console.error('[aiOrchestrator] GoogleGenerativeAI not initialized. GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET')
        throw new Error('GoogleGenerativeAI not initialized. Check GEMINI_API_KEY.')
      }
      
      // PHASE C¾: Use normalized model name (prevents 404 errors)
      // Try multiple model name formats if the first one fails
      let modelName = normalizedModel
      
      // If we have listed models, try to find a match
      if (availableGeminiModels.length > 0) {
        // First, try to find exact match or close match for the UI model name
        const uiModelName = model.split(':')[1] || model
        let matchingModel = availableGeminiModels.find((m: string) => {
          const cleanM = m.replace(/^models\//, '')
          return cleanM === modelName || cleanM === uiModelName || 
                 cleanM.includes(uiModelName) || uiModelName.includes(cleanM.split('-')[0])
        })
        
        // If no match for UI name, try normalized name
        if (!matchingModel) {
          matchingModel = availableGeminiModels.find((m: string) => {
            const cleanM = m.replace(/^models\//, '')
            return cleanM === modelName || cleanM.includes(modelName) || modelName.includes(cleanM)
          })
        }
        
        if (matchingModel) {
          modelName = matchingModel.replace(/^models\//, '')
          console.log(`[aiOrchestrator] Found matching model in available list: ${modelName} (requested: ${uiModelName})`)
        } else {
          // Try to find a model that matches the pattern (e.g., gemini-3-pro-preview for gemini-3-pro)
          const modelPattern = uiModelName.split('-').slice(0, 2).join('-') // e.g., "gemini-3" from "gemini-3-pro"
          const patternMatch = availableGeminiModels.find((m: string) => {
            const cleanM = m.replace(/^models\//, '')
            return cleanM.includes(modelPattern)
          })
          if (patternMatch) {
            modelName = patternMatch.replace(/^models\//, '')
            console.log(`[aiOrchestrator] Found pattern match in available list: ${modelName} (requested: ${uiModelName})`)
          } else {
            // Use normalized model name as-is (it might work)
            console.log(`[aiOrchestrator] No exact match found, using normalized name: ${modelName} (requested: ${uiModelName})`)
          }
        }
      }
      
      console.log(`[aiOrchestrator] Attempting Gemini model ${model} with normalized name: ${modelName}`)
      console.log(`[aiOrchestrator] Available models cache:`, availableGeminiModels)
      console.log(`[aiOrchestrator] Gemini client type:`, typeof gemini, 'has getGenerativeModel:', typeof (gemini as any)?.getGenerativeModel)
      // #region agent log
      const geminiKey = process.env.GEMINI_API_KEY
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:423',message:'Gemini API call attempt',data:{uiModel:model,normalizedModel:modelName,apiKeyPresent:!!geminiKey,apiKeyLength:geminiKey?.length || 0,apiKeyPrefix:geminiKey?.substring(0,10) || 'N/A',hasWhitespace:geminiKey ? geminiKey.trim() !== geminiKey : false,clientExists:!!gemini,availableModelsCount:availableGeminiModels.length,availableModels:availableGeminiModels.slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      
      // Use normalized model name directly (no variants needed)
      try {
        // Use the correct @google/generative-ai API structure
        if (gemini && typeof gemini.getGenerativeModel === 'function') {
          // Create model instance with normalized model name
          const modelInstance = gemini.getGenerativeModel({ 
            model: modelName
          })
          
          // Build full prompt with system instruction if provided
          let fullPrompt = prompt
          if (systemInstruction) {
            fullPrompt = `${systemInstruction}\n\nUser: ${prompt}\n\nAssistant:`
          }
          
          // Use the simplest string format
          let result
            try {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:445',message:'Gemini generateContent call',data:{modelName,fullPromptLength:fullPrompt.length,hasSystemInstruction:!!systemInstruction},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
              result = await modelInstance.generateContent(fullPrompt)
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:448',message:'Gemini generateContent successful',data:{modelName,hasResponse:!!result,hasText:!!result?.response?.text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
            } catch (stringError: any) {
              // #region agent log
              const errorStatus = stringError.status || stringError.statusCode || stringError.code || (stringError.message?.includes('404') ? 404 : null)
              const errorMsg = stringError.message || stringError.toString() || ''
              const hasNotFound = errorMsg.includes('not found') || errorMsg.includes('NOT_FOUND') || errorMsg.includes('404')
              console.error(`[DEBUG] Gemini generateContent failed:`, errorMsg, 'status:', errorStatus, 'hasNotFound:', hasNotFound)
              fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:383',message:'Gemini generateContent failed',data:{modelName,error:errorMsg,status:errorStatus,hasNotFound,errorKeys:Object.keys(stringError || {}),fullError:JSON.stringify(stringError).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
              // #endregion
              
              // If string format fails with 404, try different model name formats
              const isNotFound = errorStatus === 404 || hasNotFound
              
              // #region agent log
              console.log(`[DEBUG] isNotFound check: errorStatus=${errorStatus}, hasNotFound=${hasNotFound}, isNotFound=${isNotFound}`)
              fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:395',message:'isNotFound check',data:{modelName,errorStatus,hasNotFound,isNotFound},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
              // #endregion
              
              if (isNotFound) {
                // #region agent log
                console.log(`[DEBUG] Detected 404/not found error, will try alternatives`)
                fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:402',message:'404 detected, trying alternatives',data:{modelName,errorStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
                // #endregion
                console.warn(`[aiOrchestrator] Model ${modelName} not found, trying alternative formats...`)
                
                // Try alternative model names - prioritize models that might work in v1beta
                // Based on web search: gemini-pro is the stable model name that should work
                const alternativeNames = [
                  'gemini-pro', // Stable model name (should work in v1beta)
                  `models/gemini-pro`, // Try with models/ prefix
                  'gemini-1.5-pro-latest', // Try latest alias
                  'gemini-1.5-flash-latest', // Try latest alias
                  `models/gemini-1.5-pro`, // Try with models/ prefix (legacy)
                  `models/gemini-1.5-flash`, // Try with models/ prefix (legacy)
                ]
                
                // If we have available models from listModels, try those first
                if (availableGeminiModels.length > 0) {
                  // Prepend available models to alternatives
                  alternativeNames.unshift(...availableGeminiModels.slice(0, 3))
                }
                
                // #region agent log
                console.log(`[DEBUG] Trying alternative model names for ${modelName}:`, alternativeNames)
                fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:380',message:'Trying alternative model names',data:{originalModel:modelName,alternatives:alternativeNames,availableModels:availableGeminiModels},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
                // #endregion
                
                let lastError = stringError
                for (const altName of alternativeNames) {
                  try {
                    // #region agent log
                    console.log(`[DEBUG] Trying alternative model name: ${altName}`)
                    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:432',message:'Trying alternative model',data:{altName,originalModel:modelName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
                    // #endregion
                    console.log(`[aiOrchestrator] Trying alternative model name: ${altName}`)
                    const altModelInstance = gemini.getGenerativeModel({ model: altName })
                    result = await altModelInstance.generateContent(fullPrompt)
                    // #region agent log
                    console.log(`[DEBUG] Successfully used alternative model: ${altName}`)
                    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:436',message:'Alternative model succeeded',data:{altName,originalModel:modelName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
                    // #endregion
                    console.log(`[aiOrchestrator] ✓ Successfully used alternative model: ${altName}`)
                    modelName = altName // Update modelName for logging
                    break
                  } catch (altError: any) {
                    // #region agent log
                    const altErrorStatus = altError.status || altError.statusCode || altError.code || (altError.message?.includes('404') ? 404 : null)
                    console.log(`[DEBUG] Alternative model ${altName} failed: ${altError.message}, status: ${altErrorStatus}`)
                    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:443',message:'Alternative model failed',data:{altName,originalModel:modelName,error:altError.message,status:altErrorStatus},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
                    // #endregion
                    lastError = altError
                    continue
                  }
                }
                
                // If all alternatives failed, try structured format with original model
                if (!result) {
                  console.warn(`[aiOrchestrator] All model name alternatives failed, trying structured format with ${modelName}...`)
                  const request: any = {
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                      temperature: temperature || 0.7,
                    }
          }
          
          if (systemInstruction) {
                    request.systemInstruction = systemInstruction
                  }
                  
                  if (maxTokens) {
                    request.generationConfig.maxOutputTokens = maxTokens
                  }
                  
                  result = await modelInstance.generateContent(request)
                }
                
                // If still no result, throw the last error
                if (!result) {
                  throw lastError
                }
          } else {
                // For non-404 errors, re-throw
                throw stringError
              }
            }
            
            const text = result.response.text()
            console.log(`[aiOrchestrator] ✓ Successfully used Gemini model: ${modelName} (requested: ${model})`)
            return text || ''
          } else {
            console.error('[aiOrchestrator] getGenerativeModel not available. Gemini client:', gemini, 'Type:', typeof gemini)
            throw new Error('getGenerativeModel not available - GoogleGenerativeAI client not properly initialized')
          }
        } catch (error: any) {
          // #region agent log
          console.error(`[DEBUG] Gemini callAIModel failed:`, error.message, error.status)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:385',message:'Gemini callAIModel failed',data:{modelName,error:error.message,status:error.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
          // #endregion
          
          const isModelNotFound = error.isModelNotFound === true || error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.status === 404
          const isAuthError = error.message?.includes('API key') || error.message?.includes('authentication') || error.status === 401 || error.status === 403
          
          if (isAuthError) {
            console.error(`[aiOrchestrator] Authentication error with Gemini API. Check GEMINI_API_KEY.`)
            throw new Error(`Gemini API authentication failed: ${error.message}. Please check your GEMINI_API_KEY.`)
          }
          
          // Re-throw the error (no variant loop needed with normalized names)
          throw error
      }
    }
    
    if (model.startsWith('xai')) {
      if (!xai) {
        throw new Error('XAI_API_KEY not configured. Please add your xAI API key to use Grok models.')
      }
      
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
      
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction })
      }
      
      messages.push({ role: 'user', content: prompt })
      
      // PHASE C¾: Use normalized model name with alt fallbacks
      // Try grok-2-latest first since it might work when grok-beta doesn't (Vercel compatibility)
      const primaryModelName = normalizedModel
      const altXaiModels = ['grok-2-latest', 'grok-beta', 'grok-2-1212', 'grok-2']
      
      // If primary is grok-beta, prioritize grok-2-latest first (might work better)
      const shouldPrioritizeGrok2Latest = primaryModelName === 'grok-beta'
      
      console.log(`[aiOrchestrator] Calling xAI API with normalized model: ${primaryModelName}`)
      // Re-read and re-validate the API key fresh from environment
      const xaiKeyRaw = process.env.XAI_API_KEY
      const xaiKey = xaiKeyRaw ? xaiKeyRaw.trim().replace(/^["']|["']$/g, '') : null // Remove quotes if present
      
      // Verify key format
      const keyHasQuotes = xaiKeyRaw && (xaiKeyRaw.startsWith('"') || xaiKeyRaw.startsWith("'") || xaiKeyRaw.endsWith('"') || xaiKeyRaw.endsWith("'"))
      const keyCharCodes = xaiKey ? Array.from(xaiKey).slice(0, 20).map(c => c.charCodeAt(0)) : []
      const keyBytes = xaiKey ? Buffer.from(xaiKey, 'utf8').toString('hex').substring(0, 40) : null
      const keyHasNonAscii = xaiKey ? /[^\x00-\x7F]/.test(xaiKey) : false
      const keyFirstChar = xaiKey ? xaiKey.charCodeAt(0) : null
      const keyLastChar = xaiKey ? xaiKey.charCodeAt(xaiKey.length - 1) : null
      
      console.log(`[aiOrchestrator] xAI API key present: ${!!xaiKey}, length: ${xaiKey?.length || 0}, prefix: ${xaiKey?.substring(0, 10) || 'N/A'}, suffix: ${xaiKey?.substring(Math.max(0, (xaiKey?.length || 0) - 4)) || 'N/A'}, hadQuotes: ${keyHasQuotes}`)
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:593',message:'xAI API call attempt',data:{modelName:primaryModelName,apiKeyPresent:!!xaiKey,apiKeyLength:xaiKey?.length || 0,apiKeyPrefix:xaiKey?.substring(0,10) || 'N/A',apiKeySuffix:xaiKey?.substring(Math.max(0,(xaiKey?.length || 0)-4)) || 'N/A',hasWhitespace:xaiKeyRaw ? xaiKeyRaw.trim() !== xaiKeyRaw : false,hadQuotes:keyHasQuotes,keyCharCodes:keyCharCodes,keyBytes:keyBytes,keyHasNonAscii:keyHasNonAscii,keyFirstChar:keyFirstChar,keyLastChar:keyLastChar,rawKeyLength:xaiKeyRaw?.length || 0,cleanedKeyLength:xaiKey?.length || 0,clientExists:!!xai,baseURL:xai?.baseURL || 'N/A',messageCount:messages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
      // Always create a fresh client with the cleaned key to ensure it matches what Vercel uses
      if (!xaiKey) {
        throw new Error('XAI_API_KEY not configured. Please add your xAI API key to use Grok models.')
      }
      
      const clientToUse = new OpenAI({
        baseURL: 'https://api.x.ai/v1',
        apiKey: xaiKey
      })
      
      console.log(`[DEBUG] Created fresh xAI client with cleaned key (length: ${xaiKey.length}, prefix: ${xaiKey.substring(0, 10)}, suffix: ${xaiKey.substring(Math.max(0, xaiKey.length - 4))})`)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:674',message:'Created fresh xAI client',data:{apiKeyLength:xaiKey.length,apiKeyPrefix:xaiKey.substring(0,10),apiKeySuffix:xaiKey.substring(Math.max(0,xaiKey.length-4)),baseURL:clientToUse.baseURL},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
      // Build model list - prioritize grok-2-latest if primary is grok-beta
      let tryModels: string[]
      if (shouldPrioritizeGrok2Latest && !altXaiModels.includes(primaryModelName)) {
        // Try grok-2-latest first, then primary, then others
        tryModels = ['grok-2-latest', primaryModelName, ...altXaiModels.filter(m => m !== primaryModelName && m !== 'grok-2-latest')]
      } else {
        // Normal order: primary first, then alternates
        tryModels = [primaryModelName, ...altXaiModels.filter(m => m !== primaryModelName)]
      }
      let lastXaiError: any = null
      
      // #region agent log
      console.log(`[DEBUG] xAI will try models in order:`, tryModels, `(primary: ${primaryModelName}, prioritizeGrok2Latest: ${shouldPrioritizeGrok2Latest})`)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:655',message:'xAI models to try',data:{primaryModelName,altXaiModels,tryModels,tryCount:tryModels.length,shouldPrioritizeGrok2Latest,normalizedModel},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
      for (const xaiModel of tryModels) {
        // #region agent log
        console.log(`[DEBUG] Trying xAI model: ${xaiModel}`)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:658',message:'Trying xAI model',data:{xaiModel,modelIndex:tryModels.indexOf(xaiModel),totalModels:tryModels.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        try {
          // #region agent log
          console.log(`[DEBUG] About to call xAI API with model ${xaiModel}, using fresh client with key prefix: ${xaiKey.substring(0, 10)}`)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:700',message:'About to call xAI API',data:{xaiModel,apiKeyPrefix:xaiKey.substring(0,10),apiKeyLength:xaiKey.length,apiKeySuffix:xaiKey.substring(Math.max(0,xaiKey.length-4)),clientBaseURL:clientToUse.baseURL},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          const response = await clientToUse.chat.completions.create({
            model: xaiModel,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false, // PHASE C¾: Explicit non-streaming
          })
          
          const content = response.choices[0]?.message?.content || ''
          console.log(`[aiOrchestrator] ✓ xAI API call successful with ${xaiModel}, response length: ${content.length}`)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:609',message:'xAI API call successful',data:{modelName:xaiModel,responseLength:content.length,hasContent:!!content},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          return content
        } catch (error: any) {
          // #region agent log
          const errorStatus = error.status || error.statusCode || error.code
          const errorMessage = error.message || error.toString() || ''
          const errorResponse = error.response?.data || error.error || null
          const isAuthError = errorStatus === 400 && (errorMessage.includes('Incorrect API key') || errorMessage.includes('API key provided'))
          const isNotFound = errorStatus === 404 || errorMessage.includes('not found') || errorMessage.includes('NOT_FOUND')
          console.error(`[DEBUG] xAI callAIModel failed for ${xaiModel}:`, errorMessage, 'status:', errorStatus, 'isAuthError:', isAuthError, 'isNotFound:', isNotFound)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:618',message:'xAI callAIModel failed',data:{modelName:xaiModel,error:errorMessage,status:errorStatus,code:error.code,type:error.type,responseData:errorResponse,isAuthError,isNotFound,errorKeys:Object.keys(error || {}),fullError:JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          
          // Mark auth errors for later handling
          if (isAuthError) {
            error.isAuthError = true
            error.isInvalidKey = true
          }
          
          // Save error and continue to try next model (for both auth errors and 404s)
          // Only throw immediately for other types of errors
          if (isAuthError || isNotFound) {
            lastXaiError = error
            const remainingModels = tryModels.slice(tryModels.indexOf(xaiModel) + 1)
            console.log(`[aiOrchestrator] xAI model ${xaiModel} failed (${isAuthError ? 'auth error' : 'not found'}), trying next model... Remaining: ${remainingModels.join(', ')}`)
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:692',message:'xAI model failed, continuing to next',data:{failedModel:xaiModel,isAuthError,isNotFound,remainingModels,remainingCount:remainingModels.length},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H1'})}).catch(()=>{});
            // #endregion
            continue
          }
          
          // For other errors, throw immediately
          throw error
        }
      }
      
      // After trying all models, throw the last error if all failed
      if (lastXaiError) {
        if (lastXaiError.isAuthError || lastXaiError.isInvalidKey) {
          throw new Error(`xAI API key rejected by all models. Please check your XAI_API_KEY at https://console.x.ai. Error: ${lastXaiError.message}`)
        }
        throw lastXaiError
      }
      
      // This should never happen, but just in case
      throw new Error('xAI API call failed: No models tried')
    }
    
    if (model.startsWith('deepseek')) {
      if (!deepseek) {
        throw new Error('DEEPSEEK_API_KEY not configured. Please add your DeepSeek API key to use DeepSeek models.')
      }
      
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
      
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction })
      }
      
      messages.push({ role: 'user', content: prompt })
      
      // PHASE C¾: Use normalized model name
      const modelName = normalizedModel
      
      console.log(`[aiOrchestrator] Calling DeepSeek API with model: ${modelName}`)
      const response = await deepseek.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      })
      
      const content = response.choices[0]?.message?.content || ''
      console.log(`[aiOrchestrator] ✓ DeepSeek API call successful, response length: ${content.length}`)
      return content
    }
    
    if (model.startsWith('moonshot')) {
      if (!moonshot) {
        throw new Error('MOONSHOT_API_KEY not configured. Please add your Moonshot AI API key to use Kimi models.')
      }
      
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
      
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction })
      }
      
      messages.push({ role: 'user', content: prompt })
      
      // PHASE C¾: Use normalized model name
      const modelName = normalizedModel
      
      console.log(`[aiOrchestrator] Calling Moonshot API with model: ${modelName}`)
      const response = await moonshot.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      })
      
      const content = response.choices[0]?.message?.content || ''
      console.log(`[aiOrchestrator] ✓ Moonshot API call successful, response length: ${content.length}`)
      return content
    }
    
    throw new Error(`Unsupported model: ${model}`)
  } catch (error: any) {
    // Handle rate limit errors with retry logic
    if (isRateLimitError(error) && retryCount < 2) {
      const delay = extractRetryDelay(error)
      console.warn(`Rate limit hit for ${model}, retrying after ${delay}ms (attempt ${retryCount + 1}/2)`)
      await new Promise(resolve => setTimeout(resolve, delay))
      return callAIModel(model, request, retryCount + 1)
    }
    
    console.error(`Error calling ${model}:`, error)
    throw error
  }
}

export async function callAIModelWithFailover(
  request: AIRequest,
  userPreference?: string
): Promise<AIResponse> {
  const primaryModel = chooseModel(request.prompt, request.action, request.domain, userPreference)
  
  try {
    const text = await callAIModel(primaryModel, request)
    return { text, modelUsed: primaryModel }
  } catch (error: any) {
    const isQuotaError = isRateLimitError(error)
    const isModelNotFound = error.isModelNotFound === true || error.message?.includes('not found') || error.message?.includes('NOT_FOUND') || error.status === 404
    const isAuthError = error.isAuthError === true || error.isInvalidKey === true || (error.status === 400 && error.message?.includes('Incorrect API key')) || error.status === 401 || error.status === 403
    
    // Check if error has isModelNotFound flag (set by callAIModel when all variants fail)
    const hasModelNotFoundFlag = error.isModelNotFound === true
    
    // If user explicitly selected a model and it's a model-not-found error,
    // try to failover anyway since the model might not exist at all
    // This is better than showing an error - user wants models to work
    if (userPreference && userPreference !== 'auto' && (isModelNotFound || hasModelNotFoundFlag)) {
      console.warn(`[aiOrchestrator] User explicitly selected ${userPreference} (mapped to ${primaryModel}) but model not available. Attempting failover to other providers.`)
      // Don't throw - allow failover to happen instead
    }
    
    console.warn(`Primary model ${primaryModel} failed${isQuotaError ? ' (quota exceeded)' : isAuthError ? ' (auth error/invalid key)' : isModelNotFound ? ' (model not found)' : ''}, attempting failover:`, error.message)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:786',message:'Primary model failed, starting failover',data:{primaryModel,error:error.message,isQuotaError,isAuthError,isModelNotFound,hasModelNotFoundFlag:hasModelNotFoundFlag,userPreference},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    
    // Smart failover logic - try other providers when model not found
    const fallbackModels: AIModel[] = []
    
    // If Gemini failed due to quota, prioritize OpenAI models but try Flash first if applicable
    if (isQuotaError && primaryModel.startsWith('google')) {
      // If primary was NOT flash, try flash first as it often has higher quotas
      if (!primaryModel.includes('flash')) {
        // Try same model series but flash variant
        if (primaryModel.includes('3')) {
          fallbackModels.push('google:gemini-2.5-flash')
        } else {
          fallbackModels.push('google:gemini-2.5-flash')
        }
      }

      // Then try OpenAI models and other providers
      fallbackModels.push('openai:gpt-5.1')
      if (deepseek) fallbackModels.push('deepseek:deepseek-3')
      if (moonshot) fallbackModels.push('moonshot:kimi-k2')
      if (xai) {
        fallbackModels.push('xai:grok-4')
      }
    } else {
      // Normal failover logic - GPT-4o, Gemini 1.5 Pro/Flash, and Grok 2 removed
      if (primaryModel === 'openai:gpt-5.1') {
        if (!isQuotaError && !isModelNotFound) {
          fallbackModels.push('google:gemini-3-pro', 'google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-3-pro') {
        if (!isQuotaError && !isModelNotFound) {
          fallbackModels.push('google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-2.5-flash') {
        if (!isQuotaError && !isModelNotFound) {
          fallbackModels.push('google:gemini-3-pro', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'deepseek:deepseek-3') {
        if (!isQuotaError && !isModelNotFound) {
          fallbackModels.push('moonshot:kimi-k2', 'google:gemini-3-pro', 'google:gemini-2.5-flash')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'moonshot:kimi-k2') {
        if (!isQuotaError && !isModelNotFound) {
          fallbackModels.push('deepseek:deepseek-3', 'google:gemini-3-pro', 'google:gemini-2.5-flash')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel.startsWith('xai')) {
        // Only add fallbacks if it's not an auth error (invalid key)
        if (!isAuthError && !isQuotaError && !isModelNotFound) {
          fallbackModels.push('google:gemini-3-pro', 'google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        if (!isAuthError) {
          fallbackModels.push('openai:gpt-5.1')
        }
      } else {
        // Generic fallback
        if (!isQuotaError && !isModelNotFound) {
          fallbackModels.push('google:gemini-3-pro', 'google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:785',message:'Failover models determined',data:{primaryModel,fallbackModels,fallbackCount:fallbackModels.length,xaiAvailable:!!xai,geminiAvailable:!!gemini},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
    // #endregion
    
    // Try each fallback model
    for (const fallbackModel of fallbackModels) {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:790',message:'Trying fallback model',data:{fallbackModel,primaryModel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
        // #endregion
        const text = await callAIModel(fallbackModel, request)
        console.log(`✓ Failover successful with ${fallbackModel}`)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:793',message:'Failover successful',data:{fallbackModel,responseLength:text.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
        // #endregion
        return { text, modelUsed: fallbackModel }
      } catch (fallbackError: any) {
        const isFallbackQuotaError = isRateLimitError(fallbackError)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:797',message:'Fallback model failed',data:{fallbackModel,error:fallbackError.message,status:fallbackError.status,isQuotaError:isFallbackQuotaError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H7'})}).catch(()=>{});
        // #endregion
        if (isFallbackQuotaError && fallbackModel.startsWith('google')) {
          console.warn(`✗ Fallback model ${fallbackModel} also has quota issues, skipping remaining Gemini models`)
          // Remove remaining Gemini models from list
          const geminiIndex = fallbackModels.indexOf(fallbackModel)
          if (geminiIndex !== -1) {
            fallbackModels.splice(geminiIndex)
            // Remove any other Gemini models
            for (let i = fallbackModels.length - 1; i >= 0; i--) {
              if (fallbackModels[i].startsWith('google')) {
                fallbackModels.splice(i, 1)
              }
            }
          }
        } else {
          console.warn(`✗ Fallback model ${fallbackModel} also failed:`, fallbackError.message)
        }
        continue
      }
    }
    
    throw new Error(`All AI models failed. Primary (${primaryModel}): ${error.message}`)
  }
}

export async function* streamAIModelWithFailover(
  request: AIRequest,
  userPreference?: string
): AsyncGenerator<string, void, unknown> {
  const primaryModel = chooseModel(request.prompt, request.action, request.domain, userPreference)
  
  // #region agent log
  console.log(`[DEBUG] streamAIModelWithFailover entry: primaryModel=${primaryModel}, userPreference=${userPreference}`)
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:624',message:'streamAIModelWithFailover entry',data:{primaryModel,userPreference},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  
  try {
    yield* streamAIModel(primaryModel, request)
  } catch (error: any) {
    // #region agent log
    console.error(`[DEBUG] Primary model ${primaryModel} failed:`, error.message, error.status, error.code)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:632',message:'Primary model failed',data:{primaryModel,error:error.message,status:error.status,code:error.code,stack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    const isQuotaError = isRateLimitError(error)
    const isAuthError = error.isAuthError === true || error.isInvalidKey === true || error.status === 401 || error.status === 403 || (error.status === 400 && error.message?.includes('Incorrect API key')) || error.message?.includes('API key') || error.message?.includes('Incorrect API key')
    const isModelNotFound = error.isModelNotFound === true || error.status === 404 || error.message?.includes('not found')
    
    console.warn(`Primary streaming model ${primaryModel} failed${isQuotaError ? ' (quota exceeded)' : isAuthError ? ' (auth error/invalid key)' : isModelNotFound ? ' (model not found)' : ''}, attempting failover:`, error.message)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:925',message:'Primary streaming model failed, starting failover',data:{primaryModel,error:error.message,isQuotaError,isAuthError,isModelNotFound,userPreference},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // Smart failover logic - prioritize OpenAI when Gemini has quota issues, skip xAI when auth error
    const fallbackModels: AIModel[] = []
    
    // If xAI failed due to invalid API key, skip all xAI models in failover
    if (isAuthError && primaryModel.startsWith('xai')) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:933',message:'xAI auth error detected in streaming, skipping xAI in failover',data:{primaryModel,error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      // Skip xAI models, try other providers
      if (!isQuotaError && !isModelNotFound) {
        fallbackModels.push('google:gemini-3-pro', 'google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
      }
      fallbackModels.push('openai:gpt-5.1')
    } else if (isQuotaError && primaryModel.startsWith('google')) {
      // Skip all Gemini models if quota exceeded
      fallbackModels.push('openai:gpt-5.1')
      if (deepseek) fallbackModels.push('deepseek:deepseek-3')
      if (moonshot) fallbackModels.push('moonshot:kimi-k2')
      if (xai && !isAuthError) {
        fallbackModels.push('xai:grok-4')
      }
    } else {
      // Normal failover logic
      if (primaryModel === 'openai:gpt-5.1') {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-3-pro', 'google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-3-pro') {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-2.5-flash') {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-3-pro', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'deepseek:deepseek-3') {
        if (!isQuotaError) {
          fallbackModels.push('moonshot:kimi-k2', 'google:gemini-3-pro', 'google:gemini-2.5-flash')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'moonshot:kimi-k2') {
        if (!isQuotaError) {
          fallbackModels.push('deepseek:deepseek-3', 'google:gemini-3-pro', 'google:gemini-2.5-flash')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel.startsWith('xai')) {
        // Only add fallbacks if it's not an auth error (invalid key)
        const isAuthError = error.status === 401 || error.status === 403 || (error.status === 400 && error.message?.includes('Incorrect API key'))
        if (!isAuthError && !isQuotaError) {
          fallbackModels.push('google:gemini-3-pro', 'google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        if (!isAuthError) {
          fallbackModels.push('openai:gpt-5.1')
        }
      } else {
        // Generic fallback
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-3-pro', 'google:gemini-2.5-flash', 'deepseek:deepseek-3', 'moonshot:kimi-k2')
        }
        fallbackModels.push('openai:gpt-5.1')
        if (xai) fallbackModels.push('xai:grok-4')
      }
    }
    
    // Try each fallback model
    for (const fallbackModel of fallbackModels) {
      try {
        // #region agent log
        console.log(`[DEBUG] Attempting failover to ${fallbackModel}`)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:697',message:'Attempting failover',data:{fallbackModel,primaryModel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        
        console.log(`✓ Streaming failover to ${fallbackModel}`)
        yield* streamAIModel(fallbackModel, request)
        return
      } catch (fallbackError: any) {
        // #region agent log
        console.error(`[DEBUG] Failover model ${fallbackModel} failed:`, fallbackError.message, fallbackError.status)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:704',message:'Failover model failed',data:{fallbackModel,error:fallbackError.message,status:fallbackError.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        
        const isFallbackQuotaError = isRateLimitError(fallbackError)
        if (isFallbackQuotaError && fallbackModel.startsWith('google')) {
          console.warn(`✗ Streaming fallback model ${fallbackModel} also has quota issues, skipping remaining Gemini models`)
          // Remove remaining Gemini models
          for (let i = fallbackModels.length - 1; i >= 0; i--) {
            if (fallbackModels[i].startsWith('google')) {
              fallbackModels.splice(i, 1)
            }
          }
        } else {
          console.warn(`✗ Streaming fallback model ${fallbackModel} also failed:`, fallbackError.message)
        }
        continue
      }
    }
    
    // #region agent log
    console.error(`[DEBUG] All models failed. Primary: ${primaryModel}, Fallbacks tried: ${fallbackModels.length}, Error: ${error.message}`)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:720',message:'All models failed',data:{primaryModel,fallbackCount:fallbackModels.length,primaryError:error.message,errorStack:error.stack?.substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // Create a user-friendly error message that reflects the selected model
    const errorMessage = error.message || 'Unknown error'
    const primaryProvider = primaryModel.split(':')[0]
    const primaryModelName = primaryModel.split(':')[1] || primaryModel
    
    let friendlyMessage: string
    if (primaryProvider === 'xai' && (errorMessage.includes('Incorrect API key') || errorMessage.includes('API key'))) {
      friendlyMessage = `xAI (Grok) API key is invalid. Please check your XAI_API_KEY at https://console.x.ai. The key you're using is being rejected by xAI's API.`
    } else if (primaryProvider === 'google' && (errorMessage.includes('not found') || errorMessage.includes('404'))) {
      friendlyMessage = `Gemini model "${primaryModelName}" is not available. Please try a different Gemini model or check your GEMINI_API_KEY.`
    } else if (primaryProvider === 'google' && (errorMessage.includes('quota') || errorMessage.includes('429'))) {
      friendlyMessage = `Gemini API quota exceeded. Please check your GEMINI_API_KEY billing/quota settings at https://ai.google.dev/`
    } else if (primaryProvider === 'openai' && (errorMessage.includes('quota') || errorMessage.includes('429'))) {
      friendlyMessage = `OpenAI API quota exceeded. Please check your OPENAI_API_KEY billing settings at https://platform.openai.com/account/billing`
    } else if (errorMessage.includes('quota') || errorMessage.includes('429')) {
      friendlyMessage = `All AI models are currently unavailable due to quota/billing issues. Please check your API keys and billing settings.`
    } else {
      friendlyMessage = `${primaryProvider === 'google' ? 'Gemini' : primaryProvider === 'xai' ? 'xAI (Grok)' : primaryProvider === 'openai' ? 'OpenAI' : 'AI'} model "${primaryModelName}" failed: ${errorMessage}`
    }
    
    const finalError = new Error(friendlyMessage)
    // #region agent log
    console.error(`[DEBUG] About to throw error from streamAIModelWithFailover:`, friendlyMessage)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1130',message:'About to throw error from streamAIModelWithFailover',data:{errorMessage:friendlyMessage,errorType:finalError.constructor.name},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    throw finalError
  }
}

export async function* streamAIModel(
  model: AIModel,
  request: AIRequest
): AsyncGenerator<string, void, unknown> {
  const { prompt, systemInstruction, temperature = 0.3, maxTokens = 4096 } = request
  
  // PHASE C¾: Extract provider and check capabilities
  const rawProvider = model.split(':')[0]
  // Map 'google' to 'gemini' for provider name
  const provider: ProviderName = rawProvider === 'google' ? 'gemini' : (rawProvider as ProviderName)
  const execConfig = ProviderExecutionConfigs[provider]
  const caps = ProviderCapabilities[provider]
  
  // Defensive check: if provider config doesn't exist, throw error
  if (!execConfig || !caps) {
    const errorMsg = `[aiOrchestrator] Provider "${provider}" (from model "${model}") not found in ProviderExecutionConfigs. Available providers: ${Object.keys(ProviderExecutionConfigs).join(', ')}`
    console.error(errorMsg)
    throw new Error(`Unsupported provider: ${provider}. Model: ${model}`)
  }
  
  // PHASE C¾: Extract UI model name and normalize
  const uiModelName = model.split(':')[1] || model
  const normalizedModel = normalizeModelName(provider, uiModelName)
  
  // #region agent log
  console.log(`[DEBUG] streamAIModel entry: model=${model}, rawProvider=${rawProvider}, provider=${provider}, uiModelName=${uiModelName}, normalizedModel=${normalizedModel}, supportsStreaming=${execConfig.supportsStreaming}`)
  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:771',message:'streamAIModel entry',data:{model,rawProvider,provider,uiModelName,normalizedModel,supportsStreaming:execConfig.supportsStreaming,streaming:caps.streaming},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  // #endregion
  
  // PHASE C¾: Check if provider supports streaming - MUST check before any API calls
  if (!execConfig.supportsStreaming) {
    // #region agent log
    console.log(`[DEBUG] Provider ${provider} does not support streaming, using non-streaming fallback`)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:787',message:'Provider does not support streaming, using non-streaming fallback',data:{provider,normalizedModel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // Fallback to non-streaming completion and yield as chunks
    console.warn(`[aiOrchestrator] Provider ${provider} does not support streaming, using non-streaming completion`)
    
    try {
      // #region agent log
      console.log(`[DEBUG] Calling callAIModel for non-streaming fallback: model=${model}, provider=${provider}, normalizedModel=${normalizedModel}`)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:789',message:'Calling callAIModel for non-streaming',data:{model,provider,normalizedModel},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
      const response = await callAIModel(model, request)
      // Yield the entire response as a single chunk for non-streaming providers
      if (response) {
        yield response
      }
      return
    } catch (error: any) {
      // #region agent log
      console.error(`[DEBUG] Non-streaming fallback failed for ${provider}:`, error.message, error.status, error.code, error.stack?.substring(0, 300))
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:800',message:'Non-streaming fallback failed',data:{provider,model,error:error.message,status:error.status,code:error.code,stack:error.stack?.substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      throw error
    }
  }
  
  if (model.startsWith('openai')) {
    if (!openai) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY.')
    }
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction })
    }
    
    messages.push({ role: 'user', content: prompt })
    
    // PHASE C¾: Use normalized model name
    const modelName = normalizedModel
    
    // #region agent log
    console.log(`[DEBUG] OpenAI streaming request: model=${modelName}, apiKey=${process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 10)}...` : 'NOT SET'}, apiKeyLength=${process.env.OPENAI_API_KEY?.length || 0}`)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:977',message:'OpenAI streaming request',data:{uiModel:uiModelName,normalizedModel:modelName,apiKeyPrefix:process.env.OPENAI_API_KEY?.substring(0,10) || 'NOT SET',apiKeyLength:process.env.OPENAI_API_KEY?.length || 0,maxTokens},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    
    // #region agent log
    console.log(`[DEBUG] About to make OpenAI streaming request: model=${modelName}, messages=${messages.length}, apiKeyPresent=${!!process.env.OPENAI_API_KEY}`)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:987',message:'About to make OpenAI request',data:{model:modelName,messageCount:messages.length,apiKeyPresent:!!process.env.OPENAI_API_KEY,firstMessagePreview:messages[0]?.content?.substring(0,50) || 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    
    try {
    const stream = await openai.chat.completions.create({
      model: modelName,
      messages,
      temperature,
        max_tokens: maxTokens, // FIX: Changed from max_completion_tokens to max_tokens (correct OpenAI parameter)
      stream: true,
    })
    
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        yield text
      }
    }
    } catch (error: any) {
      // #region agent log
      console.error(`[DEBUG] OpenAI streaming error details:`, {
        message: error.message,
        status: error.status,
        code: error.code,
        type: error.type,
        response: error.response?.data,
        headers: error.response?.headers,
        errorDetails: JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0, 1000)
      })
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:993',message:'OpenAI streaming error caught',data:{error:error.message,status:error.status,code:error.code,type:error.type,responseData:error.response?.data,errorString:JSON.stringify(error, Object.getOwnPropertyNames(error)).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
      // #endregion
      
      // If any model fails with quota error, try non-streaming first (sometimes works when streaming doesn't)
      if ((error.status === 429 || error.code === 'insufficient_quota') && modelName === 'gpt-3.5-turbo') {
        // #region agent log
        console.log(`[DEBUG] gpt-3.5-turbo streaming failed with 429, trying non-streaming as test`)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1020',message:'Trying non-streaming test for gpt-3.5-turbo',data:{originalModel:modelName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        
        try {
          // Try non-streaming to see if API key works at all
          const testResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Hi' }], // Minimal test
            temperature: 0.7,
            max_tokens: 10,
            stream: false,
          })
          
          // #region agent log
          console.log(`[DEBUG] Non-streaming test succeeded! API key works. Response: ${testResponse.choices[0]?.message?.content?.substring(0, 50)}`)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1030',message:'Non-streaming test succeeded',data:{model:'gpt-3.5-turbo',responseLength:testResponse.choices[0]?.message?.content?.length || 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
          // #endregion
          
          // If non-streaming works, the issue is with streaming. Use non-streaming for the actual request
          const actualResponse = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: false,
          })
          
          // Yield the full response as a single chunk (simulate streaming)
          const content = actualResponse.choices[0]?.message?.content || ''
          if (content) {
            yield content
          }
          return // Success with non-streaming
        } catch (nonStreamError: any) {
          // #region agent log
          console.error(`[DEBUG] Non-streaming test also failed:`, nonStreamError.message, nonStreamError.status)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1045',message:'Non-streaming test failed',data:{error:nonStreamError.message,status:nonStreamError.status,code:nonStreamError.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
          // #endregion
          // If non-streaming also fails, billing setup is definitely required
          throw new Error(`OpenAI API requires billing setup. All models (including gpt-3.5-turbo) returned 429 insufficient_quota. Please add a payment method at https://platform.openai.com/account/billing`)
        }
      }
      
      // If gpt-4o fails with quota error, try gpt-4o-mini as fallback
      if (modelName === 'gpt-4o' && (error.status === 429 || error.code === 'insufficient_quota')) {
        // #region agent log
        console.log(`[DEBUG] gpt-4o quota error, trying gpt-4o-mini fallback`)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1015',message:'Trying gpt-4o-mini fallback',data:{originalModel:modelName,fallbackModel:'gpt-4o-mini'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
        // #endregion
        
        try {
          const fallbackStream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
          })
          
          for await (const chunk of fallbackStream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              yield text
            }
          }
          return // Success with fallback
        } catch (fallbackError: any) {
          // #region agent log
          console.error(`[DEBUG] gpt-4o-mini fallback also failed:`, fallbackError.message, fallbackError.status)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1030',message:'gpt-4o-mini fallback failed',data:{error:fallbackError.message,status:fallbackError.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
          // #endregion
          
          // If gpt-4o-mini also fails with quota, try gpt-3.5-turbo (free tier, always available)
          if (fallbackError.status === 429 || fallbackError.code === 'insufficient_quota') {
            // #region agent log
            console.log(`[DEBUG] Both gpt-4o models failed, trying gpt-3.5-turbo as final fallback`)
            fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1037',message:'Trying gpt-3.5-turbo final fallback',data:{originalModel:modelName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
            // #endregion
            
            try {
              const finalFallbackStream = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages,
                temperature,
                max_tokens: maxTokens,
                stream: true,
              })
              
              for await (const chunk of finalFallbackStream) {
                const text = chunk.choices[0]?.delta?.content || ''
                if (text) {
                  yield text
                }
              }
              return // Success with final fallback
            } catch (finalError: any) {
              // #region agent log
              console.error(`[DEBUG] gpt-3.5-turbo final fallback also failed:`, finalError.message, finalError.status)
              fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1052',message:'gpt-3.5-turbo final fallback failed',data:{error:finalError.message,status:finalError.status,code:finalError.code},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
              // #endregion
              throw error // Throw original error
            }
          }
          
          throw error // Throw original error, not fallback error
        }
      }
      
      throw error
    }
  } else if (model.startsWith('google')) {
    if (!gemini) {
      console.error('[aiOrchestrator] GoogleGenerativeAI not initialized for streaming. GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'SET' : 'NOT SET')
      throw new Error('GoogleGenerativeAI not initialized. Check GEMINI_API_KEY.')
    }
    
    // PHASE C¾: Use normalized model name (prevents 404 errors)
    const modelName = normalizedModel
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:835',message:'Gemini streaming attempt',data:{uiModel:uiModelName,normalizedModel:modelName,supportsStreaming:execConfig?.supportsStreaming},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    
    // PHASE C¾: Gemini streaming disabled - use non-streaming generateContent
    if (!execConfig || !execConfig.supportsStreaming) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:839',message:'Gemini streaming disabled, using generateContent',data:{modelName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // #endregion
      
      console.log(`[aiOrchestrator] Gemini streaming disabled, using non-streaming generateContent for ${modelName}`)
      
      // Use non-streaming generateContent instead
      const modelInstance = gemini.getGenerativeModel({ model: modelName })
      
      let fullPrompt = prompt
      if (systemInstruction) {
        fullPrompt = `${systemInstruction}\n\nUser: ${prompt}\n\nAssistant:`
      }
      
      // #region agent log
      const geminiKey = process.env.GEMINI_API_KEY
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1275',message:'Gemini streaming generateContent call',data:{modelName,fullPromptLength:fullPrompt.length,hasSystemInstruction:!!systemInstruction,apiKeyPresent:!!geminiKey,apiKeyLength:geminiKey?.length || 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      try {
        const result = await modelInstance.generateContent(fullPrompt)
        const text = result.response.text()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1279',message:'Gemini streaming generateContent successful',data:{modelName,responseLength:text.length,hasContent:!!text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        
        // Yield as single chunk
          if (text) {
            yield text
          }
        return
      } catch (streamError: any) {
        // #region agent log
        const errorStatus = streamError.status || streamError.statusCode || streamError.code
        const errorMessage = streamError.message || streamError.toString() || ''
        const errorResponse = streamError.response?.data || streamError.error || null
        console.error(`[DEBUG] Gemini streaming generateContent failed:`, errorMessage, 'status:', errorStatus)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1289',message:'Gemini streaming generateContent failed',data:{modelName,error:errorMessage,status:errorStatus,code:streamError.code,type:streamError.type,responseData:errorResponse,errorKeys:Object.keys(streamError || {}),fullError:JSON.stringify(streamError, Object.getOwnPropertyNames(streamError)).substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        throw streamError
      }
    }
    
    // PHASE C¾: This path should never be reached (capabilities check prevents it)
    throw new Error(`Gemini streaming is disabled. Use non-streaming generateContent instead.`)
  } else if (model.startsWith('xai')) {
    if (!xai) {
      throw new Error('XAI_API_KEY not configured. Please add your xAI API key to use Grok models.')
    }
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction })
    }
    
    messages.push({ role: 'user', content: prompt })
    
    // PHASE C¾: Use normalized model name
    const modelName = normalizedModel
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:936',message:'xAI streaming attempt',data:{uiModel:uiModelName,normalizedModel:modelName,supportsStreaming:execConfig?.supportsStreaming},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    // PHASE C¾: xAI does NOT support streaming - ALWAYS use non-streaming completion
    // This check should never be false because of the capability check at the top,
    // but we keep it as a defensive guard
    console.warn(`[aiOrchestrator] xAI does not support streaming, using non-streaming completion for ${modelName}`)
    
    // #region agent log
    // Re-read and clean the API key fresh from environment (same as non-streaming path)
    const xaiKeyRaw = process.env.XAI_API_KEY
    const xaiKey = xaiKeyRaw ? xaiKeyRaw.trim().replace(/^["']|["']$/g, '') : null
    const keyHasQuotes = xaiKeyRaw && (xaiKeyRaw.startsWith('"') || xaiKeyRaw.startsWith("'") || xaiKeyRaw.endsWith('"') || xaiKeyRaw.endsWith("'"))
    
    console.log(`[DEBUG] xAI non-streaming completion: modelName=${modelName}, execConfig.supportsStreaming=${execConfig.supportsStreaming}, keyLength=${xaiKey?.length || 0}, hadQuotes=${keyHasQuotes}`)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1237',message:'xAI streaming disabled, using non-streaming completion',data:{modelName,supportsStreaming:execConfig.supportsStreaming,apiKeyPresent:!!xaiKey,apiKeyLength:xaiKey?.length || 0,apiKeyPrefix:xaiKey?.substring(0,10) || 'N/A',hasWhitespace:xaiKeyRaw ? xaiKeyRaw.trim() !== xaiKeyRaw : false,hadQuotes:keyHasQuotes,clientExists:!!xai,baseURL:xai?.baseURL || 'N/A',messageCount:messages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    
    if (!xaiKey) {
      throw new Error('XAI_API_KEY not configured. Please add your xAI API key to use Grok models.')
    }
    
    // Create fresh client with cleaned key (same fix as non-streaming path)
    const clientToUse = new OpenAI({
      baseURL: 'https://api.x.ai/v1',
      apiKey: xaiKey
    })
    
    // CRITICAL: ALWAYS use stream: false for xAI (prevents misleading 400 "Incorrect API key" errors)
    try {
      const response = await clientToUse.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false, // PHASE C¾: Explicit non-streaming (prevents misleading 400 errors)
      })
      
      const text = response.choices[0]?.message?.content || ''
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1247',message:'xAI streaming completion successful',data:{modelName,responseLength:text.length,hasContent:!!text},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
      if (text) {
        yield text
      }
      return
    } catch (streamError: any) {
      // #region agent log
      const errorStatus = streamError.status || streamError.statusCode || streamError.code
      const errorMessage = streamError.message || streamError.toString() || ''
      const errorResponse = streamError.response?.data || streamError.error || null
      console.error(`[DEBUG] xAI streaming completion failed:`, errorMessage, 'status:', errorStatus)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'aiOrchestrator.ts:1254',message:'xAI streaming completion failed',data:{modelName,error:errorMessage,status:errorStatus,code:streamError.code,type:streamError.type,responseData:errorResponse,errorKeys:Object.keys(streamError || {}),fullError:JSON.stringify(streamError, Object.getOwnPropertyNames(streamError)).substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      throw streamError
    }
    if (text) {
      yield text
    }
    return
  } else if (model.startsWith('deepseek')) {
    if (!deepseek) {
      throw new Error('DEEPSEEK_API_KEY not configured. Please add your DeepSeek API key to use DeepSeek models.')
    }
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction })
    }
    
    messages.push({ role: 'user', content: prompt })
    
    // PHASE C¾: Use normalized model name
    const modelName = normalizedModel
    
    console.log(`[aiOrchestrator] Streaming DeepSeek API with model: ${modelName}`)
    const stream = await deepseek.chat.completions.create({
      model: modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    })
    
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        yield text
      }
    }
  } else if (model.startsWith('moonshot')) {
    if (!moonshot) {
      throw new Error('MOONSHOT_API_KEY not configured. Please add your Moonshot AI API key to use Kimi models.')
    }
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction })
    }
    
    messages.push({ role: 'user', content: prompt })
    
    // PHASE C¾: Use normalized model name
    const modelName = normalizedModel
    
    console.log(`[aiOrchestrator] Streaming Moonshot API with model: ${modelName}`)
    const stream = await moonshot.chat.completions.create({
      model: modelName,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    })
    
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        yield text
      }
    }
  } else {
    throw new Error(`Unsupported model for streaming: ${model}`)
  }
}
