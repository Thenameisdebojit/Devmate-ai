/**
 * Build Status Indicator Component
 * 
 * Shows build status in the status bar.
 */

'use client'

import { useState, useEffect } from 'react'
import { FiCheckCircle, FiXCircle, FiLoader, FiAlertCircle } from 'react-icons/fi'

export type BuildStatus = 'idle' | 'building' | 'success' | 'error'

interface BuildStatusIndicatorProps {
  projectId?: string
  status?: BuildStatus
  errorCount?: number
  warningCount?: number
  onBuild?: () => void
  onStop?: () => void
}

export default function BuildStatusIndicator({
  projectId,
  status = 'idle',
  errorCount = 0,
  warningCount = 0,
  onBuild,
  onStop,
}: BuildStatusIndicatorProps) {
  const getStatusIcon = () => {
    switch (status) {
      case 'building':
        return <FiLoader className="w-4 h-4 animate-spin text-blue-500" />
      case 'success':
        return <FiCheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <FiXCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (status) {
      case 'building':
        return 'Building...'
      case 'success':
        return 'Build succeeded'
      case 'error':
        return `Build failed (${errorCount} errors)`
      default:
        return 'Ready'
    }
  }

  if (!projectId) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs border-l border-gray-300 dark:border-gray-700">
      {getStatusIcon()}
      <span className="text-gray-600 dark:text-gray-400">{getStatusText()}</span>
      {errorCount > 0 && (
        <span className="px-1.5 py-0.5 bg-red-500 text-white rounded text-xs">
          {errorCount}
        </span>
      )}
      {warningCount > 0 && (
        <span className="px-1.5 py-0.5 bg-yellow-500 text-white rounded text-xs">
          {warningCount}
        </span>
      )}
      {status === 'building' && onStop && (
        <button
          onClick={onStop}
          className="px-2 py-0.5 text-xs bg-red-500 text-white rounded hover:bg-red-600"
        >
          Stop
        </button>
      )}
      {status !== 'building' && onBuild && (
        <button
          onClick={onBuild}
          className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Build
        </button>
      )}
    </div>
  )
}
