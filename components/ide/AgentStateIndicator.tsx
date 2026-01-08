'use client'

/**
 * PHASE 7: Agent State Indicator
 * 
 * Shows agent state: Thinking → Acting → Done
 * Fluid, professional, Replit-level polish.
 */

import { motion, AnimatePresence } from 'framer-motion'
import { FiLoader, FiTool, FiCheck, FiAlertCircle } from 'react-icons/fi'

type AgentState = 'idle' | 'thinking' | 'acting' | 'done' | 'error'

interface AgentStateIndicatorProps {
  state: AgentState
  message?: string
  className?: string
}

export default function AgentStateIndicator({ 
  state, 
  message,
  className 
}: AgentStateIndicatorProps) {
  const getStateConfig = () => {
    switch (state) {
      case 'thinking':
        return {
          icon: FiLoader,
          color: 'text-blue-500 dark:text-blue-400',
          bgColor: 'bg-blue-50 dark:bg-blue-900/20',
          borderColor: 'border-blue-200 dark:border-blue-800',
          label: 'Thinking',
          animate: true,
        }
      case 'acting':
        return {
          icon: FiTool,
          color: 'text-purple-500 dark:text-purple-400',
          bgColor: 'bg-purple-50 dark:bg-purple-900/20',
          borderColor: 'border-purple-200 dark:border-purple-800',
          label: 'Acting',
          animate: true,
        }
      case 'done':
        return {
          icon: FiCheck,
          color: 'text-green-500 dark:text-green-400',
          bgColor: 'bg-green-50 dark:bg-green-900/20',
          borderColor: 'border-green-200 dark:border-green-800',
          label: 'Done',
          animate: false,
        }
      case 'error':
        return {
          icon: FiAlertCircle,
          color: 'text-red-500 dark:text-red-400',
          bgColor: 'bg-red-50 dark:bg-red-900/20',
          borderColor: 'border-red-200 dark:border-red-800',
          label: 'Error',
          animate: false,
        }
      default:
        return null
    }
  }

  const config = getStateConfig()
  if (!config) return null

  const Icon = config.icon

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 4 }}
        transition={{ duration: 0.2 }}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}
      >
        <motion.div
          animate={config.animate ? { rotate: 360 } : {}}
          transition={config.animate ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <Icon className={`w-4 h-4 ${config.color}`} />
        </motion.div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium ${config.color}`}>
            {config.label}
          </span>
          {message && (
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
              {message}
            </span>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}


