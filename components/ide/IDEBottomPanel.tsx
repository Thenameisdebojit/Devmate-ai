'use client'

/**
 * PHASE 5: Bottom Panel with Tabs
 * 
 * Toggle between Terminal / Preview / Console
 */

import { useState } from 'react'
import { FiTerminal, FiEye, FiAlertCircle } from 'react-icons/fi'
import IDETerminalPanel from './IDETerminalPanel'
import IDEPreviewPane from './IDEPreviewPane'
import IDEConsolePanel from './IDEConsolePanel'

type TabType = 'terminal' | 'preview' | 'console'

interface IDEBottomPanelProps {
  projectId?: string
  previewUrl?: string
  previewStatus?: 'idle' | 'starting' | 'running' | 'stopped'
  runtimeState?: any
  buildErrors?: Array<{ file: string; line: number; message: string }>
  onErrorClick?: (file: string, line: number) => void
  isVisible: boolean
  onClose: () => void
}

export default function IDEBottomPanel({
  projectId,
  previewUrl,
  previewStatus,
  runtimeState,
  buildErrors = [],
  onErrorClick,
  isVisible,
  onClose,
}: IDEBottomPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('terminal')

  if (!isVisible) return null

  return (
    <div className="flex flex-col border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      {/* Tab Bar */}
      <div className="h-8 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 flex items-center">
        <button
          onClick={() => setActiveTab('terminal')}
          className={`h-full px-4 flex items-center gap-2 text-xs border-r border-gray-200 dark:border-gray-700 transition-colors ${
            activeTab === 'terminal'
              ? 'bg-gray-200 dark:bg-gray-700 font-medium text-gray-900 dark:text-gray-100'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <FiTerminal className="w-3 h-3" />
          <span>Terminal</span>
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className={`h-full px-4 flex items-center gap-2 text-xs border-r border-gray-200 dark:border-gray-700 transition-colors ${
            activeTab === 'preview'
              ? 'bg-gray-200 dark:bg-gray-700 font-medium text-gray-900 dark:text-gray-100'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <FiEye className="w-3 h-3" />
          <span>Preview</span>
          {previewStatus === 'running' && (
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={`h-full px-4 flex items-center gap-2 text-xs transition-colors ${
            activeTab === 'console'
              ? 'bg-gray-200 dark:bg-gray-700 font-medium text-gray-900 dark:text-gray-100'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <FiAlertCircle className="w-3 h-3" />
          <span>Console</span>
          {buildErrors.length > 0 && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-red-500 text-white rounded">
              {buildErrors.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {activeTab === 'terminal' && (
          <IDETerminalPanel
            projectId={projectId}
            isVisible={true}
            onClose={onClose}
          />
        )}
        {activeTab === 'preview' && (
          <IDEPreviewPane
            previewUrl={previewUrl}
            previewStatus={previewStatus}
            projectId={projectId}
            className="h-full"
          />
        )}
        {activeTab === 'console' && (
          <IDEConsolePanel
            projectId={projectId}
            buildErrors={buildErrors}
            onErrorClick={onErrorClick}
            runtimeState={runtimeState}
          />
        )}
      </div>
    </div>
  )
}

