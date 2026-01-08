'use client'

/**
 * PHASE 1: Command-Driven UX (Refactored)
 * 
 * Simplified command bar with natural language input.
 * Removed explicit action buttons - user can describe what they want.
 */

import { useState } from 'react'
import { FiSend, FiImage, FiGlobe, FiAtSign, FiRepeat } from 'react-icons/fi'
import { motion } from 'framer-motion'

export type CommandAction = 'generate' | 'run' | 'fix' | 'explain'

interface IDECommandBarProps {
  onCommand: (action: CommandAction, input?: string) => void
  disabled?: boolean
  isProcessing?: boolean
}

export default function IDECommandBar({
  onCommand,
  disabled = false,
  isProcessing = false,
}: IDECommandBarProps) {
  const [input, setInput] = useState('')
  const [autoMode, setAutoMode] = useState(false)
  const [speed, setSpeed] = useState(1)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || isProcessing || !input.trim()) return

    // Infer action from input - default to generate for natural language
    const lowerInput = input.toLowerCase()
    let action: CommandAction = 'generate'
    
    if (lowerInput.includes('run') || lowerInput.includes('execute') || lowerInput.includes('start')) {
      action = 'run'
    } else if (lowerInput.includes('fix') || lowerInput.includes('error') || lowerInput.includes('bug')) {
      action = 'fix'
    } else if (lowerInput.includes('explain') || lowerInput.includes('what') || lowerInput.includes('how')) {
      action = 'explain'
    } else {
      // Default: generate (build, create, make, etc.)
      action = 'generate'
    }

    onCommand(action, input.trim())
    setInput('')
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Command Input with Features */}
      <form onSubmit={handleSubmit} className="px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Auto Mode Toggle */}
          <button
            type="button"
            onClick={() => setAutoMode(!autoMode)}
            className={`p-1.5 rounded transition-colors ${
              autoMode
                ? 'bg-blue-500 text-white'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
            }`}
            title="Auto mode"
          >
            <FiRepeat className="w-4 h-4" />
          </button>

          {/* Speed Selector */}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            title="Speed"
          >
            <option value={0.5}>0.5x</option>
            <option value={1}>1x</option>
            <option value={1.5}>1.5x</option>
            <option value={2}>2x</option>
          </select>

          {/* Input Field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AI to build, create, or modify..."
            disabled={disabled || isProcessing}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Feature Icons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
              title="Mention (@)"
            >
              <FiAtSign className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
              title="Web search"
            >
              <FiGlobe className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
              title="Image"
            >
              <FiImage className="w-4 h-4" />
            </button>
          </div>

          {/* Send/Execute Button - Compact */}
          <button
            type="submit"
            disabled={disabled || isProcessing || !input.trim()}
            className="px-3 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Send"
          >
            {isProcessing ? (
              <motion.div
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <FiSend className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
