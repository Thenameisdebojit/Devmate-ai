import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'

// DON'T DELETE THIS COMMENT - from blueprint:javascript_openai
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user

// DON'T DELETE THIS COMMENT - from blueprint:javascript_gemini
// Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required')
}

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required')
}

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY
})

const gemini = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY
})

// Environment-based model preference
const PREFERRED_GPT_MODEL = process.env.PREFERRED_GPT_MODEL === 'gpt-4o' ? 'gpt-4o' : 'gpt-5'

export type AIModel = 'openai:gpt-5' | 'openai:gpt-4o' | 'google:gemini-2.5-pro' | 'google:gemini-2.5-flash'

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
    if (userPreference === 'chatgpt-5') {
      return 'openai:gpt-5'
    } else if (userPreference === 'gemini-2.5-pro') {
      return 'google:gemini-2.5-pro'
    } else if (userPreference === 'gemini-2.5-flash') {
      return 'google:gemini-2.5-flash'
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
    return 'google:gemini-2.5-flash'
  }
  
  // Code generation and building tasks -> GPT-5
  const codeKeywords = ['code', 'build', 'create', 'generate', 'implement', 'function', 'class', 'backend', 'frontend', 'api', 'database', 'app', 'application', 'website', 'program']
  const hasCodeKeywords = codeKeywords.some(k => lowerPrompt.includes(k) || lowerDomain.includes(k))
  
  // Actions that benefit from GPT-5
  const codeActions = ['generate', 'rewrite', 'fix']
  const isCodeAction = action && codeActions.includes(action)
  
  // Web Development domain always uses preferred GPT model
  if (lowerDomain.includes('web') || lowerDomain.includes('development')) {
    return PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5'
  }
  
  // Code-related tasks use preferred GPT model
  if (hasCodeKeywords || isCodeAction) {
    return PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5'
  }
  
  // Reasoning, summaries, explanations -> Gemini 2.5 Flash for speed
  const reasoningKeywords = ['explain', 'analyze', 'summarize', 'what is', 'how does', 'why', 'describe', 'compare']
  const hasReasoningKeywords = reasoningKeywords.some(k => lowerPrompt.includes(k))
  
  if (hasReasoningKeywords || action === 'explain') {
    return 'google:gemini-2.5-flash'
  }
  
  // Default: use Flash for general conversation, GPT for complex tasks
  return promptLength > 200 || hasCodeKeywords 
    ? (PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
    : 'google:gemini-2.5-flash'
}

export async function callAIModel(
  model: AIModel,
  request: AIRequest
): Promise<string> {
  const { prompt, systemInstruction, temperature = 0.3, maxTokens = 4096 } = request
  
  try {
    if (model.startsWith('openai')) {
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
      const modelName = model.includes('flash') ? 'gemini-2.5-flash' : 'gemini-2.5-pro'
      
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
      
      const response = await gemini.models.generateContent(requestParams)
      
      return response.text || ''
    }
    
    throw new Error(`Unsupported model: ${model}`)
  } catch (error: any) {
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
    console.warn(`Primary model ${primaryModel} failed, attempting failover:`, error.message)
    
    // Smart failover logic with Flash as fast alternative
    const fallbackModels: AIModel[] = []
    
    if (primaryModel === 'openai:gpt-5') {
      fallbackModels.push('openai:gpt-4o', 'google:gemini-2.5-flash', 'google:gemini-2.5-pro')
    } else if (primaryModel === 'openai:gpt-4o') {
      fallbackModels.push('openai:gpt-5', 'google:gemini-2.5-flash', 'google:gemini-2.5-pro')
    } else if (primaryModel === 'google:gemini-2.5-pro') {
      fallbackModels.push('google:gemini-2.5-flash', PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
    } else if (primaryModel === 'google:gemini-2.5-flash') {
      fallbackModels.push('google:gemini-2.5-pro', PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
    } else {
      fallbackModels.push('google:gemini-2.5-flash', PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
    }
    
    // Try each fallback model
    for (const fallbackModel of fallbackModels) {
      try {
        const text = await callAIModel(fallbackModel, request)
        console.log(`✓ Failover successful with ${fallbackModel}`)
        return { text, modelUsed: fallbackModel }
      } catch (fallbackError: any) {
        console.warn(`✗ Failover model ${fallbackModel} also failed:`, fallbackError.message)
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
    console.warn(`Primary streaming model ${primaryModel} failed, attempting failover:`, error.message)
    
    // Smart failover logic with Flash as fast alternative
    const fallbackModels: AIModel[] = []
    
    if (primaryModel === 'openai:gpt-5') {
      fallbackModels.push('openai:gpt-4o', 'google:gemini-2.5-flash', 'google:gemini-2.5-pro')
    } else if (primaryModel === 'openai:gpt-4o') {
      fallbackModels.push('openai:gpt-5', 'google:gemini-2.5-flash', 'google:gemini-2.5-pro')
    } else if (primaryModel === 'google:gemini-2.5-pro') {
      fallbackModels.push('google:gemini-2.5-flash', PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
    } else if (primaryModel === 'google:gemini-2.5-flash') {
      fallbackModels.push('google:gemini-2.5-pro', PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
    } else {
      fallbackModels.push('google:gemini-2.5-flash', PREFERRED_GPT_MODEL === 'gpt-4o' ? 'openai:gpt-4o' : 'openai:gpt-5')
    }
    
    // Try each fallback model
    for (const fallbackModel of fallbackModels) {
      try {
        console.log(`✓ Streaming failover to ${fallbackModel}`)
        yield* streamAIModel(fallbackModel, request)
        return
      } catch (fallbackError: any) {
        console.warn(`✗ Streaming failover model ${fallbackModel} also failed:`, fallbackError.message)
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
    const modelName = model.includes('flash') ? 'gemini-2.5-flash' : 'gemini-2.5-pro'
    
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
    
    const response = await gemini.models.generateContentStream(requestParams)
    
    for await (const chunk of response) {
      const text = chunk.text || ''
      if (text) {
        yield text
      }
    }
  } else {
    throw new Error(`Unsupported model for streaming: ${model}`)
  }
}
