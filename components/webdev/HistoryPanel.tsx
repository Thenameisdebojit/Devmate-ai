'use client'

import { useState, useEffect } from 'react'
import { FiClock, FiCode } from 'react-icons/fi'
import { getWebDevHistory, type WebDevHistoryItem } from '@/lib/webdevHistory'

export default function HistoryPanel() {
  const [history, setHistory] = useState<WebDevHistoryItem[]>([])

  useEffect(() => {
    setHistory(getWebDevHistory())
    
    // Listen for history updates
    const handleStorageChange = () => {
      setHistory(getWebDevHistory())
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('webdev-history-updated', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('webdev-history-updated', handleStorageChange)
    }
  }, [])

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <FiClock className="text-blue-500" />
        Recent Projects
      </h3>
      
      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p className="text-sm">No projects yet</p>
          <p className="text-xs mt-2">Your generated projects will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <button
              key={item.id}
              className="w-full text-left p-3 bg-gray-900/50 hover:bg-gray-700/50 border border-gray-700 hover:border-blue-500/50 rounded-lg transition-all group"
            >
              <div className="flex items-start gap-3">
                <FiCode className="text-blue-400 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">
                    {item.prompt.slice(0, 50)}{item.prompt.length > 50 ? '...' : ''}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{item.framework} · {item.fileCount} files</div>
                  <div className="text-xs text-gray-600 mt-1">
                    {new Date(item.timestamp).toLocaleDateString()} at {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
