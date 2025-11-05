import OpenAI from 'openai'
import { GoogleGenAI } from '@google/genai'

// DON'T DELETE THIS COMMENT - from blueprint:javascript_openai
// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user

// DON'T DELETE THIS COMMENT - from blueprint:javascript_gemini
// Note that the newest Gemini model series is "gemini-2.5-flash" or "gemini-2.5-pro"

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || '' 
})

const gemini = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '' 
})

export type AIModel = 'openai:gpt-5' | 'google:gemini-2.5-pro' | 'google:gemini-2.5-flash'

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

export function chooseModel(prompt: string, action?: string, domain?: string): AIModel {
  const lowerPrompt = prompt.toLowerCase()
  const lowerDomain = domain?.toLowerCase() || ''
  
  // Code generation and building tasks -> GPT-5
  const codeKeywords = ['code', 'build', 'create', 'generate', 'implement', 'function', 'class', 'backend', 'frontend', 'api', 'database', 'app', 'application', 'website', 'program']
  const hasCodeKeywords = codeKeywords.some(k => lowerPrompt.includes(k) || lowerDomain.includes(k))
  
  // Actions that benefit from GPT-5
  const codeActions = ['generate', 'rewrite', 'fix']
  const isCodeAction = action && codeActions.includes(action)
  
  // Web Development domain always uses GPT-5
  if (lowerDomain.includes('web') || lowerDomain.includes('development')) {
    return 'openai:gpt-5'
  }
  
  // Code-related tasks use GPT-5
  if (hasCodeKeywords || isCodeAction) {
    return 'openai:gpt-5'
  }
  
  // Reasoning, summaries, explanations -> Gemini 2.5 Pro
  const reasoningKeywords = ['explain', 'analyze', 'summarize', 'what is', 'how does', 'why', 'describe', 'compare']
  const hasReasoningKeywords = reasoningKeywords.some(k => lowerPrompt.includes(k))
  
  if (hasReasoningKeywords || action === 'explain') {
    return 'google:gemini-2.5-pro'
  }
  
  // Default: use GPT-5 for most tasks
  return 'openai:gpt-5'
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
      
      const response = await openai.chat.completions.create({
        model: 'gpt-5',
        messages,
        max_completion_tokens: maxTokens,
      })
      
      return response.choices[0]?.message?.content || ''
    }
    
    if (model.startsWith('google')) {
      const modelName = model.includes('flash') ? 'gemini-2.5-flash' : 'gemini-2.5-pro'
      
      const config: any = {}
      if (systemInstruction) {
        config.systemInstruction = systemInstruction
      }
      if (temperature) {
        config.temperature = temperature
      }
      
      const response = await gemini.models.generateContent({
        model: modelName,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }]
          }
        ],
        config: Object.keys(config).length > 0 ? config : undefined,
      })
      
      return response.text || ''
    }
    
    throw new Error(`Unsupported model: ${model}`)
  } catch (error: any) {
    console.error(`Error calling ${model}:`, error)
    throw error
  }
}

export async function callAIModelWithFailover(
  request: AIRequest
): Promise<AIResponse> {
  const primaryModel = chooseModel(request.prompt, request.action, request.domain)
  
  try {
    const text = await callAIModel(primaryModel, request)
    return { text, modelUsed: primaryModel }
  } catch (error: any) {
    console.warn(`Primary model ${primaryModel} failed, attempting failover:`, error.message)
    
    // Failover logic
    const fallbackModel: AIModel = primaryModel.startsWith('openai') 
      ? 'google:gemini-2.5-pro' 
      : 'openai:gpt-5'
    
    try {
      const text = await callAIModel(fallbackModel, request)
      console.log(`Failover successful with ${fallbackModel}`)
      return { text, modelUsed: fallbackModel }
    } catch (fallbackError: any) {
      console.error(`Failover model ${fallbackModel} also failed:`, fallbackError.message)
      throw new Error(`Both AI models failed. Primary: ${error.message}, Fallback: ${fallbackError.message}`)
    }
  }
}

export async function* streamAIModelWithFailover(
  request: AIRequest
): AsyncGenerator<string, void, unknown> {
  const primaryModel = chooseModel(request.prompt, request.action, request.domain)
  
  try {
    yield* streamAIModel(primaryModel, request)
  } catch (error: any) {
    console.warn(`Primary streaming model ${primaryModel} failed, attempting failover:`, error.message)
    
    const fallbackModel: AIModel = primaryModel.startsWith('openai') 
      ? 'google:gemini-2.5-pro' 
      : 'openai:gpt-5'
    
    try {
      console.log(`Streaming failover to ${fallbackModel}`)
      yield* streamAIModel(fallbackModel, request)
    } catch (fallbackError: any) {
      console.error(`Fallback streaming model ${fallbackModel} also failed:`, fallbackError.message)
      throw new Error(`Both AI models failed for streaming. Primary: ${error.message}, Fallback: ${fallbackError.message}`)
    }
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
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-5',
      messages,
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
    
    const config: any = {}
    if (systemInstruction) {
      config.systemInstruction = systemInstruction
    }
    if (temperature) {
      config.temperature = temperature
    }
    
    const response = await gemini.models.generateContentStream({
      model: modelName,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config: Object.keys(config).length > 0 ? config : undefined,
    })
    
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
