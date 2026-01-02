'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'
import { FiSend, FiZap, FiSettings, FiPaperclip, FiCode } from 'react-icons/fi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

interface PromptInputProps {
  onSend: (prompt: string) => void
  isProcessing?: boolean
  placeholder?: string
}

export default function PromptInput({ onSend, isProcessing = false, placeholder = 'Make lightweight changes, quickly...' }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [prompt])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!prompt.trim() || isProcessing) return

    onSend(prompt.trim())
    setPrompt('')
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Fast mode notification (optional) */}
      <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <FiZap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-700 dark:text-amber-300">Fast mode enabled.</span>
          <a href="#" className="text-amber-600 dark:text-amber-400 hover:underline">
            Upgrade to Core for a smarter Agent
          </a>
        </div>
        <button className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300">
          ×
        </button>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Left action buttons */}
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Build"
          >
            <FiCode className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Attach file"
          >
            <FiPaperclip className="w-4 h-4" />
          </motion.button>
        </div>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isProcessing}
            rows={1}
            className="w-full px-4 py-2.5 pr-12 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: '44px', maxHeight: '200px' }}
          />
        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-1">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Fast mode"
          >
            <FiZap className="w-4 h-4" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Settings"
          >
            <FiSettings className="w-4 h-4" />
          </motion.button>
          <motion.button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isProcessing}
            whileHover={prompt.trim() && !isProcessing ? { scale: 1.05 } : {}}
            whileTap={prompt.trim() && !isProcessing ? { scale: 0.95 } : {}}
            className={`p-2 rounded-lg transition-colors ${
              prompt.trim() && !isProcessing
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
            }`}
            title="Send"
          >
            <FiSend className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}

