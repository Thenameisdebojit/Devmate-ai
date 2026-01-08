'use client'

import { useState, useCallback, useEffect } from 'react'
import { 
  FiFile, 
  FiFolder, 
  FiChevronRight, 
  FiChevronDown,
  FiEdit2,
  FiTrash2,
  FiCopy,
  FiDownload,
  FiRefreshCw,
  FiRotateCcw,
  FiPlus
} from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

interface IDESidebarProps {
  files: Array<{ path: string; type?: string }>
  selectedFile?: string
  onFileSelect: (path: string) => void
  projectId?: string
  onFilesChange?: () => void
  aiModifiedFiles?: Set<string> // PHASE 1: Track AI-modified files for highlighting
  onCreateFile?: (path: string) => void
  onCreateFolder?: (path: string) => void
}

export default function IDESidebar({ 
  files, 
  selectedFile, 
  onFileSelect,
  projectId,
  onFilesChange,
  aiModifiedFiles = new Set(),
  onCreateFile,
  onCreateFolder
}: IDESidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<{ path: string; x: number; y: number } | null>(null)
  const [renamingPath, setRenamingPath] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creatingFile, setCreatingFile] = useState<string | null>(null)
  const [creatingFolder, setCreatingFolder] = useState<string | null>(null)
  const [newItemName, setNewItemName] = useState('')

  // Build tree structure from flat file list
  const buildTree = useCallback((): FileNode[] => {
    const tree: FileNode[] = []
    const pathMap = new Map<string, FileNode>()

    files.forEach((file) => {
      const parts = file.path.split('/').filter(Boolean)
      let currentPath = ''
      
      parts.forEach((part, index) => {
        const parentPath = currentPath
        currentPath = parentPath ? `${parentPath}/${part}` : part
        const isLast = index === parts.length - 1

        if (!pathMap.has(currentPath)) {
          const node: FileNode = {
            name: part,
            path: currentPath,
            type: isLast ? 'file' : 'directory',
            children: [],
          }
          pathMap.set(currentPath, node)

          if (parentPath) {
            const parent = pathMap.get(parentPath)
            if (parent) {
              parent.children = parent.children || []
              parent.children.push(node)
            }
          } else {
            tree.push(node)
          }
        }
      })
    })

    // Sort tree
    const sortTree = (nodes: FileNode[]): FileNode[] => {
      return nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      }).map(node => ({
        ...node,
        children: node.children ? sortTree(node.children) : undefined,
      }))
    }

    return sortTree(tree)
  }, [files])

  const tree = buildTree()

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
    e.stopPropagation()
    setContextMenu({ path, x: e.clientX, y: e.clientY })
  }

  const handleRename = async (oldPath: string, newName: string) => {
    if (!projectId || !newName || newName.trim() === '') return

    const pathParts = oldPath.split('/')
    pathParts[pathParts.length - 1] = newName
    const newPath = pathParts.join('/')

    try {
      const response = await fetch('/api/runtime/file/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, oldPath, newPath }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to rename file')
        return
      }

      setRenamingPath(null)
      setRenameValue('')
      onFilesChange?.()
      
      // If the renamed file was selected, update selection
      if (selectedFile === oldPath) {
        onFileSelect(newPath)
      }
    } catch (error) {
      console.error('Rename error:', error)
      alert('Failed to rename file')
    }
  }

  const handleDelete = async (path: string) => {
    if (!projectId) return
    if (!confirm(`Are you sure you want to delete "${path}"?`)) return

    try {
      const response = await fetch('/api/runtime/file/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, filePath: path }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to delete file')
        return
      }

      setContextMenu(null)
      onFilesChange?.()
      
      // If the deleted file was selected, clear selection
      if (selectedFile === path) {
        onFileSelect('')
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Failed to delete file')
    }
  }

  // PHASE 4: Handle file rollback
  const handleRevertFile = async (path: string) => {
    if (!projectId) return
    if (!confirm(`Revert "${path}" to last checkpoint?`)) return

    try {
      const response = await fetch('/api/checkpoint/rollback-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, filePath: path }),
      })

      if (!response.ok) {
        const error = await response.json()
        alert(error.error || 'Failed to revert file')
        return
      }

      setContextMenu(null)
      onFilesChange?.()
      
      // Refresh file content if this file is selected
      if (selectedFile === path) {
        onFileSelect(path) // Trigger reload
      }
    } catch (error) {
      console.error('Revert file error:', error)
      alert('Failed to revert file')
    }
  }

  // Handle new file creation
  const handleNewFile = async (parentPath?: string) => {
    if (!projectId) return

    const fileName = newItemName.trim()
    if (!fileName) {
      setCreatingFile(null)
      setNewItemName('')
      return
    }

    const filePath = parentPath ? `${parentPath}/${fileName}` : fileName

    try {
      if (onCreateFile) {
        onCreateFile(filePath)
      } else {
        const response = await fetch('/api/runtime/file/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, filePath, content: '' }),
        })

        if (!response.ok) {
          const error = await response.json()
          alert(error.error || 'Failed to create file')
          return
        }

        onFilesChange?.()
        onFileSelect(filePath) // Open the new file
      }
    } catch (error) {
      console.error('Create file error:', error)
      alert('Failed to create file')
    } finally {
      setCreatingFile(null)
      setNewItemName('')
    }
  }

  // Handle new folder creation
  const handleNewFolder = async (parentPath?: string) => {
    if (!projectId) return

    const folderName = newItemName.trim()
    if (!folderName) {
      setCreatingFolder(null)
      setNewItemName('')
      return
    }

    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName

    try {
      if (onCreateFolder) {
        onCreateFolder(folderPath)
      } else {
        const response = await fetch('/api/runtime/folder/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, folderPath }),
        })

        if (!response.ok) {
          const error = await response.json()
          alert(error.error || 'Failed to create folder')
          return
        }

        onFilesChange?.()
        // Expand the parent folder to show the new folder
        if (parentPath) {
          setExpandedPaths((prev) => new Set([...prev, parentPath]))
        }
      }
    } catch (error) {
      console.error('Create folder error:', error)
      alert('Failed to create folder')
    } finally {
      setCreatingFolder(null)
      setNewItemName('')
    }
  }

  const getFileIcon = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    return <FiFile className="w-4 h-4" />
  }

  const renderNode = (node: FileNode, level = 0): JSX.Element => {
    const isExpanded = expandedPaths.has(node.path)
    const isSelected = selectedFile === node.path
    const isRenaming = renamingPath === node.path
    const hasChildren = node.children && node.children.length > 0

    return (
      <div key={node.path}>
        <div
          className={`flex items-center px-2 py-1 text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-800 ${
            isSelected ? 'bg-blue-100 dark:bg-blue-900/30' : ''
          } ${
            aiModifiedFiles.has(node.path) ? 'bg-green-50 dark:bg-green-900/20 border-l-2 border-green-500' : ''
          }`}
          style={{ paddingLeft: `${8 + level * 16}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              toggleExpand(node.path)
            } else {
              onFileSelect(node.path)
            }
          }}
          onContextMenu={(e) => handleContextMenu(e, node.path)}
        >
          {node.type === 'directory' ? (
            <>
              {hasChildren ? (
                isExpanded ? (
                  <FiChevronDown className="w-4 h-4 mr-1 flex-shrink-0" />
                ) : (
                  <FiChevronRight className="w-4 h-4 mr-1 flex-shrink-0" />
                )
              ) : (
                <span className="w-4 mr-1" />
              )}
              <FiFolder className="w-4 h-4 mr-1.5 text-blue-500 flex-shrink-0" />
            </>
          ) : (
            <>
              <span className="w-4 mr-1" />
              {getFileIcon(node.path)}
              <span className="w-1.5" />
            </>
          )}
          {isRenaming ? (
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => {
                if (renameValue && renameValue !== node.name) {
                  handleRename(node.path, renameValue)
                } else {
                  setRenamingPath(null)
                  setRenameValue('')
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (renameValue && renameValue !== node.name) {
                    handleRename(node.path, renameValue)
                  } else {
                    setRenamingPath(null)
                    setRenameValue('')
                  }
                } else if (e.key === 'Escape') {
                  setRenamingPath(null)
                  setRenameValue('')
                }
              }}
              autoFocus
              className="flex-1 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-gray-800"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate">{node.name}</span>
          )}
        </div>
        {node.type === 'directory' && isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  return (
    <div className="w-64 flex-shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Explorer
        </div>
        <div className="flex items-center gap-1">
          {/* New File Button */}
          <button
            onClick={() => {
              setCreatingFile('')
              setNewItemName('')
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="New File..."
          >
            <FiFile className="w-4 h-4" />
          </button>
          {/* New Folder Button */}
          <button
            onClick={() => {
              setCreatingFolder('')
              setNewItemName('')
            }}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="New Folder..."
          >
            <FiFolder className="w-4 h-4" />
          </button>
          {/* Refresh Button */}
          <button
            onClick={() => onFilesChange?.()}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            title="Refresh"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* New File/Folder Input */}
      {(creatingFile !== null || creatingFolder !== null) && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-800">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (creatingFile !== null) {
                  handleNewFile(creatingFile || undefined)
                } else if (creatingFolder !== null) {
                  handleNewFolder(creatingFolder || undefined)
                }
              } else if (e.key === 'Escape') {
                setCreatingFile(null)
                setCreatingFolder(null)
                setNewItemName('')
              }
            }}
            onBlur={() => {
              if (creatingFile !== null) {
                handleNewFile(creatingFile || undefined)
              } else if (creatingFolder !== null) {
                handleNewFolder(creatingFolder || undefined)
              }
            }}
            placeholder={creatingFile !== null ? 'File name...' : 'Folder name...'}
            autoFocus
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto">
        {tree.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 dark:text-gray-400 text-center">
            No files
          </div>
        ) : (
          <div className="py-1">
            {tree.map((node) => renderNode(node))}
          </div>
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
              className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[180px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setRenamingPath(contextMenu.path)
                  setRenameValue(contextMenu.path.split('/').pop() || '')
                  setContextMenu(null)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <FiEdit2 className="w-4 h-4" />
                Rename
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.path)
                  setContextMenu(null)
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <FiCopy className="w-4 h-4" />
                Copy Path
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              {/* PHASE 4: Revert to last checkpoint */}
              <button
                onClick={() => handleRevertFile(contextMenu.path)}
                className="w-full px-4 py-2 text-left text-sm text-orange-600 dark:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <FiRotateCcw className="w-4 h-4" />
                Revert to Last Checkpoint
              </button>
              <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
              <button
                onClick={() => handleDelete(contextMenu.path)}
                className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              >
                <FiTrash2 className="w-4 h-4" />
                Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

