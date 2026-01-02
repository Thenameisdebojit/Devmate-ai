'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { FiX, FiCircle } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  ),
})

export interface EditorTab {
  path: string
  content: string
  language?: string
  dirty?: boolean
  modifiedByAI?: boolean
}

interface MonacoEditorPanelProps {
  tabs: EditorTab[]
  activeTab?: string
  onTabSelect: (path: string) => void
  onTabClose: (path: string) => void
  onContentChange: (path: string, content: string) => void
  onCursorChange?: (line: number, column: number) => void
  onSelectionChange?: (start: { line: number; column: number }, end: { line: number; column: number }) => void
  onSave?: (path: string) => void
  readOnly?: boolean
}

export default function MonacoEditorPanel({
  tabs,
  activeTab,
  onTabSelect,
  onTabClose,
  onContentChange,
  onCursorChange,
  onSelectionChange,
  onSave,
  readOnly = false,
}: MonacoEditorPanelProps) {
  const [theme, setTheme] = useState('vs-dark')
  const activeTabData = tabs.find((t) => t.path === activeTab)

  // Detect language from file extension
  const getLanguage = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      json: 'json',
      html: 'html',
      css: 'css',
      md: 'markdown',
      yaml: 'yaml',
      yml: 'yaml',
      sh: 'shell',
      bash: 'shell',
    }
    return langMap[ext || ''] || 'plaintext'
  }

  // Update theme based on body class
  useEffect(() => {
    const isDark = document.body.classList.contains('dark')
    setTheme(isDark ? 'vs-dark' : 'light')

    const observer = new MutationObserver(() => {
      const isDark = document.body.classList.contains('dark')
      setTheme(isDark ? 'vs-dark' : 'light')
    })

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Handle Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    const handleSave = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (activeTab && onSave) {
          onSave(activeTab)
        }
      }
    }

    window.addEventListener('keydown', handleSave)
    return () => window.removeEventListener('keydown', handleSave)
  }, [activeTab, onSave])

  const handleEditorChange = (value: string | undefined) => {
    if (activeTab && value !== undefined) {
      onContentChange(activeTab, value)
    }
  }

  const handleEditorMount = (editor: any, monaco: any) => {
    // Track cursor position
    editor.onDidChangeCursorPosition((e: any) => {
      if (onCursorChange) {
        onCursorChange(e.position.lineNumber, e.position.column)
      }
    })

    // Track selection
    editor.onDidChangeCursorSelection((e: any) => {
      if (onSelectionChange && !e.selection.isEmpty()) {
        onSelectionChange(
          { line: e.selection.startLineNumber, column: e.selection.startColumn },
          { line: e.selection.endLineNumber, column: e.selection.endColumn }
        )
      }
    })
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.path === activeTab
          return (
            <motion.button
              key={tab.path}
              onClick={() => onTabSelect(tab.path)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                isActive
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-900'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="truncate max-w-[200px]">{tab.path.split('/').pop()}</span>
              {tab.dirty && (
                <FiCircle className="w-3 h-3 text-orange-500 flex-shrink-0" title="Unsaved changes" />
              )}
              {tab.modifiedByAI && !tab.dirty && (
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Modified by AI" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTabClose(tab.path)
                }}
                className="ml-1 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100 transition-opacity"
                onMouseEnter={(e) => {
                  e.currentTarget.classList.remove('opacity-0')
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.classList.add('opacity-0')
                  }
                }}
              >
                <FiX className="w-3 h-3" />
              </button>
            </motion.button>
          )
        })}
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {activeTabData ? (
          <MonacoEditor
            height="100%"
            language={activeTabData.language || getLanguage(activeTabData.path)}
            value={activeTabData.content}
            theme={theme}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              readOnly,
              minimap: { enabled: true },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              wordWrap: 'off',
              padding: { top: 16, bottom: 16 },
              fontFamily: 'JetBrains Mono, Monaco, Courier New, monospace',
              fontLigatures: true,
              tabSize: 2,
              renderWhitespace: 'selection',
              // Diff highlighting for AI-modified files
              diffEditor: {
                renderSideBySide: false,
              },
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-gray-50 dark:bg-gray-900">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">No file open</h3>
            <p className="dark:text-gray-400 text-gray-600 max-w-md">
              Select a file from the filesystem tree to view and edit it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

