/**
 * PHASE 2: IDE Tab Bar Component
 * 
 * VS Code-identical tab bar with close buttons.
 * Supports multiple tabs (files + Settings).
 */

'use client'

import { FiX, FiSettings } from 'react-icons/fi'

export interface IDETab {
  path: string
  type: 'file' | 'settings'
  dirty?: boolean
  modifiedByAI?: boolean
  content?: string // Optional content for file tabs
}

interface IDETabBarProps {
  tabs: IDETab[]
  activeTab?: string
  onTabSelect: (path: string) => void
  onTabClose: (path: string) => void
}

export default function IDETabBar({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
}: IDETabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div className="h-10 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-x-auto">
      <div className="h-full flex items-center min-w-full">
        {tabs.map((tab) => {
          const isActive = tab.path === activeTab
          const fileName = tab.type === 'settings' ? 'Settings' : tab.path.split('/').pop() || tab.path

          return (
            <div
              key={tab.path}
              className={`group h-full flex items-center gap-2 px-3 border-r border-gray-200 dark:border-gray-800 cursor-pointer transition-colors min-w-[120px] max-w-[240px] ${
                isActive
                  ? 'bg-white dark:bg-gray-950 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              onClick={() => onTabSelect(tab.path)}
            >
              {/* Tab Icon */}
              {tab.type === 'settings' ? (
                <FiSettings className={`w-4 h-4 flex-shrink-0 ${
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`} />
              ) : (
                <div className={`w-4 h-4 flex-shrink-0 flex items-center justify-center ${
                  isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {tab.dirty && (
                    <span className="w-2 h-2 rounded-full bg-orange-500" title="Unsaved changes" />
                  )}
                  {tab.modifiedByAI && !tab.dirty && (
                    <span className="w-2 h-2 rounded-full bg-green-500" title="Modified by AI" />
                  )}
                  {!tab.dirty && !tab.modifiedByAI && (
                    <div className="w-2 h-2" /> // Spacer
                  )}
                </div>
              )}

              {/* Tab Label */}
              <span className={`flex-1 text-sm truncate ${
                isActive
                  ? 'text-gray-900 dark:text-gray-100 font-medium'
                  : 'text-gray-600 dark:text-gray-400'
              }`}>
                {fileName}
              </span>

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.path)
                }}
                className={`ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-opacity flex-shrink-0 ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="Close"
              >
                <FiX className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
