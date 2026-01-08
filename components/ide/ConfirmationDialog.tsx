'use client'

/**
 * PHASE 6: Confirmation Dialog for Risky Actions
 * 
 * Shows when agent wants to perform high-risk action with low confidence.
 */

import { FiAlertTriangle, FiX } from 'react-icons/fi'
import type { ConfidenceReport } from '@/core/workspace/AgentConfidenceEngine'

interface ConfirmationDialogProps {
  isOpen: boolean
  title: string
  message: string
  confidenceReport: ConfidenceReport
  onConfirm: () => void
  onCancel: () => void
  actionType?: 'mutate' | 'generate' | 'fix' | 'delete'
}

export default function ConfirmationDialog({
  isOpen,
  title,
  message,
  confidenceReport,
  onConfirm,
  onCancel,
  actionType = 'mutate',
}: ConfirmationDialogProps) {
  if (!isOpen) return null

  const getActionDescription = () => {
    switch (actionType) {
      case 'mutate':
        return 'modify files'
      case 'generate':
        return 'generate new files'
      case 'fix':
        return 'apply fixes'
      case 'delete':
        return 'delete files'
      default:
        return 'perform this action'
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FiAlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {message}
          </p>

          {/* Confidence Info */}
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded">
            <div className="text-xs font-medium text-orange-900 dark:text-orange-200 mb-2">
              Current Confidence: {confidenceReport.confidenceLevel} ({confidenceReport.riskLevel} Risk)
            </div>
            {confidenceReport.reasons.length > 0 && (
              <div className="space-y-1">
                {confidenceReport.reasons.slice(0, 3).map((reason, index) => (
                  <div key={index} className="text-xs text-orange-800 dark:text-orange-300">
                    • {reason}
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-600 dark:text-gray-400">
            The agent wants to {getActionDescription()}, but confidence is {confidenceReport.confidenceLevel.toLowerCase()} 
            {confidenceReport.riskLevel === 'HIGH' && ' with high risk'}.
            {confidenceReport.riskLevel === 'HIGH' && ' Consider reviewing the changes or waiting for more stable signals.'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 dark:bg-orange-600 rounded hover:bg-orange-600 dark:hover:bg-orange-700 transition-colors"
          >
            Proceed Anyway
          </button>
        </div>
      </div>
    </div>
  )
}

