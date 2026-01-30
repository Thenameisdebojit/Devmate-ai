/**
 * Problems Panel Component
 * 
 * Displays compiler diagnostics (errors, warnings, info).
 */

'use client'

import { useState, useEffect } from 'react'
import { FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi'

export interface Problem {
  file: string
  line: number
  column?: number
  severity: 'error' | 'warning' | 'info'
  message: string
  code?: string
  source?: string
}

interface ProblemsPanelProps {
  projectId?: string
  problems: Problem[]
  onProblemClick?: (problem: Problem) => void
}

export default function ProblemsPanel({
  projectId,
  problems,
  onProblemClick,
}: ProblemsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  const filteredProblems = problems.filter((problem) => {
    if (filter === 'all') return true
    return problem.severity === filter
  })

  const errorCount = problems.filter((p) => p.severity === 'error').length
  const warningCount = problems.filter((p) => p.severity === 'warning').length
  const infoCount = problems.filter((p) => p.severity === 'info').length

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <FiAlertCircle className="w-4 h-4 text-red-500" />
      case 'warning':
        return <FiAlertTriangle className="w-4 h-4 text-yellow-500" />
      case 'info':
        return <FiInfo className="w-4 h-4 text-blue-500" />
      default:
        return null
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'text-red-500'
      case 'warning':
        return 'text-yellow-500'
      case 'info':
        return 'text-blue-500'
      default:
        return 'text-gray-500'
    }
  }

  if (!projectId) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>No project selected</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Filter Bar */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-2 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded ${
              filter === 'all'
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            All ({problems.length})
          </button>
          <button
            onClick={() => setFilter('error')}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              filter === 'error'
                ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10'
            }`}
          >
            <FiAlertCircle className="w-3 h-3" />
            Errors ({errorCount})
          </button>
          <button
            onClick={() => setFilter('warning')}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              filter === 'warning'
                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                : 'text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10'
            }`}
          >
            <FiAlertTriangle className="w-3 h-3" />
            Warnings ({warningCount})
          </button>
          <button
            onClick={() => setFilter('info')}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${
              filter === 'info'
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'
            }`}
          >
            <FiInfo className="w-3 h-3" />
            Info ({infoCount})
          </button>
        </div>
      </div>

      {/* Problems List */}
      <div className="flex-1 overflow-y-auto">
        {filteredProblems.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-sm">No {filter === 'all' ? '' : filter} problems found</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredProblems.map((problem, index) => (
              <button
                key={index}
                onClick={() => onProblemClick?.(problem)}
                className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getSeverityIcon(problem.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-sm font-medium ${getSeverityColor(problem.severity)}`}>
                        {problem.message}
                      </span>
                      {problem.code && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {problem.code}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {problem.file && (
                        <span className="font-mono">{problem.file}</span>
                      )}
                      {problem.line > 0 && (
                        <span>
                          {problem.file && ' • '}
                          Line {problem.line}
                          {problem.column && `, Col ${problem.column}`}
                        </span>
                      )}
                      {problem.source && (
                        <span>
                          {' • '}
                          {problem.source}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
