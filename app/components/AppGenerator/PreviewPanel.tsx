'use client'

import { useState, useEffect, useRef } from 'react'
import { FiEye, FiTerminal, FiCode } from 'react-icons/fi'
import Terminal from './Terminal'

type PanelType = 'preview' | 'console' | 'terminal'

interface PreviewPanelProps {
  type: PanelType
  onTypeChange: (type: PanelType) => void
  previewUrl?: string
  consoleOutput?: string[]
  projectId?: string
}

export default function PreviewPanel({
  type,
  onTypeChange,
  previewUrl,
  consoleOutput = [],
  projectId,
}: PreviewPanelProps) {
  const consoleEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (type === 'console' && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [consoleOutput, type])
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800">
      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <button
          onClick={() => onTypeChange('preview')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            type === 'preview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FiEye className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={() => onTypeChange('console')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            type === 'console'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FiCode className="w-4 h-4" />
          Console
        </button>
        <button
          onClick={() => onTypeChange('terminal')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            type === 'terminal'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FiTerminal className="w-4 h-4" />
          Terminal
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {type === 'preview' && (
          <div className="h-full">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title="Preview"
              />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <FiEye className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No preview available</p>
                  <p className="text-sm mt-1">Run the project to see preview</p>
                </div>
              </div>
            )}
          </div>
        )}

        {type === 'console' && (
          <div className="h-full p-4 bg-gray-900 text-green-400 font-mono text-sm overflow-y-auto">
            {consoleOutput.length === 0 ? (
              <div className="text-gray-500">Console output will appear here</div>
            ) : (
              <>
                {consoleOutput.map((line, index) => (
                  <div key={index} className="mb-1 whitespace-pre-wrap">
                    {line}
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </>
            )}
          </div>
        )}

        {type === 'terminal' && (
          <div className="h-full relative">
            {projectId ? (
              <Terminal projectId={projectId} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <FiTerminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No terminal available</p>
                  <p className="text-sm mt-1">Run the project to access terminal</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

