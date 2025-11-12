'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiChevronDown, FiCpu, FiZap, FiStar } from 'react-icons/fi'

export type AIModelOption = 'auto' | 'openai:gpt-5' | 'google:gemini-2.5-pro' | 'google:gemini-2.5-flash' | 'xai:grok-4' | 'xai:grok-2-1212'

interface AIModelSelectorProps {
  selectedModel: AIModelOption
  onModelChange: (model: AIModelOption) => void
}

const models = [
  { 
    value: 'auto', 
    label: 'Auto (Smart Routing)', 
    description: 'Automatically selects the best model for your task',
    icon: FiZap,
    color: 'from-purple-500 to-pink-500'
  },
  { 
    value: 'openai:gpt-5', 
    label: 'GPT-5', 
    description: 'Best for complex code generation and architecture',
    icon: FiStar,
    color: 'from-green-500 to-teal-500'
  },
  { 
    value: 'google:gemini-2.5-pro', 
    label: 'Gemini 2.5 Pro', 
    description: 'Excellent for reasoning and analysis',
    icon: FiCpu,
    color: 'from-blue-500 to-indigo-500'
  },
  { 
    value: 'google:gemini-2.5-flash', 
    label: 'Gemini 2.5 Flash', 
    description: 'Fast responses for simple tasks',
    icon: FiZap,
    color: 'from-yellow-500 to-orange-500'
  },
  { 
    value: 'xai:grok-4', 
    label: 'Grok 4', 
    description: 'Latest xAI model with strong reasoning',
    icon: FiStar,
    color: 'from-red-500 to-pink-500'
  },
  { 
    value: 'xai:grok-2-1212', 
    label: 'Grok 2', 
    description: '131k context window for large projects',
    icon: FiCpu,
    color: 'from-cyan-500 to-blue-500'
  },
]

export default function AIModelSelector({ selectedModel, onModelChange }: AIModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  const selected = models.find(m => m.value === selectedModel) || models[0]

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-3 bg-gray-800/50 dark:bg-gray-800/50 hover:bg-gray-700/50 dark:hover:bg-gray-700/50 border border-gray-700 dark:border-gray-700 rounded-lg transition-all w-full md:w-auto"
      >
        <selected.icon className={`text-lg bg-gradient-to-r ${selected.color} bg-clip-text text-transparent`} />
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{selected.label}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">AI Model</span>
        </div>
        <FiChevronDown className={`text-gray-400 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full mt-2 left-0 right-0 md:w-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-20 overflow-hidden"
            >
              <div className="p-2 max-h-96 overflow-y-auto">
                {models.map((model) => (
                  <button
                    key={model.value}
                    onClick={() => {
                      onModelChange(model.value as AIModelOption)
                      setIsOpen(false)
                    }}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedModel === model.value
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <model.icon className={`text-xl mt-0.5 bg-gradient-to-r ${model.color} bg-clip-text text-transparent flex-shrink-0`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                          {model.label}
                          {selectedModel === model.value && (
                            <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">
                              Selected
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {model.description}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
