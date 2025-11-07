'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore, AIModelSelection } from '../store/useChatStore'
import toast from 'react-hot-toast'
import { FiSend, FiStopCircle, FiPaperclip, FiX, FiImage, FiChevronDown, FiZap, FiCpu } from 'react-icons/fi'
import { SiOpenai, SiGoogle } from 'react-icons/si'
import { motion, AnimatePresence } from 'framer-motion'

interface InputSectionProps {
  onNewChat: () => void
}

interface UploadedFile {
  file: File
  preview: string
  type: string
  name?: string
  content?: string
}

export default function InputSection({ onNewChat }: InputSectionProps) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [showModelSelector, setShowModelSelector] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { addMessage, updateLastMessage, currentDomain, messages, selectedModel, setSelectedModel } = useChatStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [prompt])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowModelSelector(false)
      }
    }

    if (showModelSelector) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showModelSelector])

  const getModelLabel = (model: AIModelSelection) => {
    switch (model) {
      case 'auto':
        return 'Auto (Smart)'
      case 'chatgpt-5':
        return 'GPT-5'
      case 'gemini-2.5-pro':
        return 'Gemini 2.5 Pro'
      case 'gemini-2.5-flash':
        return 'Gemini 2.5 Flash'
      case 'grok-4':
        return 'Grok 4'
      case 'grok-2-1212':
        return 'Grok 2'
      case 'grok-vision-beta':
        return 'Grok Vision'
      default:
        return 'Auto (Smart)'
    }
  }

  const getModelIcon = (model: AIModelSelection) => {
    switch (model) {
      case 'auto':
        return <FiZap className="w-4 h-4" />
      case 'chatgpt-5':
        return <SiOpenai className="w-4 h-4" />
      case 'gemini-2.5-pro':
        return <SiGoogle className="w-4 h-4" />
      case 'gemini-2.5-flash':
        return <FiCpu className="w-4 h-4 text-blue-500" />
      case 'grok-4':
        return <FiCpu className="w-4 h-4 text-rose-500" />
      case 'grok-2-1212':
        return <FiCpu className="w-4 h-4 text-purple-500" />
      case 'grok-vision-beta':
        return <FiCpu className="w-4 h-4 text-indigo-500" />
      default:
        return <FiZap className="w-4 h-4" />
    }
  }

  const handleModelSelect = (model: AIModelSelection) => {
    setSelectedModel(model)
    setShowModelSelector(false)
    toast.success(`Switched to ${getModelLabel(model)}`)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const formData = new FormData()
    Array.from(files).forEach(file => {
      formData.append('files', file)
    })

    try {
      toast.loading('Processing files...', { id: 'file-upload' })
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Failed to process files')
      }

      const data = await response.json()
      
      data.files.forEach((processedFile: any, index: number) => {
        const originalFile = Array.from(files)[index]
        setUploadedFiles(prev => [...prev, {
          file: originalFile,
          preview: processedFile.type === 'image' ? processedFile.content : '',
          type: processedFile.type,
          name: processedFile.name,
          content: processedFile.content
        }])
      })

      toast.success(`${data.count} file(s) processed`, { id: 'file-upload' })
    } catch (error) {
      toast.error('Failed to process files', { id: 'file-upload' })
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()

    if ((!prompt.trim() && uploadedFiles.length === 0) || isLoading) {
      return
    }

    const userPrompt = prompt.trim()
    setPrompt('')
    setIsLoading(true)

    let messageContent = userPrompt

    if (uploadedFiles.length > 0) {
      messageContent = `${userPrompt}\n\n[Attached ${uploadedFiles.length} image${uploadedFiles.length > 1 ? 's' : ''}]`
    }

    addMessage({
      type: 'user',
      content: messageContent,
    })

    addMessage({
      type: 'assistant',
      content: '',
    })

    try {
      const filesData = uploadedFiles.map(f => ({
        name: f.name || f.file.name,
        type: f.type,
        content: f.content || ''
      }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate',
          prompt: userPrompt,
          domain: currentDomain,
          chatHistory: messages,
          files: filesData,
          selectedAgent: selectedModel
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''
      let buffer = ''
      let currentModelUsed = ''
      let lastChunkTime = Date.now()
      const TIMEOUT_MS = 60000

      if (reader) {
        const readWithTimeout = async () => {
          while (true) {
            let timeoutId: NodeJS.Timeout | null = null
            
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Stream timeout - no data received for 60 seconds')), TIMEOUT_MS)
            })
            
            const readPromise = reader.read()
            
            try {
              const { done, value } = await Promise.race([readPromise, timeoutPromise]) as ReadableStreamReadResult<Uint8Array>
              
              if (timeoutId) clearTimeout(timeoutId)
              
              if (done) break
              lastChunkTime = Date.now()

              const chunk = decoder.decode(value, { stream: true })
              buffer += chunk
              
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim()
                  if (data === '[DONE]') break

                  try {
                    const parsed = JSON.parse(data)
                    
                    if (parsed.modelUsed) {
                      currentModelUsed = parsed.modelUsed
                      console.log(`[AI Model] Using: ${parsed.modelUsed}`)
                      updateLastMessage(accumulatedText, currentModelUsed)
                    }
                    
                    if (parsed.text) {
                      accumulatedText += parsed.text
                      updateLastMessage(accumulatedText, currentModelUsed)
                    }
                  } catch (e) {
                    console.warn('Failed to parse SSE chunk:', data)
                  }
                }
              }
            } catch (error) {
              if (timeoutId) clearTimeout(timeoutId)
              throw error
            }
          }
        }
        
        await readWithTimeout()
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to process request')
      const { messages } = useChatStore.getState()
      if (messages.length >= 2) {
        useChatStore.setState({ 
          messages: messages.slice(0, -2) 
        })
      }
    } finally {
      setIsLoading(false)
      setUploadedFiles([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleStop = () => {
    setIsLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* File Preview */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-3 flex gap-2 flex-wrap"
          >
            {uploadedFiles.map((item, index) => (
              <motion.div
                key={index}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.8 }}
                className="relative group"
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden border-2 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800">
                  <img
                    src={item.preview}
                    alt={`Upload ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg opacity-0 group-hover:opacity-100"
                >
                  <FiX className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1 left-1 right-1 bg-black/50 backdrop-blur-sm text-white text-xs px-1 py-0.5 rounded flex items-center gap-1">
                  <FiImage className="w-3 h-3" />
                  <span className="truncate">{item.file.name.split('.')[0].substring(0, 8)}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="flex items-end gap-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-300 dark:border-gray-700 shadow-lg focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.docx,.doc,.csv,.txt"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="m-2 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Attach image"
        >
          <FiPaperclip className="w-5 h-5" />
        </button>

        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setShowModelSelector(!showModelSelector)}
            className="m-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 border border-transparent hover:border-gray-300 dark:hover:border-gray-600"
            title="Select AI Model"
          >
            {getModelIcon(selectedModel)}
            <span className="hidden sm:inline">{getModelLabel(selectedModel)}</span>
            <FiChevronDown className="w-3.5 h-3.5 opacity-70" />
          </button>

          <AnimatePresence>
            {showModelSelector && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-full mb-2 left-0 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
              >
                <div className="p-2">
                  {(['auto', 'chatgpt-5', 'gemini-2.5-flash', 'gemini-2.5-pro', 'grok-4', 'grok-2-1212', 'grok-vision-beta'] as AIModelSelection[]).map((model) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => handleModelSelect(model)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 ${
                        selectedModel === model
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium shadow-sm'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <span className={selectedModel === model ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}>
                        {getModelIcon(model)}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium">{getModelLabel(model)}</div>
                        {model === 'auto' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Best model for the task</div>
                        )}
                        {model === 'chatgpt-5' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Advanced reasoning</div>
                        )}
                        {model === 'gemini-2.5-flash' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Fast & efficient</div>
                        )}
                        {model === 'gemini-2.5-pro' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Google AI Pro</div>
                        )}
                        {model === 'grok-4' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Most intelligent - xAI</div>
                        )}
                        {model === 'grok-2-1212' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">xAI Grok - 131k context</div>
                        )}
                        {model === 'grok-vision-beta' && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">xAI Grok with vision</div>
                        )}
                      </div>
                      {selectedModel === model && (
                        <div className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400"></div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Devmate..."
          className="flex-1 bg-transparent px-2 py-3 text-gray-900 dark:text-white placeholder-gray-400 resize-none focus:outline-none max-h-48 min-h-[52px]"
          rows={1}
          disabled={isLoading}
        />
        
        <button
          type="submit"
          disabled={(!prompt.trim() && uploadedFiles.length === 0) || isLoading}
          className="m-2 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <FiStopCircle className="w-5 h-5" onClick={handleStop} />
          ) : (
            <FiSend className="w-5 h-5" />
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
        Devmate can make mistakes. Check important info.
      </p>
    </form>
  )
}
