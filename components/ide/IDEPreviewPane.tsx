'use client'

/**
 * PHASE 5: Preview Pane Component
 * 
 * Shows live iframe preview of running application.
 * Auto-refreshes when preview URL changes.
 */

import { useEffect, useRef, useState } from 'react'
import { FiRefreshCw, FiExternalLink, FiAlertCircle } from 'react-icons/fi'

interface IDEPreviewPaneProps {
  previewUrl?: string
  previewStatus?: 'idle' | 'starting' | 'running' | 'stopped'
  projectId?: string
  className?: string
}

export default function IDEPreviewPane({
  previewUrl,
  previewStatus = 'idle',
  projectId,
  className,
}: IDEPreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Reload iframe when preview URL changes
  useEffect(() => {
    if (previewUrl && iframeRef.current) {
      setIsLoading(true)
      setHasError(false)
      setErrorMessage('')
      
      // Force reload by changing src
      const iframe = iframeRef.current
      const currentSrc = iframe.src
      iframe.src = ''
      setTimeout(() => {
        iframe.src = previewUrl
      }, 100)
    }
  }, [previewUrl])

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  // Handle iframe error
  const handleIframeError = () => {
    setIsLoading(false)
    setHasError(true)
    setErrorMessage('Failed to load preview. Check if the dev server is running.')
  }

  // Manual refresh
  const handleRefresh = () => {
    if (iframeRef.current && previewUrl) {
      setIsLoading(true)
      setHasError(false)
      iframeRef.current.src = previewUrl
    }
  }

  // Open in new tab
  const handleOpenInNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (!previewUrl) {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No preview available
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Start the runtime to see preview
          </p>
        </div>
      </div>
    )
  }

  if (previewStatus === 'stopped') {
    return (
      <div className={`flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 ${className}`}>
        <div className="text-center">
          <FiAlertCircle className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Preview stopped
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Runtime is not running
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-gray-900 ${className}`}>
      {/* Preview Header */}
      <div className="h-8 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 flex items-center justify-between px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Preview
          </span>
          {previewStatus === 'starting' && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Starting...
            </span>
          )}
          {previewStatus === 'running' && (
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Refresh Preview"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Open in New Tab"
          >
            <FiExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative bg-gray-100 dark:bg-gray-950">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
            <div className="text-center">
              <FiRefreshCw className="w-6 h-6 text-gray-400 dark:text-gray-600 mx-auto mb-2 animate-spin" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Loading preview...
              </p>
            </div>
          </div>
        )}

        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-900 z-10">
            <div className="text-center">
              <FiAlertCircle className="w-8 h-8 text-red-400 dark:text-red-600 mx-auto mb-2" />
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                Preview Error
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {errorMessage}
              </p>
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={previewUrl}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          title="Application Preview"
        />
      </div>
    </div>
  )
}

