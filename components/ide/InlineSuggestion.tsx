'use client'

/**
 * PHASE 7: Inline Suggestion Component
 * 
 * Context-aware quick actions: "Want me to fix this?"
 */

import { motion } from 'framer-motion'
import { FiZap, FiX } from 'react-icons/fi'

interface InlineSuggestionProps {
  message: string
  action: string
  onAccept: () => void
  onDismiss: () => void
  type?: 'fix' | 'optimize' | 'explain' | 'refactor'
}

export default function InlineSuggestion({
  message,
  action,
  onAccept,
  onDismiss,
  type = 'fix',
}: InlineSuggestionProps) {
  const getTypeColor = () => {
    switch (type) {
      case 'fix':
        return 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300'
      case 'optimize':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
      case 'explain':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300'
      case 'refactor':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`p-3 rounded-lg border ${getTypeColor()} shadow-sm`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <FiZap className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium mb-1">{message}</p>
            <button
              onClick={onAccept}
              className="text-xs font-medium hover:underline"
            >
              {action}
            </button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
        >
          <FiX className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  )
}


