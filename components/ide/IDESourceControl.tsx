'use client'

import { useState, useEffect } from 'react'
import { FiGitBranch, FiCheck, FiUpload, FiRefreshCw, FiPlus } from 'react-icons/fi'

interface IDESourceControlProps {
  projectId?: string
}

export default function IDESourceControl({ projectId }: IDESourceControlProps) {
  const [gitStatus, setGitStatus] = useState<any>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [isPushing, setIsPushing] = useState(false)

  useEffect(() => {
    if (!projectId) return

    const fetchStatus = async () => {
      try {
        const response = await fetch(`/api/git/status?projectId=${projectId}`)
        if (response.ok) {
          const data = await response.json()
          setGitStatus(data)
        }
      } catch (error) {
        console.error('Failed to fetch Git status:', error)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [projectId])

  const handleCommit = async () => {
    if (!projectId || !commitMessage.trim()) return

    setIsCommitting(true)
    try {
      const response = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, message: commitMessage }),
      })

      if (response.ok) {
        setCommitMessage('')
        // Refresh status
        const statusResponse = await fetch(`/api/git/status?projectId=${projectId}`)
        if (statusResponse.ok) {
          const data = await statusResponse.json()
          setGitStatus(data)
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to commit')
      }
    } catch (error) {
      console.error('Commit error:', error)
      alert('Failed to commit changes')
    } finally {
      setIsCommitting(false)
    }
  }

  const handlePush = async () => {
    if (!projectId) return

    setIsPushing(true)
    try {
      const response = await fetch('/api/git/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (response.ok) {
        alert('Pushed to remote successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to push')
      }
    } catch (error) {
      console.error('Push error:', error)
      alert('Failed to push to remote')
    } finally {
      setIsPushing(false)
    }
  }

  if (!projectId) {
    return (
      <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
        No project selected
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-2">
          <FiGitBranch className="w-4 h-4" />
          Source Control
        </div>
        <button
          onClick={() => {
            const statusResponse = fetch(`/api/git/status?projectId=${projectId}`)
            statusResponse.then(res => res.json()).then(data => setGitStatus(data))
          }}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          title="Refresh"
        >
          <FiRefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!gitStatus?.initialized ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Git repository not initialized. Initialize it from the terminal.
          </div>
        ) : (
          <>
            {/* Branch Info */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Branch: {gitStatus.branch || 'main'}
              </div>
              {gitStatus.hasChanges ? (
                <div className="text-sm text-orange-600 dark:text-orange-400">
                  You have uncommitted changes
                </div>
              ) : (
                <div className="text-sm text-green-600 dark:text-green-400">
                  Working tree clean
                </div>
              )}
            </div>

            {/* Commit Section */}
            {gitStatus.hasChanges && (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Commit Message
                </label>
                <textarea
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Enter commit message..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                  rows={3}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleCommit}
                    disabled={!commitMessage.trim() || isCommitting}
                    className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiCheck className="w-4 h-4" />
                    {isCommitting ? 'Committing...' : 'Commit'}
                  </button>
                </div>
              </div>
            )}

            {/* Push Section */}
            {gitStatus.remotes && gitStatus.remotes.length > 0 && (
              <div className="space-y-2">
                <button
                  onClick={handlePush}
                  disabled={isPushing || gitStatus.hasChanges}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiUpload className="w-4 h-4" />
                  {isPushing ? 'Pushing...' : 'Push to Remote'}
                </button>
                {gitStatus.hasChanges && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Commit changes before pushing
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

