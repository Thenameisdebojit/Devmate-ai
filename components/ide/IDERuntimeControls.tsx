'use client'

import { useState } from 'react'

interface IDERuntimeControlsProps {
  projectId?: string
  runtimeState?: any
  className?: string
}

export default function IDERuntimeControls({
  projectId,
  runtimeState,
  className,
}: IDERuntimeControlsProps) {
  const [isRunning, setIsRunning] = useState(runtimeState?.status === 'running')

  const handleRun = async () => {
    if (!projectId) return

    try {
      const response = await fetch('/api/runtime/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (response.ok) {
        setIsRunning(true)
      }
    } catch (error) {
      console.error('Failed to start runtime:', error)
    }
  }

  const handleStop = async () => {
    if (!projectId) return

    try {
      const response = await fetch('/api/runtime/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (response.ok) {
        setIsRunning(false)
      }
    } catch (error) {
      console.error('Failed to stop runtime:', error)
    }
  }

  return (
    <div className={`p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Runtime
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {isRunning ? 'Running' : 'Stopped'}
          </div>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={handleRun}
              className="px-3 py-1.5 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            >
              Run
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
            >
              Stop
            </button>
          )}
        </div>
      </div>
      {runtimeState?.previewUrl && (
        <div className="mt-2">
          <a
            href={runtimeState.previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline"
          >
            Open Preview
          </a>
        </div>
      )}
    </div>
  )
}

