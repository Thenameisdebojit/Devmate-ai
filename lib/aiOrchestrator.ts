import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'

// DON'T DELETE THIS COMMENT - from blueprint:javascript_openai
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user

// DON'T DELETE THIS COMMENT - from blueprint:javascript_gemini
// Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"

// DON'T DELETE THIS COMMENT - from blueprint:javascript_xai
// Grok models available: grok-4 (latest, most intelligent), grok-2-1212 (text-only, 131k context), grok-2-vision-1212 (vision support)

if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
  // Allow starting without keys, but warn
  console.warn('No AI API keys found in environment variables')
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
}) : null

// Initialize GoogleGenAI with proper error handling
let gemini: GoogleGenAI | null = null
try {
  if (process.env.GEMINI_API_KEY) {
    gemini = new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY
    })
  }
} catch (error) {
  console.error('Failed to initialize GoogleGenAI:', error)
  // Will throw error when actually used if not initialized
}

// DON'T DELETE THIS COMMENT - from blueprint:javascript_xai
// xAI client is optional - only initialized if XAI_API_KEY is available
let xai: OpenAI | null = null
if (process.env.XAI_API_KEY) {
  xai = new OpenAI({ 
    baseURL: 'https://api.x.ai/v1',
    apiKey: process.env.XAI_API_KEY
  })
}

// Environment-based model preference
const PREFERRED_GPT_MODEL = process.env.PREFERRED_GPT_MODEL === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o' // Default to 4o as 5 is not out

export type AIModel = 'openai:gpt-5' | 'openai:gpt-4o' | 'google:gemini-1.5-pro' | 'google:gemini-1.5-flash' | 'google:gemini-2.5-pro' | 'google:gemini-2.5-flash' | 'xai:grok-4' | 'xai:grok-2-1212' | 'xai:grok-vision-beta'

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
      'openai:gpt-5', 
      'openai:gpt-4o', 
      'google:gemini-1.5-pro', 
      'google:gemini-1.5-flash', 
      'xai:grok-4', 
      'xai:grok-2-1212', 
      'xai:grok-vision-beta'
    ]
    
    if (validModels.includes(userPreference as AIModel)) {
      return userPreference as AIModel
    }
    
    // Handle legacy format for backward compatibility
    if (userPreference === 'chatgpt-5') {
      return 'openai:gpt-4o' // Fallback to 4o
    } else if (userPreference === 'gemini-2.5-pro' || userPreference === 'gemini-1.5-pro') {
      return 'google:gemini-2.5-pro'
    } else if (userPreference === 'gemini-2.5-flash' || userPreference === 'gemini-1.5-flash') {
      return 'google:gemini-2.5-flash'
    } else if (userPreference === 'grok-4') {
      return 'xai:grok-4'
    } else if (userPreference === 'grok-2-1212') {
      return 'xai:grok-2-1212'
    } else if (userPreference === 'grok-vision-beta') {
      return 'xai:grok-vision-beta'
    }
  }
  
  // Auto mode: intelligent routing with performance optimization
  const lowerPrompt = prompt.toLowerCase()
  const lowerDomain = domain?.toLowerCase() || ''
  const promptLength = prompt.length
  
  // Short queries (< 100 chars) -> Gemini Flash for speed
  const shortQuery = promptLength < 100
  const simpleKeywords = ['hi', 'hello', 'what', 'how', 'why', 'explain', 'tell me', 'can you']
  const isSimpleQuery = simpleKeywords.some(k => lowerPrompt.startsWith(k))
  
  if (shortQuery && isSimpleQuery && action !== 'generate') {
    return 'google:gemini-1.5-flash'
  }
  
  // Code generation and building tasks -> GPT-4o or Gemini 1.5 Pro
  const codeKeywords = ['code', 'build', 'create', 'generate', 'implement', 'function', 'class', 'backend', 'frontend', 'api', 'database', 'app', 'application', 'website', 'program']
  const hasCodeKeywords = codeKeywords.some(k => lowerPrompt.includes(k) || lowerDomain.includes(k))
  
  // Actions that benefit from smarter models
  const codeActions = ['generate', 'rewrite', 'fix']
  const isCodeAction = action && codeActions.includes(action)
  
  // Web Development domain always uses preferred GPT model
  if (lowerDomain.includes('web') || lowerDomain.includes('development')) {
    return PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-4o'
  }
  
  // Code-related tasks use preferred GPT model
  if (hasCodeKeywords || isCodeAction) {
    return PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-4o'
  }
  
  // Reasoning, summaries, explanations -> Gemini 1.5 Flash for speed
  const reasoningKeywords = ['explain', 'analyze', 'summarize', 'what is', 'how does', 'why', 'describe', 'compare']
  const hasReasoningKeywords = reasoningKeywords.some(k => lowerPrompt.includes(k))
  
  if (hasReasoningKeywords || action === 'explain') {
    return 'google:gemini-1.5-flash'
  }
  
  // Default: use Flash for general conversation, GPT for complex tasks
  return promptLength > 200 || hasCodeKeywords 
    ? (PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-4o')
    : 'google:gemini-1.5-flash'
}

// Helper function to check if error is a rate limit/quota error
function isRateLimitError(error: any): boolean {
  if (!error) return false
  const errorMessage = error.message || error.toString() || ''
  const errorCode = error.code || error.status || error.statusCode
  
  return (
    errorCode === 429 ||
    errorMessage.includes('429') ||
    errorMessage.includes('quota') ||
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
      
      const modelName = model.includes('gpt-4o') ? 'gpt-4o' : 'gpt-5'
      
      const response = await openai.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_completion_tokens: maxTokens,
      })
      
      return response.choices[0]?.message?.content || ''
    }
    
    if (model.startsWith('google')) {
      if (!gemini) {
        throw new Error('GoogleGenAI not initialized. Check GEMINI_API_KEY.')
      }
      
      const modelName = model.includes('flash') ? 'gemini-1.5-flash' : 'gemini-1.5-pro'
      
      try {
        // Try the official @google/generative-ai API structure first
        if (typeof (gemini as any).getGenerativeModel === 'function') {
          const modelInstance = (gemini as any).getGenerativeModel({ 
            model: modelName,
            systemInstruction: systemInstruction || undefined,
            generationConfig: {
              temperature: temperature || 0.7,
              maxOutputTokens: maxTokens || 4096,
            }
          })
          
          const result = await modelInstance.generateContent(prompt)
          const response = result.response
          return response.text() || ''
        } else {
          throw new Error('getGenerativeModel not available')
        }
      } catch (error: any) {
        // Fallback to alternative API structure if the above fails
        console.warn('Primary Gemini API call failed, trying fallback:', error.message)
        
        try {
          // Alternative API structure
          const requestParams: any = {
            model: modelName,
            contents: [
              {
                role: 'user',
                parts: [{ text: prompt }]
              }
            ]
          }
          
          if (systemInstruction) {
            requestParams.systemInstruction = { text: systemInstruction }
          }
          
          if (temperature || maxTokens) {
            requestParams.config = {}
            if (temperature) requestParams.config.temperature = temperature
            if (maxTokens) requestParams.config.maxOutputTokens = maxTokens
          }
          
          // Try different API methods
          if ((gemini as any).models && (gemini as any).models.generateContent) {
            const response = await (gemini as any).models.generateContent(requestParams)
            return response.text || response.response?.text() || ''
          } else if ((gemini as any).generateContent) {
            const response = await (gemini as any).generateContent(requestParams)
            return response.text || response.response?.text() || ''
          } else {
            throw new Error('Unknown GoogleGenAI API structure')
          }
        } catch (fallbackError: any) {
          console.error('Gemini API fallback also failed:', fallbackError)
          // Check if it's a rate limit error
          if (isRateLimitError(fallbackError)) {
            throw new Error(`Gemini API quota exceeded: ${fallbackError.message}`)
          }
          throw new Error(`Gemini API call failed: ${fallbackError.message}`)
        }
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
      
      const modelName = model.includes('grok-4') ? 'grok-4' : model.includes('vision') ? 'grok-2-vision-1212' : 'grok-2-1212'
      
      const response = await xai.chat.completions.create({
        model: modelName,
        messages,
        temperature,
        max_tokens: maxTokens,
      })
      
      return response.choices[0]?.message?.content || ''
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
    console.warn(`Primary model ${primaryModel} failed${isQuotaError ? ' (quota exceeded)' : ''}, attempting failover:`, error.message)
    
    // Smart failover logic - prioritize OpenAI when Gemini has quota issues
    const fallbackModels: AIModel[] = []
    
    // If Gemini failed due to quota, prioritize OpenAI models but try Flash first if applicable
    if (isQuotaError && primaryModel.startsWith('google')) {
      // If primary was NOT flash, try flash first as it often has higher quotas
      if (!primaryModel.includes('flash')) {
        fallbackModels.push('google:gemini-1.5-flash')
      }

      // Then try OpenAI models
      fallbackModels.push(
        PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5',
        PREFERRED_GPT_MODEL === 'gpt-5' ? 'openai:gpt-4o' : 'openai:gpt-5'
      )
      if (xai) {
        fallbackModels.push('xai:grok-4', 'xai:grok-2-1212')
      }
    } else {
      // Normal failover logic
      if (primaryModel === 'openai:gpt-5') {
        fallbackModels.push('openai:gpt-4o')
        // Only add Gemini if we haven't seen quota errors recently
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-flash', 'google:gemini-1.5-pro')
        }
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'openai:gpt-4o') {
        fallbackModels.push('openai:gpt-5')
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-flash', 'google:gemini-1.5-pro')
        }
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-1.5-pro') {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-flash')
        }
        fallbackModels.push(PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-1.5-flash') {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-pro')
        }
        fallbackModels.push(PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
        if (xai) fallbackModels.push('xai:grok-4')
      } else {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-flash')
        }
        fallbackModels.push(PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
        if (xai) fallbackModels.push('xai:grok-4')
      }
    }
    
    // Try each fallback model
    for (const fallbackModel of fallbackModels) {
      try {
        const text = await callAIModel(fallbackModel, request)
        console.log(`✓ Failover successful with ${fallbackModel}`)
        return { text, modelUsed: fallbackModel }
      } catch (fallbackError: any) {
        const isFallbackQuotaError = isRateLimitError(fallbackError)
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
  
  try {
    yield* streamAIModel(primaryModel, request)
  } catch (error: any) {
    const isQuotaError = isRateLimitError(error)
    console.warn(`Primary streaming model ${primaryModel} failed${isQuotaError ? ' (quota exceeded)' : ''}, attempting failover:`, error.message)
    
    // Smart failover logic - prioritize OpenAI when Gemini has quota issues
    const fallbackModels: AIModel[] = []
    
    // If Gemini failed due to quota, prioritize OpenAI models
    if (isQuotaError && primaryModel.startsWith('google')) {
      // Skip all Gemini models if quota exceeded
      fallbackModels.push(
        PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5',
        PREFERRED_GPT_MODEL === 'gpt-5' ? 'openai:gpt-4o' : 'openai:gpt-5'
      )
      if (xai) {
        fallbackModels.push('xai:grok-4', 'xai:grok-2-1212')
      }
    } else {
      // Normal failover logic
      if (primaryModel === 'openai:gpt-5') {
        fallbackModels.push('openai:gpt-4o')
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-2.5-flash', 'google:gemini-2.5-pro')
        }
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'openai:gpt-4o') {
        fallbackModels.push('openai:gpt-5')
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-2.5-flash', 'google:gemini-2.5-pro')
        }
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-1.5-pro') {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-flash')
        }
        fallbackModels.push(PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
        if (xai) fallbackModels.push('xai:grok-4')
      } else if (primaryModel === 'google:gemini-1.5-flash') {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-pro')
        }
        fallbackModels.push(PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
        if (xai) fallbackModels.push('xai:grok-4')
      } else {
        if (!isQuotaError) {
          fallbackModels.push('google:gemini-1.5-flash')
        }
        fallbackModels.push(PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
        if (xai) fallbackModels.push('xai:grok-4')
      }
    }
    
    // Try each fallback model
    for (const fallbackModel of fallbackModels) {
      try {
        console.log(`✓ Streaming failover to ${fallbackModel}`)
        yield* streamAIModel(fallbackModel, request)
        return
      } catch (fallbackError: any) {
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
    
    throw new Error(`All AI models failed for streaming. Primary (${primaryModel}): ${error.message}`)
  }
}

export async function* streamAIModel(
  model: AIModel,
  request: AIRequest
): AsyncGenerator<string, void, unknown> {
  const { prompt, systemInstruction, temperature = 0.3, maxTokens = 4096 } = request
  
  if (model.startsWith('openai')) {
    if (!openai) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY.')
    }
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction })
    }
    
    messages.push({ role: 'user', content: prompt })
    
    const modelName = model.includes('gpt-4o') ? 'gpt-4o' : 'gpt-5'
    
    const stream = await openai.chat.completions.create({
      model: modelName,
      messages,
      temperature,
      max_completion_tokens: maxTokens,
      stream: true,
    })
    
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || ''
      if (text) {
        yield text
      }
    }
  } else if (model.startsWith('google')) {
    if (!gemini) {
      throw new Error('GoogleGenAI not initialized. Check GEMINI_API_KEY.')
    }
    
    let modelName = 'gemini-2.5-pro' // Default to 2.5-pro
    if (model.includes('gemini-1.5-flash')) modelName = 'gemini-1.5-flash'
    else if (model.includes('gemini-1.5-pro')) modelName = 'gemini-1.5-pro'
    else if (model.includes('gemini-2.5-flash')) modelName = 'gemini-2.5-flash'
    else if (model.includes('gemini-2.5-pro')) modelName = 'gemini-2.5-pro'
    else if (model.includes('flash')) modelName = 'gemini-2.5-flash' // Default flash to 2.5
    
    try {
      // Try the official @google/generative-ai streaming API structure first
      if (typeof (gemini as any).getGenerativeModel === 'function') {
        const modelInstance = (gemini as any).getGenerativeModel({ 
          model: modelName,
          systemInstruction: systemInstruction || undefined,
          generationConfig: {
            temperature: temperature || 0.7,
            maxOutputTokens: maxTokens || 4096,
          }
        })
        
        const result = await modelInstance.generateContentStream(prompt)
        
        for await (const chunk of result.stream) {
          const chunkText = chunk.text()
          if (chunkText) {
            yield chunkText
          }
        }
        return
      } else {
        throw new Error('getGenerativeModel not available')
      }
    } catch (error: any) {
      // Fallback to alternative API structure
      console.warn('Primary Gemini streaming API failed, trying fallback:', error.message)
      
      try {
        const requestParams: any = {
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ]
        }
        
        if (systemInstruction) {
          requestParams.systemInstruction = { text: systemInstruction }
        }
        
        if (temperature || maxTokens) {
          requestParams.config = {}
          if (temperature) requestParams.config.temperature = temperature
          if (maxTokens) requestParams.config.maxOutputTokens = maxTokens
        }
        
        // Try different streaming API methods
        let stream: any
        if ((gemini as any).models && (gemini as any).models.generateContentStream) {
          stream = await (gemini as any).models.generateContentStream(requestParams)
        } else if ((gemini as any).generateContentStream) {
          stream = await (gemini as any).generateContentStream(requestParams)
        } else {
          throw new Error('Unknown GoogleGenAI streaming API structure')
        }
        
        for await (const chunk of stream) {
          const text = chunk.text || chunk.response?.text() || ''
          if (text) {
            yield text
          }
        }
      } catch (fallbackError: any) {
        console.error('Gemini streaming API fallback also failed:', fallbackError)
        throw new Error(`Gemini streaming API call failed: ${fallbackError.message}`)
      }
    }
  } else if (model.startsWith('xai')) {
    if (!xai) {
      throw new Error('XAI_API_KEY not configured. Please add your xAI API key to use Grok models.')
    }
    
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction })
    }
    
    messages.push({ role: 'user', content: prompt })
    
    const modelName = model.includes('grok-4') ? 'grok-4' : model.includes('vision') ? 'grok-2-vision-1212' : 'grok-2-1212'
    
    const stream = await xai.chat.completions.create({
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
