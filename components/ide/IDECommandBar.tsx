'use client'

/**
 * PHASE 1: Command-Driven UX
 * 
 * Bottom command bar that replaces free-form chat with explicit actions.
 * Each action maps to an ExecutionIntent.
 */

import { useState } from 'react'
import { FiPlay, FiCode, FiAlertCircle, FiHelpCircle, FiZap } from 'react-icons/fi'
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
  const [selectedAction, setSelectedAction] = useState<CommandAction | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || isProcessing) return

    // PHASE -1: Validate input based on action
    const action = selectedAction || 'generate' // Default to generate
    
    // For generate, input is optional (will use default description)
    // For other actions, input can be empty (will use defaults)
    const inputValue = input.trim()
    
    // Allow any input - IntentBuilder will handle it
    // Even short inputs like "hi" will be processed (might become explain intent)
    onCommand(action, inputValue || undefined)
    setInput('')
    setSelectedAction(null)
  }

  const handleQuickAction = (action: CommandAction) => {
    if (disabled || isProcessing) return
    onCommand(action)
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => handleQuickAction('generate')}
          disabled={disabled || isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Generate code (Ctrl+G)"
        >
          <FiZap className="w-3 h-3" />
          Generate
        </button>
        <button
          onClick={() => handleQuickAction('run')}
          disabled={disabled || isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Run project (Ctrl+R)"
        >
          <FiPlay className="w-3 h-3" />
          Run
        </button>
        <button
          onClick={() => handleQuickAction('fix')}
          disabled={disabled || isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-orange-500 text-white rounded hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Fix errors (Ctrl+F)"
        >
          <FiAlertCircle className="w-3 h-3" />
          Fix Errors
        </button>
        <button
          onClick={() => handleQuickAction('explain')}
          disabled={disabled || isProcessing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-purple-500 text-white rounded hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Explain code (Ctrl+E)"
        >
          <FiHelpCircle className="w-3 h-3" />
          Explain
        </button>
      </div>

      {/* Command Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3">
        <div className="flex items-center gap-2">
          {/* Action Selector */}
          <select
            value={selectedAction || 'generate'}
            onChange={(e) => setSelectedAction(e.target.value as CommandAction)}
            disabled={disabled || isProcessing}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="generate">Generate</option>
            <option value="run">Run</option>
            <option value="fix">Fix</option>
            <option value="explain">Explain</option>
          </select>

          {/* Input Field */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              disabled
                ? 'Initializing workspace...'
                : selectedAction === 'generate'
                ? 'Describe what to generate (optional - will create starter project if empty)...'
                : selectedAction === 'run'
                ? 'Run command or leave empty to run project...'
                : selectedAction === 'fix'
                ? 'Describe errors to fix or leave empty to auto-detect...'
                : 'Ask about code...'
            }
            disabled={disabled || isProcessing}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Submit Button */}
          <button
            type="submit"
            disabled={disabled || isProcessing}
            className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <motion.div
                  className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                Processing...
              </>
            ) : (
              'Execute'
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

