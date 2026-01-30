import { create } from 'zustand'

export type AIModelSelection = 'auto' | 'gpt-5.1' | 'gemini-3-pro' | 'gemini-2.5-flash' | 'grok-4' | 'kimi-k2' | 'deepseek-3'

export interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  action?: 'generate' | 'explain' | 'rewrite' | 'fix'
  domain?: string
  modelUsed?: string
  timestamp: number
}

export interface LastRequest {
  action: 'generate' | 'explain' | 'rewrite' | 'fix'
  prompt?: string
  code?: string
  instructions?: string
  error?: string
  domain?: string
}

interface ChatStore {
  messages: Message[]
  lastRequest: LastRequest | null
  currentDomain: string
  selectedModel: AIModelSelection
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void
  clearMessages: () => void
  exportConversation: () => void
  updateLastMessage: (content: string, modelUsed?: string) => void
  setLastRequest: (request: LastRequest) => void
  getLastUserPrompt: () => string
  setMessages: (messages: Message[]) => void
  setDomain: (domain: string) => void
  setSelectedModel: (model: AIModelSelection) => void
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  lastRequest: null,
  currentDomain: typeof window !== 'undefined' ? localStorage.getItem('devmate-domain') || 'general' : 'general',
  selectedModel: (typeof window !== 'undefined' ? localStorage.getItem('devmate-model') : null) as AIModelSelection || 'auto',
  
  addMessage: (message) => {
    const timestamp = Date.now()
    const newMessage: Message = {
      ...message,
      id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
    }
    set((state) => ({
      messages: [...state.messages, newMessage],
    }))
  },
  
  updateLastMessage: (content, modelUsed) => {
    set((state) => {
      const messages = [...state.messages]
      if (messages.length > 0) {
        messages[messages.length - 1].content = content
        if (modelUsed) {
          messages[messages.length - 1].modelUsed = modelUsed
        }
      }
      return { messages }
    })
  },
  
  setLastRequest: (request) => set({ lastRequest: request }),
  
  getLastUserPrompt: () => {
    const { messages } = get()
    const lastUserMessage = [...messages].reverse().find((msg) => msg.type === 'user')
    return lastUserMessage?.content || ''
  },
  
  clearMessages: () => set({ messages: [], lastRequest: null }),
  
  setMessages: (messages) => set({ messages }),
  
  setDomain: (domain) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('devmate-domain', domain)
    }
    set({ currentDomain: domain })
  },
  
  setSelectedModel: (model) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('devmate-model', model)
    }
    set({ selectedModel: model })
  },
  
  exportConversation: () => {
    const { messages } = get()
    const text = messages
      .map((msg) => {
        const prefix = msg.type === 'user' ? 'You' : 'Devmate'
        const action = msg.action ? ` [${msg.action}]` : ''
        return `${prefix}${action}:\n${msg.content}\n`
      })
      .join('\n---\n\n')
    
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `devmate-conversation-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },
}))
