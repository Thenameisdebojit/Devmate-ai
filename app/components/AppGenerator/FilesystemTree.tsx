'use client'

import { useState } from 'react'
import { FiFile, FiFolder, FiChevronRight, FiChevronDown, FiRefreshCw, FiX } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

export interface FileNode {
  path: string
  content?: string
  isDirectory: boolean
  children?: FileNode[]
  modifiedByAI?: boolean
  dirty?: boolean
}

interface FilesystemTreeProps {
  files: FileNode[]
  selectedPath?: string
  onFileSelect: (path: string) => void
  onFileRevert?: (path: string) => void
  onRefresh?: () => void
  projectId?: string
}

export default function FilesystemTree({
  files,
  selectedPath,
  onFileSelect,
  onFileRevert,
  onRefresh,
  projectId,
}: FilesystemTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ path: string; x: number; y: number } | null>(null)

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault()
    setContextMenu({ path, x: e.clientX, y: e.clientY })
  }

  const handleRevert = async (path: string) => {
    if (!projectId) {
      alert('Project ID required for rollback')
      return
    }

    try {
      // Get latest checkpoint
      const response = await fetch(`/api/runtime/checkpoint/list?projectId=${projectId}`)
      if (!response.ok) throw new Error('Failed to get checkpoints')

      const data = await response.json()
      if (!data.latest) {
        alert('No checkpoint available for rollback')
        return
      }

      // Rollback file
      const rollbackResponse = await fetch('/api/runtime/checkpoint/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          checkpointId: data.latest,
          filePath: path,
        }),
      })

      if (!rollbackResponse.ok) {
        const error = await rollbackResponse.json()
        throw new Error(error.error || 'Rollback failed')
      }

      onFileRevert?.(path)
      setContextMenu(null)
      alert(`File ${path} rolled back successfully`)
    } catch (error: any) {
      alert(`Rollback failed: ${error.message}`)
    }
  }

  const buildTree = (nodes: FileNode[], basePath = ''): FileNode[] => {
    const tree: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

    // First pass: create all nodes
    nodes.forEach((node) => {
      const parts = node.path.split('/').filter(Boolean)
      let currentPath = basePath

      parts.forEach((part, index) => {
        const fullPath = currentPath ? `${currentPath}/${part}` : part
        const isLast = index === parts.length - 1

        if (!pathMap.has(fullPath)) {
          const newNode: FileNode = {
            path: fullPath,
            isDirectory: !isLast,
            children: [],
            modifiedByAI: node.modifiedByAI,
            dirty: node.dirty,
          }
          if (isLast) {
            newNode.content = node.content
          }
          pathMap.set(fullPath, newNode)
        }

        currentPath = fullPath
      })
    })

    // Second pass: build hierarchy
    pathMap.forEach((node) => {
      const parts = node.path.split('/').filter(Boolean)
      if (parts.length === 1) {
        tree.push(node)
      } else {
        const parentPath = parts.slice(0, -1).join('/')
        const parent = pathMap.get(parentPath)
        if (parent) {
          if (!parent.children) parent.children = []
          if (!parent.children.find((n) => n.path === node.path)) {
            parent.children.push(node)
          }
        }
      }
    })

    return tree
  }

  const tree = buildTree(files)

  const renderNode = (node: FileNode, level = 0): JSX.Element | null => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedPath === node.path
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer group hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
            isSelected ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.isDirectory) {
              toggleExpand(node.path)
            } else {
              onFileSelect(node.path)
            }
          }}
          onContextMenu={(e) => !node.isDirectory && handleContextMenu(e, node.path)}
        >
          {node.isDirectory ? (
            <>
              {isExpanded ? (
                <FiChevronDown className="w-4 h-4 flex-shrink-0" />
              ) : (
                <FiChevronRight className="w-4 h-4 flex-shrink-0" />
              )}
              <FiFolder className={`w-4 h-4 flex-shrink-0 ${isExpanded ? 'text-blue-500' : 'text-gray-500'}`} />
            </>
          ) : (
            <>
              <div className="w-4" />
              <FiFile className="w-4 h-4 flex-shrink-0 text-gray-500" />
            </>
          )}
          <span className="flex-1 text-sm truncate font-mono">{node.path.split('/').pop()}</span>
          {node.modifiedByAI && (
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Modified by AI" />
          )}
          {node.dirty && (
            <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" title="Unsaved changes" />
          )}
        </div>
        {node.isDirectory && isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Files</h3>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors"
              title="Refresh"
            >
              <FiRefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2">
        {!projectId ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            No project selected
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400">
            No files yet
          </div>
        ) : (
          tree.map((node) => renderNode(node))
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setContextMenu(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[150px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                onClick={() => handleRevert(contextMenu.path)}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <FiRefreshCw className="w-4 h-4" />
                Revert Changes
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

