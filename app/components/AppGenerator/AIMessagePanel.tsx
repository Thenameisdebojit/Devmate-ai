'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiLoader, FiCheck, FiAlertCircle, FiCode, FiFile, FiTool, FiSettings, FiHelpCircle } from 'react-icons/fi'

export interface AIMessage {
  id: string
  type: 'thinking' | 'acting' | 'done' | 'error' | 'suggestion'
  content: string
  toolCalls?: ToolCall[]
  fileReferences?: string[]
  timestamp: number
  confidence?: number // 0-100
  progress?: number // 0-100
  category?: string // For suggestions: 'build-fix', etc.
  errorDetails?: {
    type: string
    explanation: string
    suggestion?: string
    canAutoFix?: boolean
  }
  followUp?: {
    question: string
    actions: Array<{ label: string; action: string }>
  }
  plan?: any // AgentPlan for plan preview
}

export interface ToolCall {
  id: string
  name: string
  parameters: Record<string, any>
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result?: string
}

interface AIMessagePanelProps {
  messages: AIMessage[]
  isStreaming?: boolean
  onFileClick?: (path: string) => void
  onFollowUpAction?: (action: string, messageId: string) => void
  onFixAction?: (messageId: string) => void
  onPlanApproved?: (planId: string) => void
  onStepApproved?: (planId: string, stepId: string) => void
  onStepRollback?: (planId: string, stepId: string) => void
  onPlanRollback?: (planId: string) => void
}

export default function AIMessagePanel({ messages, isStreaming, onFileClick, onFollowUpAction, onFixAction, onPlanApproved, onStepApproved, onStepRollback, onPlanRollback }: AIMessagePanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getStatusIcon = (type: AIMessage['type']) => {
    switch (type) {
      case 'thinking':
        return <FiLoader className="w-4 h-4 animate-spin text-blue-500" />
      case 'acting':
        return <FiTool className="w-4 h-4 text-purple-500 animate-pulse" />
      case 'done':
        return <FiCheck className="w-4 h-4 text-green-500" />
      case 'error':
        return <FiAlertCircle className="w-4 h-4 text-red-500" />
      case 'suggestion':
        return <FiHelpCircle className="w-4 h-4 text-amber-500" />
    }
  }

  const getStatusColor = (type: AIMessage['type']) => {
    switch (type) {
      case 'thinking':
        return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
      case 'acting':
        return 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800'
      case 'done':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      case 'suggestion':
        return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 border-dashed'
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Agent</h3>
        {isStreaming && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <FiLoader className="w-3 h-3 animate-spin" />
            Streaming...
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <AnimatePresence>
          {messages.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
              AI agent messages will appear here
            </div>
          ) : (
            messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`p-3 rounded-lg border ${getStatusColor(message.type)}`}
              >
                {/* Status Header */}
                <div className="flex items-center gap-2 mb-2">
                  {getStatusIcon(message.type)}
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {message.type}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                {/* Progress Indicator */}
                {message.progress !== undefined && message.progress < 100 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">Progress</span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{message.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <motion.div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${message.progress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {/* Confidence Indicator */}
                {message.confidence !== undefined && (
                  <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Confidence:</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          message.confidence >= 80
                            ? 'bg-green-500'
                            : message.confidence >= 60
                            ? 'bg-yellow-500'
                            : 'bg-orange-500'
                        }`}
                        style={{ width: `${message.confidence}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{message.confidence}%</span>
                  </div>
                )}

                {/* Content */}
                {message.content && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 whitespace-pre-wrap">
                    {message.content}
                  </div>
                )}

                {/* Fix it button for suggestions */}
                {message.type === 'suggestion' && message.category === 'build-fix' && !message.plan && onFixAction && (
                  <div className="mt-3">
                    <button
                      onClick={() => onFixAction(message.id)}
                      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                    >
                      <FiSettings className="w-3 h-3" />
                      Fix it
                    </button>
                  </div>
                )}

                {/* Plan preview and approval */}
                {message.plan && (
                  <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="mb-3">
                      <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-1">
                        {message.plan.title}
                      </h4>
                      <p className="text-xs text-blue-600 dark:text-blue-300 mb-3">
                        {message.plan.summary}
                      </p>
                      <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2">
                        ⚠️ No changes will be made until you approve.
                      </div>
                    </div>

                    {/* Plan steps */}
                    <div className="space-y-2 mb-3">
                      {message.plan.steps.map((step: any, index: number) => (
                        <div
                          key={step.stepId}
                          className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                              {index + 1}.
                            </span>
                            <div className="flex-1">
                              <div className="text-xs text-gray-700 dark:text-gray-300">
                                {step.description}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span
                                  className={`text-xs px-1.5 py-0.5 rounded ${
                                    step.status === 'completed'
                                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                      : step.status === 'approved'
                                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                      : step.status === 'executing'
                                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                      : step.status === 'rolled_back'
                                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  {step.status}
                                </span>
                                {step.status === 'completed' && step.checkpointId && onStepRollback && (
                                  <button
                                    onClick={() => onStepRollback(message.plan.planId, step.stepId)}
                                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                                  >
                                    Rollback
                                  </button>
                                )}
                                {step.status === 'pending' && message.plan.status === 'approved' && onStepApproved && (
                                  <button
                                    onClick={() => onStepApproved(message.plan.planId, step.stepId)}
                                    className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                  >
                                    Approve Step
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Plan actions */}
                    <div className="flex items-center gap-2">
                      {message.plan.status === 'proposed' && onPlanApproved && (
                        <button
                          onClick={() => onPlanApproved(message.plan.planId)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                        >
                          <FiCheck className="w-3 h-3" />
                          Approve Plan
                        </button>
                      )}
                      {message.plan.status === 'approved' && message.plan.steps.some((s: any) => s.status === 'completed') && onPlanRollback && (
                        <button
                          onClick={() => onPlanRollback(message.plan.planId)}
                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                        >
                          Rollback Plan
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Error Details with Explanation */}
                {message.errorDetails && (
                  <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <FiAlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-red-700 dark:text-red-400 mb-1">
                          {message.errorDetails.type}
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-300 mb-2">
                          {message.errorDetails.explanation}
                        </div>
                        {message.errorDetails.suggestion && (
                          <div className="text-xs text-red-500 dark:text-red-400 italic">
                            💡 {message.errorDetails.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                    {message.errorDetails.canAutoFix && (
                      <button
                        onClick={() => onFollowUpAction?.('auto-fix', message.id)}
                        className="mt-2 flex items-center gap-1 px-2 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        <FiSettings className="w-3 h-3" />
                        Auto-fix this error
                      </button>
                    )}
                  </div>
                )}

                {/* Smart Follow-up */}
                {message.followUp && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-2 mb-2">
                      <FiHelpCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                          {message.followUp.question}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {message.followUp.actions.map((action, idx) => (
                            <button
                              key={idx}
                              onClick={() => onFollowUpAction?.(action.action, message.id)}
                              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            >
                              {action.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tool Calls */}
                {message.toolCalls && message.toolCalls.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.toolCalls.map((toolCall) => (
                      <div
                        key={toolCall.id}
                        className="p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FiTool className="w-3 h-3 text-purple-500" />
                          <span className="text-xs font-mono font-medium text-gray-700 dark:text-gray-300">
                            {toolCall.name}
                          </span>
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              toolCall.status === 'completed'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : toolCall.status === 'failed'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                : toolCall.status === 'executing'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                            }`}
                          >
                            {toolCall.status}
                          </span>
                        </div>
                        {toolCall.parameters && Object.keys(toolCall.parameters).length > 0 && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-mono mt-1">
                            {JSON.stringify(toolCall.parameters, null, 2)}
                          </div>
                        )}
                        {toolCall.result && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 p-1 bg-gray-50 dark:bg-gray-900 rounded">
                            {toolCall.result}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* File References */}
                {message.fileReferences && message.fileReferences.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.fileReferences.map((filePath) => (
                      <button
                        key={filePath}
                        onClick={() => onFileClick?.(filePath)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                      >
                        <FiFile className="w-3 h-3" />
                        {filePath}
                      </button>
                    ))}
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}

