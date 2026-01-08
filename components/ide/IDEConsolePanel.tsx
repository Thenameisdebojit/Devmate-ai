'use client'

/**
 * PHASE 5: Console Panel
 * 
 * Shows build errors and runtime logs.
 * Clicking errors opens file + line.
 */

import { useState, useEffect, useRef } from 'react'
import { FiAlertCircle, FiXCircle, FiFile, FiChevronRight, FiWand2 } from 'react-icons/fi'
import InlineSuggestion from './InlineSuggestion'

interface BuildError {
  file: string
  line: number
  message: string
}

interface IDEConsolePanelProps {
  projectId?: string
  buildErrors?: BuildError[]
  onErrorClick?: (file: string, line: number) => void
  runtimeState?: any
}

export default function IDEConsolePanel({
  projectId,
  buildErrors = [],
  onErrorClick,
  runtimeState,
}: IDEConsolePanelProps) {
  const [logs, setLogs] = useState<Array<{ type: 'info' | 'error' | 'warn'; message: string; timestamp: number }>>([])
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Listen for runtime logs (if needed)
  useEffect(() => {
    // TODO: Connect to runtime log stream
  }, [projectId])

  const handleErrorClick = (error: BuildError) => {
    if (onErrorClick) {
      onErrorClick(error.file, error.line)
    }
  }

  // PHASE 7: Handle inline fix suggestion
  const handleFixSuggestion = (error: BuildError) => {
    // Dispatch fix intent
    window.dispatchEvent(new CustomEvent('agent-fix-error', {
      detail: { file: error.file, line: error.line, message: error.message },
    }))
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Console Header */}
      <div className="h-8 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Console
          </span>
          {buildErrors.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500 text-white rounded">
              {buildErrors.length} error{buildErrors.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Console Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Build Errors */}
        {buildErrors.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Build Errors
            </div>
            {buildErrors.map((error, index) => (
              <div key={index} className="space-y-2">
                <div
                  onClick={() => handleErrorClick(error)}
                  className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <div className="flex items-start gap-2">
                    <FiXCircle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <FiFile className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {error.file}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Line {error.line}
                        </span>
                        <FiChevronRight className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {error.message}
                      </p>
                    </div>
                  </div>
                </div>
                {/* PHASE 7: Inline fix suggestion */}
                <InlineSuggestion
                  message="Want me to fix this error?"
                  action="Fix automatically"
                  type="fix"
                  onAccept={() => handleFixSuggestion(error)}
                  onDismiss={() => {}}
                />
              </div>
            ))}
          </div>
        )}

        {/* Runtime Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Runtime Logs
            </div>
            {logs.map((log, index) => (
              <div
                key={index}
                className={`p-2 rounded text-xs font-mono ${
                  log.type === 'error'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                    : log.type === 'warn'
                    ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="text-gray-500 dark:text-gray-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                {' '}
                {log.message}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {buildErrors.length === 0 && logs.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <FiAlertCircle className="w-8 h-8 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No errors or logs
              </p>
            </div>
          </div>
        )}

        <div ref={logsEndRef} />
      </div>
    </div>
  )
}

