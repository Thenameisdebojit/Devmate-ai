/**
 * Terminal Split View Component
 * 
 * Allows splitting terminal into multiple panes (horizontal/vertical).
 */

'use client'

import { useState } from 'react'
import TerminalTab from './TerminalTab'

interface TerminalSplitViewProps {
  projectId: string
  orientation?: 'horizontal' | 'vertical'
  onClose?: () => void
}

export default function TerminalSplitView({
  projectId,
  orientation = 'horizontal',
  onClose,
}: TerminalSplitViewProps) {
  const [panes, setPanes] = useState<string[]>([`pane-${Date.now()}`])

  const addPane = () => {
    setPanes([...panes, `pane-${Date.now()}`])
  }

  const removePane = (paneId: string) => {
    if (panes.length > 1) {
      setPanes(panes.filter((id) => id !== paneId))
    } else if (onClose) {
      onClose()
    }
  }

  return (
    <div className={`flex h-full ${orientation === 'horizontal' ? 'flex-row' : 'flex-col'}`}>
      {panes.map((paneId, index) => (
        <div
          key={paneId}
          className={`flex-1 flex flex-col border-r border-gray-700 last:border-r-0 ${
            orientation === 'horizontal' ? 'border-r' : 'border-b last:border-b-0'
          }`}
        >
          <div className="h-6 flex items-center justify-between px-2 bg-gray-800 border-b border-gray-700">
            <span className="text-xs text-gray-400">Terminal {index + 1}</span>
            {panes.length > 1 && (
              <button
                onClick={() => removePane(paneId)}
                className="text-gray-400 hover:text-white text-xs"
              >
                ×
              </button>
            )}
          </div>
          <div className="flex-1 min-h-0">
            <TerminalTab
              tabId={paneId}
              projectId={projectId}
            />
          </div>
        </div>
      ))}
      {panes.length < 4 && (
        <button
          onClick={addPane}
          className="absolute bottom-2 right-2 px-2 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
        >
          Split
        </button>
      )}
    </div>
  )
}
