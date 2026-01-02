'use client'

import { useState, useEffect } from 'react'
import { FiClock, FiRotateCcw, FiFile, FiTrash2, FiRefreshCw } from 'react-icons/fi'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

interface Checkpoint {
  id: string
  timestamp: number
  description: string
  type: 'auto' | 'manual' | 'pre-write'
  metadata: {
    fileCount: number
    totalSize: number
  }
}

interface CheckpointPanelProps {
  projectId?: string
  onRollback?: (checkpointId: string, filePath?: string) => void
}

export default function CheckpointPanel({ projectId, onRollback }: CheckpointPanelProps) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
  const [latestCheckpoint, setLatestCheckpoint] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projectId) {
      loadCheckpoints()
    }
  }, [projectId])

  const loadCheckpoints = async () => {
    if (!projectId) return

    setLoading(true)
    try {
      const response = await fetch(`/api/runtime/checkpoint/list?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setCheckpoints(data.checkpoints || [])
        setLatestCheckpoint(data.latest)
      }
    } catch (error) {
      console.error('Failed to load checkpoints:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRollback = async (checkpointId: string, filePath?: string) => {
    if (!projectId) return

    try {
      const response = await fetch('/api/runtime/checkpoint/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          checkpointId,
          filePath,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Rollback failed')
      }

      toast.success(filePath ? `File rolled back` : 'Project rolled back')
      onRollback?.(checkpointId, filePath)
      
      // Reload checkpoints
      await loadCheckpoints()
    } catch (error: any) {
      toast.error(error.message || 'Rollback failed')
    }
  }

  const handleDeleteCheckpoint = async (checkpointId: string) => {
    if (!projectId) return
    if (!confirm('Delete this checkpoint? This action cannot be undone.')) return

    try {
      // TODO: Implement delete endpoint
      toast.info('Delete checkpoint functionality will be implemented')
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete checkpoint')
    }
  }

  if (!projectId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <FiClock className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No project selected</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Checkpoints</h3>
        <button
          onClick={loadCheckpoints}
          disabled={loading}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
          title="Refresh"
        >
          <FiRefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Checkpoints List */}
      <div className="flex-1 overflow-y-auto p-2">
        {checkpoints.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            No checkpoints yet
          </div>
        ) : (
          <div className="space-y-2">
            {checkpoints
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((checkpoint) => (
                <motion.div
                  key={checkpoint.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg border ${
                    checkpoint.id === latestCheckpoint
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <FiClock className="w-4 h-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {new Date(checkpoint.timestamp).toLocaleString()}
                        </span>
                        {checkpoint.id === latestCheckpoint && (
                          <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                            Latest
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {checkpoint.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {checkpoint.metadata.fileCount} files • {formatSize(checkpoint.metadata.totalSize)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => handleRollback(checkpoint.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <FiRotateCcw className="w-3 h-3" />
                      Rollback
                    </button>
                    <button
                      onClick={() => handleDeleteCheckpoint(checkpoint.id)}
                      className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
                      title="Delete checkpoint"
                    >
                      <FiTrash2 className="w-3 h-3" />
                    </button>
                  </div>
                </motion.div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to format file size
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

