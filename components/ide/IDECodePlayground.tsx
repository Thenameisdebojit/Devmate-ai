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
  splitEditor?: boolean
  onToggleSplitEditor?: () => void
  onOpenTerminal?: () => void
}

export default function IDECodePlayground({
  projectId,
  filePath,
  content,
  onSave,
  onChange,
  onRun,
  editorSettings,
  splitEditor = false,
  onToggleSplitEditor,
  onOpenTerminal,
}: IDECodePlaygroundProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showRunDropdown, setShowRunDropdown] = useState(false)
  const editorRef = useRef<any>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowRunDropdown(false)
      }
    }

    if (showRunDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showRunDropdown])

  const handleRun = async (mode: 'run' | 'debug' = 'run') => {
    if (!filePath || !projectId) {
      alert('Please select a file to run')
      return
    }

    setIsRunning(true)

    try {
      // Save file first
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IDECodePlayground.tsx:87',message:'handleRun: Saving file',data:{filePath,hasContent:!!content,contentLength:content?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
      // #endregion
      console.log('[IDECodePlayground] handleRun: Saving file before running', { filePath, contentLength: content?.length || 0 })
      try {
        await onSave(content)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IDECodePlayground.tsx:92',message:'handleRun: File saved successfully',data:{filePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        console.log('[IDECodePlayground] File saved successfully')
      } catch (saveError: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IDECodePlayground.tsx:96',message:'handleRun: File save failed',data:{filePath,error:saveError.message||'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
        // #endregion
        console.error('[IDECodePlayground] File save failed:', saveError)
        // Continue anyway - file might already be saved
        alert(`Warning: Failed to save file: ${saveError.message || 'Unknown error'}. Continuing with run...`)
      }

      // Open terminal panel if not already open
      if (onOpenTerminal) {
        console.log('[IDECodePlayground] Opening terminal panel')
        onOpenTerminal()
      }

      // Create terminal tab if none exists (dispatch event to create new terminal)
      console.log('[IDECodePlayground] Dispatching terminal-new event')
      window.dispatchEvent(new CustomEvent('terminal-new', {
        detail: { projectId },
      }))

      // Wait longer for terminal to fully initialize (terminal needs time to connect to SSE)
      // Give it time to create tab, initialize xterm, and connect to backend
      // Increased to 3 seconds to ensure terminal is fully ready
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IDECodePlayground.tsx:120',message:'handleRun: Waiting for terminal initialization',data:{filePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
      // #endregion
      console.log('[IDECodePlayground] Waiting for terminal initialization...')
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Try to use compiler service for compilation if needed
      const ext = filePath.split('.').pop()?.toLowerCase()
      const needsCompilation = ['c', 'cpp', 'cxx', 'cc', 'java', 'ts', 'rs', 'go'].includes(ext || '')
      
      if (needsCompilation && mode === 'run') {
        // Try to build first using compiler service
        try {
          const buildResponse = await fetch('/api/compiler/build', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId }),
          })
          
          if (buildResponse.ok) {
            const buildResult = await buildResponse.json()
            if (!buildResult.success && buildResult.diagnostics && buildResult.diagnostics.length > 0) {
              // Build failed with diagnostics - show in Problems panel
              console.warn('[IDECodePlayground] Build failed:', buildResult.diagnostics)
              // Dispatch diagnostics to parent
              window.dispatchEvent(new CustomEvent('diagnostics-updated', {
                detail: { projectId, diagnostics: buildResult.diagnostics },
              }))
              setIsRunning(false)
              return
            }
          }
        } catch (error) {
          console.warn('[IDECodePlayground] Compiler service not available, using direct execution:', error)
          // Fall through to direct execution
        }
      }

      // Get file extension to determine how to run (ext already defined above)
      if (!ext) {
        alert('Cannot determine file type. Please ensure the file has an extension.')
        setIsRunning(false)
        return
      }
      
      let command = ''
      const fileName = filePath.split(/[/\\]/).pop() || filePath
      
      // Detect Windows PowerShell (terminal uses PowerShell on Windows)
      // More robust Windows detection
      const isWindows = typeof window !== 'undefined' && (
        navigator.platform.toLowerCase().includes('win') ||
        navigator.userAgent.toLowerCase().includes('windows') ||
        /win/i.test(navigator.platform)
      )
      
      // PowerShell uses `;` for command chaining, not `&&`
      // Always use PowerShell syntax on Windows to avoid && errors
      const commandSeparator = isWindows ? '; if ($?) {' : ' && '
      const commandEnd = isWindows ? '}' : ''

      // Normalize file path for Windows (use forward slashes or backslashes consistently)
      // PowerShell accepts both, but use backslashes for Windows consistency
      const normalizedPath = isWindows ? filePath.replace(/\//g, '\\') : filePath
      
      // Log for debugging
      console.log('[IDECodePlayground] Command generation:', { isWindows, filePath, normalizedPath, ext })

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
          command = `node "${normalizedPath}"`
          break
        case 'ts':
          command = `npx ts-node "${normalizedPath}"`
          break
        case 'py':
          command = mode === 'debug' 
            ? `python -m pdb "${normalizedPath}"`
            : `python "${normalizedPath}"`
          break
        case 'java':
          const className = fileName.replace(/\.java$/, '')
          const javaDir = normalizedPath.substring(0, normalizedPath.lastIndexOf(isWindows ? '\\' : '/'))
          if (isWindows) {
            command = `javac "${normalizedPath}"; if ($?) { cd "${javaDir}"; java ${className} }`
          } else {
            command = `javac "${normalizedPath}" && cd "${javaDir}" && java ${className}`
          }
          break
        case 'cpp':
        case 'cxx':
        case 'cc':
          const exeName = fileName.replace(/\.[^/.]+$/, '') + '.exe'
          if (isWindows) {
            command = `g++ "${normalizedPath}" -o "${exeName}"; if ($?) { .\\${exeName} }`
          } else {
            command = `g++ "${normalizedPath}" -o "${exeName}" && ./${exeName}`
          }
          break
        case 'c':
          const cExeName = fileName.replace(/\.[^/.]+$/, '') + '.exe'
          // Use relative path from project root (terminal is already in project root)
          const cRelativePath = filePath.replace(/^[^/\\]+[/\\]/, '') // Remove leading folder if present
          if (isWindows) {
            // Use forward slashes for paths in PowerShell (works better)
            const cPathForCmd = cRelativePath.replace(/\\/g, '/')
            const cExeForCmd = cExeName.replace(/\\/g, '/')
            command = `gcc "${cPathForCmd}" -o "${cExeForCmd}"; if ($?) { .\\${cExeForCmd} }`
          } else {
            command = `gcc "${cRelativePath}" -o "${cExeName}" && ./${cExeName}`
          }
          break
        case 'go':
          command = `go run "${normalizedPath}"`
          break
        case 'rs':
          const rsExe = fileName.replace(/\.[^/.]+$/, '')
          if (isWindows) {
            command = `rustc "${normalizedPath}"; if ($?) { .\\${rsExe}.exe }`
          } else {
            command = `rustc "${normalizedPath}" && ./${rsExe}`
          }
          break
        default:
          alert(`Cannot run ${ext} files. Please use a supported language.`)
          setIsRunning(false)
          return
      }

      // Validate command is not empty
      if (!command || command.trim() === '') {
        console.error('[IDECodePlayground] Generated empty command:', { filePath, ext, fileName })
        alert('Failed to generate command. Please check the file path and extension.')
        setIsRunning(false)
        return
      }

      // Dispatch command to terminal (with a delay to ensure terminal is ready)
      // Log the command for debugging
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IDECodePlayground.tsx:249',message:'Generated command',data:{command,commandLength:command.length,isWindows,filePath},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      console.log('[IDECodePlayground] Generated command:', { command, commandLength: command.length, isWindows, filePath })
      
      // Increase delay to ensure terminal is fully ready (2 seconds)
      setTimeout(() => {
        if (command && command.trim()) {
          // Double-check: ensure no && in Windows commands
          if (isWindows && command.includes('&&')) {
            console.error('[IDECodePlayground] ERROR: Command still contains && on Windows!', command)
            // Replace && with PowerShell syntax as fallback
            command = command.replace(/ && /g, '; if ($?) { ')
            // Add closing brace if needed
            if (command.includes('; if ($?) {') && !command.endsWith('}')) {
              command += ' }'
            }
            console.log('[IDECodePlayground] Fixed command:', command)
          }
          
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IDECodePlayground.tsx:265',message:'Dispatching terminal command',data:{command,commandLength:command.length,projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
          console.log('[IDECodePlayground] Dispatching terminal command:', { command, projectId })
          window.dispatchEvent(new CustomEvent('terminal-command', {
            detail: { projectId, command: command.trim() },
          }))
          setIsRunning(false)
        } else {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'IDECodePlayground.tsx:273',message:'Cannot dispatch empty command',data:{command,commandLength:command?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
          // #endregion
          console.error('[IDECodePlayground] Cannot dispatch empty command:', { command, commandLength: command?.length || 0 })
          alert('Failed to generate command. Please try again.')
          setIsRunning(false)
        }
      }, 2000) // Increased from 800ms to 2000ms

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
        <div className="flex items-center gap-1">
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
              {/* Run Button with Dropdown - Outline style */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowRunDropdown(!showRunDropdown)}
                  disabled={isRunning}
                  className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-gray-700 dark:text-gray-300"
                  title="Run"
                >
                  <FiPlay className="w-3 h-3" />
                  <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showRunDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg z-50 min-w-[180px]">
                    <button
                      onClick={() => {
                        handleRun('run')
                        setShowRunDropdown(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between text-gray-700 dark:text-gray-300"
                    >
                      <span>Run</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">F5</span>
                    </button>
                    <button
                      onClick={() => {
                        handleRun('debug')
                        setShowRunDropdown(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      Run as Administrator
                    </button>
                    <button
                      onClick={() => {
                        setShowRunDropdown(false)
                      }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      Run with Arguments
                    </button>
                  </div>
                )}
              </div>
              {/* Debug Button - Outline style */}
              <button
                onClick={() => handleRun('debug')}
                disabled={isRunning}
                className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-gray-700 dark:text-gray-300"
                title="Debug (F5)"
              >
                <FiCode className="w-3 h-3" />
                Debug
              </button>
              {/* Split Editor Button - Outline style */}
              {onToggleSplitEditor && (
                <button
                  onClick={onToggleSplitEditor}
                  className={`px-2 py-1 text-xs font-medium border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center text-gray-700 dark:text-gray-300 ${
                    splitEditor ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                  title={splitEditor ? 'Disable Split Editor' : 'Enable Split Editor'}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </button>
              )}
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
            onMount={(editor, monaco) => {
              editorRef.current = editor
              
              // Set up diagnostics integration
              if (projectId && filePath) {
                // Listen for diagnostics updates
                const handleDiagnostics = (event: CustomEvent) => {
                  if (event.detail.projectId === projectId) {
                    const diagnostics = event.detail.diagnostics || []
                    const fileDiagnostics = diagnostics.filter((d: any) => d.file === filePath)
                    
                    // Convert to Monaco markers
                    const markers = fileDiagnostics.map((d: any) => ({
                      severity: d.severity === 'error' ? monaco.MarkerSeverity.Error :
                               d.severity === 'warning' ? monaco.MarkerSeverity.Warning :
                               monaco.MarkerSeverity.Info,
                      startLineNumber: d.line || 1,
                      startColumn: d.column || 1,
                      endLineNumber: d.line || 1,
                      endColumn: d.column || 1000,
                      message: d.message,
                      code: d.code,
                      source: d.source,
                    }))
                    
                    const model = editor.getModel()
                    if (model) {
                      monaco.editor.setModelMarkers(model, 'compiler', markers)
                    }
                  }
                }
                
                window.addEventListener('diagnostics-updated', handleDiagnostics as EventListener)
                
                // Cleanup on unmount
                const cleanup = () => {
                  window.removeEventListener('diagnostics-updated', handleDiagnostics as EventListener)
                  const model = editor.getModel()
                  if (model) {
                    monaco.editor.setModelMarkers(model, 'compiler', [])
                  }
                }
                
                // Store cleanup function
                ;(editor as any).__diagnosticsCleanup = cleanup
              }
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