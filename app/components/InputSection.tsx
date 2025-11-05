'use client'

import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../store/useChatStore'
import toast from 'react-hot-toast'
import { FiSend, FiStopCircle, FiPaperclip, FiX, FiImage } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

interface InputSectionProps {
  onNewChat: () => void
}

interface UploadedFile {
  file: File
  preview: string
  type: string
}

export default function InputSection({ onNewChat }: InputSectionProps) {
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { addMessage, updateLastMessage, currentDomain, messages } = useChatStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [prompt])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          setUploadedFiles(prev => [...prev, {
            file,
            preview: e.target?.result as string,
            type: file.type
          }])
        }
        reader.readAsDataURL(file)
      } else {
        toast.error('Only image files are supported')
      }
    })
    
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
      const formData = new FormData()
      formData.append('action', 'generate')
      formData.append('prompt', userPrompt)
      formData.append('domain', currentDomain)
      formData.append('chatHistory', JSON.stringify(messages))
      
      uploadedFiles.forEach((item, index) => {
        formData.append(`file_${index}`, item.file)
      })

      const response = await fetch('/api/chat', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to get response')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulatedText += parsed.text
                  updateLastMessage(accumulatedText)
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
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
          accept="image/*"
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
