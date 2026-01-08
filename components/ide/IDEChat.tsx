'use client'

/**
 * PHASE 1: Command-Driven Chat
 * 
 * Refactored to use CommandBar instead of free-form input.
 * Messages are session-scoped (projectId + domain).
 */

import { useState, useRef, useEffect } from 'react'
import AIMessagePanel from '@/app/components/AppGenerator/AIMessagePanel'
import IDECommandBar, { type CommandAction } from './IDECommandBar'
import ConfidenceIndicator from './ConfidenceIndicator'
import AgentStateIndicator from './AgentStateIndicator'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'
import type { ConfidenceReport } from '@/core/workspace/AgentConfidenceEngine'

interface IDEChatProps {
  messages: any[]
  confidenceReport?: ConfidenceReport // PHASE 6: Typed confidence report
  onCommand: (intent: ExecutionIntent) => void // Changed from onSend to onCommand
  onPlanApproved?: (planId: string) => void
  onStepApproved?: (planId: string, stepId: string) => void
  className?: string
  disabled?: boolean
  isProcessing?: boolean
  agentState?: 'idle' | 'thinking' | 'acting' | 'done' | 'error' // PHASE 7: Agent state
  agentMessage?: string // PHASE 7: Current agent action message
}

export default function IDEChat({
  messages,
  confidenceReport,
  onCommand,
  onPlanApproved,
  onStepApproved,
  className,
  disabled = false,
  isProcessing = false,
  agentState = 'idle',
  agentMessage,
}: IDEChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCommand = async (action: CommandAction, input?: string) => {
    if (disabled || isProcessing) return

    try {
      // Import IntentBuilder dynamically to avoid circular deps
      const { IntentBuilder } = await import('@/lib/ide/IntentBuilder')
      
      // Ensure input is valid - use default if empty
      const inputValue = input?.trim() || ''
      
      // Build intent - IntentBuilder handles empty descriptions
      const intent = IntentBuilder.build(action, inputValue)
      const validation = IntentBuilder.validate(intent)

      if (!validation.valid) {
        console.error('Invalid intent:', validation.error)
        // Show error to user
        onCommand({
          type: 'explain',
          description: `Invalid command: ${validation.error}. Please try again with a valid action.`,
        } as any)
        return
      }

      onCommand(intent)
    } catch (error) {
      console.error('Failed to build intent:', error)
      // Show error to user
      onCommand({
        type: 'explain',
        description: `Failed to process command: ${error instanceof Error ? error.message : 'Unknown error'}`,
      } as any)
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* PHASE 6: Confidence Indicator */}
      {confidenceReport && (
        <div className="p-2 border-b border-gray-200 dark:border-gray-800">
          <ConfidenceIndicator report={confidenceReport} />
        </div>
      )}

      {/* PHASE 7: Agent State Indicator */}
      {(agentState !== 'idle' || agentMessage) && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
          <AgentStateIndicator state={agentState} message={agentMessage} />
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AIMessagePanel
          messages={messages}
          confidenceReport={confidenceReport}
          onPlanApproved={onPlanApproved}
          onStepApproved={onStepApproved}
        />
        <div ref={messagesEndRef} />
      </div>

      {/* Command Bar (replaces free-form input) */}
      <IDECommandBar
        onCommand={handleCommand}
        disabled={disabled}
        isProcessing={isProcessing}
      />
    </div>
  )
}

