/**
 * Agent Presence Indicator
 * 
 * Shows subtle agent state without being intrusive.
 * Replit-style presence indicator.
 */

'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiCircle, FiZap, FiEye } from 'react-icons/fi'
import { getResidentAgent, type AgentState } from '@/lib/workspace'
import { getWorkspaceDaemon, type IntentScore } from '@/lib/workspace'

interface AgentPresenceProps {
  projectId?: string
}

export default function AgentPresence({ projectId }: AgentPresenceProps) {
  const [agentState, setAgentState] = useState<AgentState>('watching')
  const [intentScore, setIntentScore] = useState<IntentScore | null>(null)
  const [suggestions, setSuggestions] = useState<number>(0)

  useEffect(() => {
    if (!projectId) return

    const agent = getResidentAgent(projectId)
    const daemon = getWorkspaceDaemon(projectId)

    // Update state periodically
    const interval = setInterval(() => {
      setAgentState(agent.getState())
      setIntentScore(daemon.getIntentScore())
      setSuggestions(agent.getSuggestions().length)
    }, 500)

    // Subscribe to agent state changes
    const unsubscribe = daemon.subscribe('AGENT_SUGGESTION', () => {
      setSuggestions(agent.getSuggestions().length)
    })

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [projectId])

  if (!projectId) return null

  const getStateColor = () => {
    switch (agentState) {
      case 'watching':
        return 'text-gray-400'
      case 'ready':
        return 'text-green-400'
      case 'thinking':
        return 'text-blue-400'
      case 'acting':
        return 'text-purple-400'
      default:
        return 'text-gray-400'
    }
  }

  const getStateLabel = () => {
    switch (agentState) {
      case 'watching':
        return 'Watching'
      case 'ready':
        return 'Ready'
      case 'thinking':
        return 'Thinking'
      case 'acting':
        return 'Acting'
      default:
        return 'Watching'
    }
  }

  const getPrimaryIntent = () => {
    if (!intentScore) return null
    
    const intents = Object.entries(intentScore) as Array<[keyof IntentScore, number]>
    const sorted = intents.sort((a, b) => b[1] - a[1])
    const topIntent = sorted[0]
    
    if (topIntent[1] > 0.5) {
      return topIntent[0]
    }
    return null
  }

  const primaryIntent = getPrimaryIntent()

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="fixed bottom-20 right-4 z-50"
      >
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            <motion.div
              animate={
                agentState === 'thinking' || agentState === 'acting'
                  ? { scale: [1, 1.2, 1] }
                  : {}
              }
              transition={{ duration: 1, repeat: Infinity }}
            >
              <FiCircle className={`w-2 h-2 ${getStateColor()}`} fill="currentColor" />
            </motion.div>
            <span className="text-xs text-gray-600 dark:text-gray-400">{getStateLabel()}</span>
          </div>

          {/* Intent Indicator */}
          {primaryIntent && (
            <div className="flex items-center gap-1 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
              {primaryIntent === 'debugging' && <FiZap className="w-3 h-3" />}
              {primaryIntent === 'learning' && <FiEye className="w-3 h-3" />}
              <span className="capitalize">{primaryIntent}</span>
            </div>
          )}

          {/* Suggestions Badge */}
          {suggestions > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center justify-center w-5 h-5 bg-indigo-500 text-white text-xs rounded-full"
            >
              {suggestions}
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

