'use client'

import { 
  FiFile, 
  FiSearch, 
  FiGitBranch, 
  FiPlay, 
  FiPackage,
  FiSettings
} from 'react-icons/fi'

interface IDEActivityBarProps {
  activeView: 'explorer' | 'search' | 'source-control' | 'run' | 'extensions'
  onViewChange: (view: 'explorer' | 'search' | 'source-control' | 'run' | 'extensions') => void
  gitStatus?: {
    initialized: boolean
    hasChanges: boolean
    branch?: string | null
  }
  onOpenSettings?: () => void
}

export default function IDEActivityBar({ 
  activeView, 
  onViewChange,
  gitStatus,
  onOpenSettings,
}: IDEActivityBarProps) {
  return (
    <div className="w-12 flex-shrink-0 flex flex-col items-center bg-gray-100 dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800">
      {/* Explorer */}
      <button
        onClick={() => onViewChange('explorer')}
        className={`w-full h-12 flex items-center justify-center transition-colors ${
          activeView === 'explorer'
            ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 border-l-2 border-blue-600 dark:border-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
        }`}
        title="Explorer (Ctrl+Shift+E)"
      >
        <FiFile className="w-5 h-5" />
      </button>

      {/* Search */}
      <button
        onClick={() => onViewChange('search')}
        className={`w-full h-12 flex items-center justify-center transition-colors ${
          activeView === 'search'
            ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 border-l-2 border-blue-600 dark:border-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
        }`}
        title="Search (Ctrl+Shift+F)"
      >
        <FiSearch className="w-5 h-5" />
      </button>

      {/* Source Control */}
      <button
        onClick={() => onViewChange('source-control')}
        className={`w-full h-12 flex items-center justify-center transition-colors relative ${
          activeView === 'source-control'
            ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 border-l-2 border-blue-600 dark:border-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
        }`}
        title="Source Control (Ctrl+Shift+G)"
      >
        <FiGitBranch className="w-5 h-5" />
        {gitStatus?.hasChanges && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full"></span>
        )}
      </button>

      {/* Run and Debug */}
      <button
        onClick={() => onViewChange('run')}
        className={`w-full h-12 flex items-center justify-center transition-colors ${
          activeView === 'run'
            ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 border-l-2 border-blue-600 dark:border-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
        }`}
        title="Run and Debug (Ctrl+Shift+D)"
      >
        <FiPlay className="w-5 h-5" />
      </button>

      {/* Extensions */}
      <button
        onClick={() => onViewChange('extensions')}
        className={`w-full h-12 flex items-center justify-center transition-colors ${
          activeView === 'extensions'
            ? 'text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-900 border-l-2 border-blue-600 dark:border-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
        }`}
        title="Extensions (Ctrl+Shift+X)"
      >
        <FiPackage className="w-5 h-5" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <button
        className="w-full h-12 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
        title="Settings"
        onClick={onOpenSettings}
      >
        <FiSettings className="w-5 h-5" />
      </button>
    </div>
  )
}

