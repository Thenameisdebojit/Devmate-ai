'use client'

import { useState, KeyboardEvent } from 'react'
import { FiCode, FiPlay, FiAlertCircle, FiBook, FiZap, FiSearch } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

export type CommandAction = 'generate' | 'run' | 'fix-errors' | 'explain' | 'optimize'

interface CommandBarProps {
  onCommand: (action: CommandAction, prompt?: string) => void
  isProcessing?: boolean
}

const commands: Array<{ id: CommandAction; label: string; icon: React.ReactNode; description: string }> = [
  {
    id: 'generate',
    label: 'Generate App',
    icon: <FiCode className="w-4 h-4" />,
    description: 'Generate a new application from description',
  },
  {
    id: 'run',
    label: 'Run',
    icon: <FiPlay className="w-4 h-4" />,
    description: 'Run the current project',
  },
  {
    id: 'fix-errors',
    label: 'Fix Errors',
    icon: <FiAlertCircle className="w-4 h-4" />,
    description: 'Automatically fix errors in the codebase',
  },
  {
    id: 'explain',
    label: 'Explain Architecture',
    icon: <FiBook className="w-4 h-4" />,
    description: 'Get explanation of the project architecture',
  },
  {
    id: 'optimize',
    label: 'Optimize',
    icon: <FiZap className="w-4 h-4" />,
    description: 'Optimize code performance and structure',
  },
]

export default function CommandBar({ onCommand, isProcessing }: CommandBarProps) {
  const [showCommands, setShowCommands] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const filteredCommands = commands.filter((cmd) =>
    cmd.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cmd.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowCommands(false)
      setSearchQuery('')
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault()
      handleCommandSelect(filteredCommands[selectedIndex].id)
    }
  }

  const handleCommandSelect = (action: CommandAction) => {
    if (action === 'generate') {
      // For generate, show a prompt input
      const userPrompt = window.prompt('Describe the app you want to generate:')
      if (userPrompt) {
        onCommand(action, userPrompt)
      }
    } else {
      onCommand(action)
    }
    setShowCommands(false)
    setSearchQuery('')
    setSelectedIndex(0)
  }

  return (
    <div className="relative border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Command Buttons */}
        <div className="flex items-center gap-1 flex-1">
          {commands.map((cmd) => (
            <motion.button
              key={cmd.id}
              onClick={() => handleCommandSelect(cmd.id)}
              disabled={isProcessing}
              whileHover={!isProcessing ? { scale: 1.05 } : {}}
              whileTap={!isProcessing ? { scale: 0.95 } : {}}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                isProcessing
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              {cmd.icon}
              <span className="hidden sm:inline">{cmd.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Command Palette Trigger */}
        <button
          onClick={() => setShowCommands(!showCommands)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
        >
          <FiSearch className="w-4 h-4" />
          <span className="hidden sm:inline">Commands</span>
          <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Command Palette */}
      <AnimatePresence>
        {showCommands && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/20"
              onClick={() => setShowCommands(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-full left-0 right-0 mb-2 mx-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl max-h-96 overflow-hidden"
            >
              {/* Search Input */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <FiSearch className="w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setSelectedIndex(0)
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search commands..."
                    className="flex-1 bg-transparent border-none outline-none text-sm text-gray-700 dark:text-gray-300"
                    autoFocus
                  />
                </div>
              </div>

              {/* Command List */}
              <div className="max-h-64 overflow-y-auto p-2">
                {filteredCommands.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No commands found
                  </div>
                ) : (
                  filteredCommands.map((cmd, index) => (
                    <button
                      key={cmd.id}
                      onClick={() => handleCommandSelect(cmd.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        index === selectedIndex
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="text-gray-500 dark:text-gray-400">{cmd.icon}</div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{cmd.label}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{cmd.description}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

