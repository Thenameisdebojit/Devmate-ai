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
  workspaceStage?: 'empty' | 'bootstrapped' | 'generated' | 'running' | 'error' // PHASE D: Workspace stage
  fileCount?: number // PHASE D: File count for context
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
  workspaceStage = 'empty',
  fileCount = 0,
}: IDEChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCommand = async (action: CommandAction, input?: string, context?: { type: string; data: any }) => {
    if (disabled || isProcessing) return

    try {
      // Import IntentBuilder dynamically to avoid circular deps
      const { IntentBuilder } = await import('@/lib/ide/IntentBuilder')
      
      // Ensure input is valid - use default if empty
      let inputValue = input?.trim() || ''
      
      // Handle context - append context info to input (but keep context data separate)
      if (context) {
        if (context.type === 'image') {
          // Add image reference to description, but context.data contains actual base64
          inputValue = `${inputValue} [Image: ${context.data.filename}]`.trim()
        } else if (context.type === 'web') {
          inputValue = `${inputValue} [Web Search Enabled]`
        } else if (context.type === 'browser') {
          inputValue = `${inputValue} [Browser Connected]`
        }
      }
      
      // If no input and action is generate, use a default description
      const finalInput = inputValue || (action === 'generate' ? 'Create a new project' : '')
      
      // Build intent - IntentBuilder handles empty descriptions
      const intent = IntentBuilder.build(action, finalInput)
      
      // Attach context to intent (contains actual image data, not just filename)
      if (context) {
        (intent as any).context = context
      }
      
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

      // Attach context to intent if provided
      const intentWithContext = context ? { ...intent, context } : intent
      onCommand(intentWithContext as any)
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
      {/* PHASE D: Always show agent state, even when idle (feels intentional) */}
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <AgentStateIndicator 
          state={agentState} 
          message={agentMessage || (agentState === 'idle' ? 'Ready' : undefined)} 
        />
      </div>

      {/* Chat Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AIMessagePanel
          messages={messages}
          confidenceReport={confidenceReport}
          onPlanApproved={onPlanApproved}
          onStepApproved={onStepApproved}
          onPlanConfirmed={(messageId) => {
            // PHASE F-3: Handle plan confirmation - emit event to continue execution
            const message = messages.find(m => m.id === messageId)
            if (message?.metadata?.planType) {
              // Emit confirmation event to backend
              // This will be handled by AgentExecutionRouter to continue execution
              window.dispatchEvent(new CustomEvent('plan-confirmed', { 
                detail: { messageId, planType: message.metadata.planType } 
              }))
            }
          }}
          onPlanCancelled={(messageId) => {
            // PHASE F-3: Handle plan cancellation
            window.dispatchEvent(new CustomEvent('plan-cancelled', { 
              detail: { messageId } 
            }))
          }}
        />
        
        {/* PHASE D: "What Next?" Suggestions (non-AI, UI hints) */}
        {messages.length === 0 && agentState === 'idle' && (
          <div className="p-4 space-y-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What would you like to do?
            </div>
            {workspaceStage === 'empty' && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                💡 Describe what you want to build, e.g., "create a calculator app" or "build a todo list"
              </div>
            )}
            {workspaceStage === 'bootstrapped' && (
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>💡 Click Run to preview your app</div>
                <div>💡 Ask me to add features, e.g., "add a login page"</div>
                <div>💡 Select a file to edit</div>
              </div>
            )}
            {workspaceStage === 'generated' && (
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>💡 Click Run to preview your app</div>
                <div>💡 Ask me to modify features, e.g., "add authentication"</div>
                <div>💡 Select a file to edit</div>
              </div>
            )}
            {workspaceStage === 'running' && (
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <div>💡 Your app is running! Preview is available</div>
                <div>💡 Ask me to add or modify features</div>
                <div>💡 Select a file to edit</div>
              </div>
            )}
          </div>
        )}
        
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

