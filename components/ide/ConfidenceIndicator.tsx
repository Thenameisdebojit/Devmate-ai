'use client'

/**
 * PHASE 6: Confidence Indicator Component
 * 
 * Displays agent confidence status with reasons.
 * Transparent, calm, non-alarming.
 */

import { FiAlertCircle, FiCheckCircle, FiInfo } from 'react-icons/fi'
import type { ConfidenceReport } from '@/core/workspace/AgentConfidenceEngine'

interface ConfidenceIndicatorProps {
  report: ConfidenceReport
  className?: string
}

export default function ConfidenceIndicator({ report, className }: ConfidenceIndicatorProps) {
  const getConfidenceColor = () => {
    switch (report.confidenceLevel) {
      case 'HIGH':
        return 'text-green-600 dark:text-green-400'
      case 'MEDIUM':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'LOW':
        return 'text-orange-600 dark:text-orange-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getRiskColor = () => {
    switch (report.riskLevel) {
      case 'HIGH':
        return 'text-red-600 dark:text-red-400'
      case 'MEDIUM':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'LOW':
        return 'text-green-600 dark:text-green-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  const getConfidenceIcon = () => {
    if (report.confidenceLevel === 'HIGH' && report.riskLevel === 'LOW') {
      return <FiCheckCircle className="w-4 h-4" />
    }
    if (report.riskLevel === 'HIGH') {
      return <FiAlertCircle className="w-4 h-4" />
    }
    return <FiInfo className="w-4 h-4" />
  }

  const shouldShowWarning = report.confidenceLevel === 'LOW' || report.riskLevel === 'HIGH'

  return (
    <div className={`p-3 rounded-lg border ${className} ${
      shouldShowWarning
        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
      <div className="flex items-start gap-2">
        <div className={`flex-shrink-0 mt-0.5 ${getConfidenceColor()}`}>
          {getConfidenceIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${getConfidenceColor()}`}>
              {report.confidenceLevel} Confidence
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
            <span className={`text-xs font-medium ${getRiskColor()}`}>
              {report.riskLevel} Risk
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              ({(report.confidenceScore * 100).toFixed(0)}%)
            </span>
          </div>
          
          {/* Reasons */}
          {report.reasons.length > 0 && (
            <div className="mt-2 space-y-1">
              {report.reasons.map((reason, index) => (
                <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                  • {reason}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

