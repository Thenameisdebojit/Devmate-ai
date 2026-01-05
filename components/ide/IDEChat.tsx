'use client'

import { useState, useRef, useEffect } from 'react'
import AIMessagePanel from '@/app/components/AppGenerator/AIMessagePanel'

interface IDEChatProps {
  messages: any[]
  confidenceReport?: any
  onSend: (prompt: string) => void
  onPlanApproved?: (planId: string) => void
  onStepApproved?: (planId: string, stepId: string) => void
  className?: string
  disabled?: boolean // TASK 2: Disable until workspace initialized
}

export default function IDEChat({
  messages,
  confidenceReport,
  onSend,
  onPlanApproved,
  onStepApproved,
  className,
  disabled = false, // TASK 2: Disable until workspace initialized
}: IDEChatProps) {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Chat Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AIMessagePanel
          messages={messages}
          confidenceReport={confidenceReport}
          onPlanApproved={onPlanApproved}
          onStepApproved={onStepApproved}
        />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={disabled ? "Initializing workspace..." : "Ask AI to make changes..."}
            disabled={disabled}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={disabled}
            className="px-4 py-2 text-sm font-medium bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

