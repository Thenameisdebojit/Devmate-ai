'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FiTerminal, FiX, FiPlus, FiChevronDown, FiMaximize2, FiMinimize2, FiTrash2 } from 'react-icons/fi'
import TerminalTab from './TerminalTab'

interface TerminalTab {
  id: string
  name: string
  projectId: string
  createdAt: number
}

interface IDETerminalPanelProps {
  projectId?: string
  isVisible: boolean
  onClose: () => void
}

export default function IDETerminalPanel({ projectId, isVisible, onClose }: IDETerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const terminalContainerRef = useRef<HTMLDivElement>(null)

  // Auto-create terminal tab when panel becomes visible and projectId is available
  useEffect(() => {
    if (isVisible && projectId && tabs.length === 0) {
      const newTab: TerminalTab = {
        id: `terminal-${Date.now()}`,
        name: 'powershell',
        projectId: projectId,
        createdAt: Date.now(),
      }
      setTabs([newTab])
      setActiveTabId(newTab.id)
      setIsMinimized(false)
    }
  }, [isVisible, projectId, tabs.length])

  // Listen for new terminal requests
  useEffect(() => {
    const handleNewTerminal = (event: CustomEvent) => {
      if (event.detail.projectId === projectId && projectId) {
        const newTab: TerminalTab = {
          id: `terminal-${Date.now()}`,
          name: 'powershell',
          projectId: projectId,
          createdAt: Date.now(),
        }
        setTabs((prev) => [...prev, newTab])
        setActiveTabId(newTab.id)
        setIsMinimized(false)
      }
    }

    window.addEventListener('terminal-new', handleNewTerminal as EventListener)
    return () => window.removeEventListener('terminal-new', handleNewTerminal as EventListener)
  }, [projectId])

  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
        onClose()
      }
      return newTabs
    })
  }, [activeTabId, onClose])

  const handleNewTerminal = useCallback(() => {
    if (!projectId) return
    const newTab: TerminalTab = {
      id: `terminal-${Date.now()}`,
      name: 'powershell',
      projectId: projectId,
      createdAt: Date.now(),
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setIsMinimized(false)
  }, [projectId])

  if (!isVisible && tabs.length === 0) return null

  return (
    <div className={`flex flex-col border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition-all ${
      isMinimized ? 'h-8' : 'h-64'
    }`}>
      {/* Terminal Header */}
      <div className="h-8 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 flex items-center">
        {/* Tabs */}
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`h-full px-4 flex items-center gap-2 text-xs border-r border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                activeTabId === tab.id
                  ? 'bg-gray-200 dark:bg-gray-700 font-medium'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <FiTerminal className="w-3 h-3" />
              <span>{tab.name}</span>
              <button
                onClick={(e) => handleCloseTab(tab.id, e)}
                className="ml-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded p-0.5"
              >
                <FiX className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={handleNewTerminal}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="New Terminal"
          >
            <FiPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <FiMaximize2 className="w-4 h-4" /> : <FiMinimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Close Panel"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      {!isMinimized && (
        <div ref={terminalContainerRef} className="flex-1 min-h-0 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${activeTabId === tab.id ? 'block' : 'hidden'}`}
            >
              <TerminalTab
                tabId={tab.id}
                projectId={tab.projectId}
                profile={tab.name}
                onReady={() => {
                  console.log(`[IDETerminalPanel] Terminal tab ${tab.id} ready`)
                }}
              />
            </div>
          ))}
          {tabs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <FiTerminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No terminal open</p>
                <p className="text-sm mt-1">Click the + button or use Terminal → New Terminal</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
