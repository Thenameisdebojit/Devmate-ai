'use client'

/**
 * PHASE 7: Quick Actions Component
 * 
 * Context-aware quick actions based on current state.
 */

import { motion } from 'framer-motion'
import { FiZap, FiWand2, FiPlay, FiRefreshCw } from 'react-icons/fi'

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  variant?: 'primary' | 'secondary'
}

interface QuickActionsProps {
  actions: QuickAction[]
  className?: string
}

export default function QuickActions({ actions, className }: QuickActionsProps) {
  if (actions.length === 0) return null

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {actions.map((action) => {
        const Icon = action.icon
        return (
          <motion.button
            key={action.id}
            onClick={action.action}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              action.variant === 'primary'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{action.label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

