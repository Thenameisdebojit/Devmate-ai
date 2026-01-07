'use client'

import { useState, useRef, useEffect } from 'react'
import { FiPlay, FiSquare, FiCode } from 'react-icons/fi'
import dynamic from 'next/dynamic'
import type { EditorSettings } from './IDESettingsPanel'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

interface IDECodePlaygroundProps {
  projectId?: string
  filePath?: string
  content: string
  onSave: (content: string) => void
  onChange: (content: string) => void
  onRun?: (filePath: string, mode: 'run' | 'debug') => void
  editorSettings?: EditorSettings
}

export default function IDECodePlayground({
  projectId,
  filePath,
  content,
  onSave,
  onChange,
  onRun,
  editorSettings,
}: IDECodePlaygroundProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const editorRef = useRef<any>(null)

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value)
      setIsDirty(true)
    }
  }

  const handleSave = () => {
    onSave(content)
    setIsDirty(false)
  }

  // Auto save like VS Code "afterDelay"
  useEffect(() => {
    if (!isDirty || editorSettings?.autoSaveMode !== 'afterDelay') return

    const timer = setTimeout(() => {
      handleSave()
    }, 1000)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, editorSettings?.autoSaveMode, content])

  const handleRun = async (mode: 'run' | 'debug' = 'run') => {
    if (!filePath || !projectId) {
      alert('Please select a file to run')
      return
    }

    setIsRunning(true)

    try {
      // Save file first
      await onSave(content)

      // Get file extension to determine how to run
      const ext = filePath.split('.').pop()?.toLowerCase()
      let command = ''
      const fileName = filePath.split(/[/\\]/).pop() || filePath
      const workspaceRoot = projectId ? `runtime-projects/${projectId}` : '.'

      switch (ext) {
        case 'html':
        case 'htm':
          // Open HTML file in browser using preview endpoint
          if (projectId) {
            const previewUrl = `${window.location.origin}/api/runtime/file/preview?projectId=${projectId}&path=${encodeURIComponent(filePath)}`
            window.open(previewUrl, '_blank', 'noopener,noreferrer')
            setIsRunning(false)
            return
          } else {
            alert('Project ID is required to preview HTML files')
            setIsRunning(false)
            return
          }
        case 'js':
        case 'mjs':
          command = `cd "${workspaceRoot}" && node "${filePath}"`
          break
        case 'ts':
          command = `cd "${workspaceRoot}" && npx ts-node "${filePath}"`
          break
        case 'py':
          command = mode === 'debug' 
            ? `cd "${workspaceRoot}" && python -m pdb "${filePath}"`
            : `cd "${workspaceRoot}" && python "${filePath}"`
          break
        case 'java':
          const className = fileName.replace('.java', '')
          const javaDir = filePath.substring(0, filePath.lastIndexOf('/'))
          command = `cd "${workspaceRoot}" && javac "${filePath}" && cd "${javaDir}" && java ${className}`
          break
        case 'cpp':
        case 'cxx':
        case 'cc':
          const exeName = fileName.replace(/\.[^/.]+$/, '.exe')
          command = `cd "${workspaceRoot}" && g++ "${filePath}" -o "${exeName}" && "${exeName}"`
          break
        case 'c':
          const cExeName = fileName.replace(/\.[^/.]+$/, '.exe')
          command = `cd "${workspaceRoot}" && gcc "${filePath}" -o "${cExeName}" && "${cExeName}"`
          break
        case 'go':
          command = `cd "${workspaceRoot}" && go run "${filePath}"`
          break
        case 'rs':
          const rsExe = fileName.replace(/\.[^/.]+$/, '')
          command = `cd "${workspaceRoot}" && rustc "${filePath}" && ./${rsExe}`
          break
        default:
          alert(`Cannot run ${ext} files. Please use a supported language.`)
          setIsRunning(false)
          return
      }

      // Dispatch command to terminal
      window.dispatchEvent(new CustomEvent('terminal-command', {
        detail: { projectId, command, filePath, mode },
      }))

      // Also call onRun if provided
      if (onRun) {
        onRun(filePath, mode)
      }
    } catch (error) {
      console.error('Failed to run file:', error)
      alert(`Failed to run file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsRunning(false)
    }
  }

  function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      json: 'json',
      css: 'css',
      html: 'html',
      md: 'markdown',
      py: 'python',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rs: 'rust',
      php: 'php',
      rb: 'ruby',
    }
    return langMap[ext || ''] || 'plaintext'
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Editor Header with Run Buttons */}
      <div className="h-10 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex items-center px-4 justify-between">
        <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {filePath || 'No file selected'}
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <button
              onClick={handleSave}
              className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Save
            </button>
          )}
          {filePath && (
            <>
              <button
                onClick={() => handleRun('run')}
                disabled={isRunning}
                className="px-3 py-1 text-xs font-medium bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Run (F5)"
              >
                <FiPlay className="w-3 h-3" />
                Run
              </button>
              <button
                onClick={() => handleRun('debug')}
                disabled={isRunning}
                className="px-3 py-1 text-xs font-medium bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                title="Debug (F5)"
              >
                <FiCode className="w-3 h-3" />
                Debug
              </button>
              {isRunning && (
                <button
                  onClick={() => {
                    setIsRunning(false)
                    // Send Ctrl+C to terminal
                    window.dispatchEvent(new CustomEvent('terminal-command', {
                      detail: { projectId, command: '\x03' }, // Ctrl+C
                    }))
                  }}
                  className="px-3 py-1 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors flex items-center gap-1"
                  title="Stop"
                >
                  <FiSquare className="w-3 h-3" />
                  Stop
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {filePath ? (
          <MonacoEditor
            height="100%"
            language={getLanguageFromPath(filePath)}
            value={content}
            onChange={handleChange}
            onMount={(editor) => {
              editorRef.current = editor
            }}
            theme="vs-dark"
            options={{
              minimap: { enabled: true },
              fontSize: editorSettings?.fontSize ?? 14,
              wordWrap: editorSettings?.wordWrap ? 'on' : 'off',
              automaticLayout: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  )
}