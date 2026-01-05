'use client'

/**
 * App Generator IDE Component
 * 
 * Full IDE layout with:
 * - File tree
 * - Editor
 * - Terminal
 * - AI Chat
 * - Runtime controls
 * 
 * Layout: Cursor/Replit-style
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DomainSwitcher from './DomainSwitcher'
import IDEHeader from './IDEHeader'
import IDEMenuBar from './IDEMenuBar'
import IDESidebar from './IDESidebar'
import IDEEditor, { IDEEditorRef } from './IDEEditor'
import IDETerminal from './IDETerminal'
import IDEChat from './IDEChat'
import IDERuntimeControls from './IDERuntimeControls'
import ThemeToggle from '@/app/components/ThemeToggle'
import { getWorkspaceDaemon as getCoreWorkspaceDaemon, getAgentObserver, getAgentActionHandler, getAgentPlanExecutor, getAgentConfidenceEngine, type AgentPlan } from '@/core/workspace'

interface AppGeneratorIDEProps {
  projectId?: string
}

export default function AppGeneratorIDE({ projectId: initialProjectId }: AppGeneratorIDEProps) {
  const router = useRouter()
  const [projectId, setProjectId] = useState<string | undefined>(initialProjectId)
  const [files, setFiles] = useState<any[]>([])
  const [activeFile, setActiveFile] = useState<string | undefined>()
  const [fileContent, setFileContent] = useState<string>('')
  const [runtimeState, setRuntimeState] = useState<any>(null)
  const [confidenceReport, setConfidenceReport] = useState<any>(null)
  const [aiMessages, setAiMessages] = useState<any[]>([])
  const [workspaceInitialized, setWorkspaceInitialized] = useState(false) // TASK 2: Track initialization
  const [showSidebar, setShowSidebar] = useState(true)
  const [showTerminal, setShowTerminal] = useState(true)
  const [showExplorer, setShowExplorer] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [showDebugConsole, setShowDebugConsole] = useState(false)
  const [wordWrap, setWordWrap] = useState(false)
  const editorRef = useRef<IDEEditorRef>(null)

  // TASK 2: Workspace Bootstrap - Initialize workspace on mount
  useEffect(() => {
    if (!projectId) {
      // Generate project ID if not provided
      const generatedId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`
      setProjectId(generatedId)
      return
    }

    const initializeWorkspace = async () => {
      try {
        const response = await fetch('/api/workspace/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            mode: 'app-generator',
          }),
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Failed to initialize workspace')
        }

        const data = await response.json()
        
        // Only enable UI after workspace is initialized
        if (data.initialized === true) {
          setWorkspaceInitialized(true)
          console.log('[AppGeneratorIDE] Workspace initialized:', data)
        } else {
          throw new Error('Workspace initialization failed')
        }
      } catch (error) {
        console.error('[AppGeneratorIDE] Failed to initialize workspace:', error)
        setAiMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            type: 'error',
            content: `Failed to initialize workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now(),
          },
        ])
      }
    }

    initializeWorkspace()
  }, [projectId])

  // TASK 7: Load files (only after workspace initialized) - MOVED BEFORE useEffect to fix ReferenceError
  const loadFiles = useCallback(async () => {
    if (!projectId || !workspaceInitialized) return

    try {
      const response = await fetch(`/api/runtime/file/list?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setFiles(data.files || [])
      }
    } catch (error) {
      console.error('Failed to load files:', error)
    }
  }, [projectId, workspaceInitialized])

  // Initialize workspace daemon (only after workspace is initialized)
  useEffect(() => {
    if (!projectId || !workspaceInitialized) return

    const daemon = getCoreWorkspaceDaemon(projectId)
    const observer = getAgentObserver(projectId)
    const actionHandler = getAgentActionHandler(projectId)
    const planExecutor = getAgentPlanExecutor(projectId)
    const confidenceEngine = getAgentConfidenceEngine(projectId)

    // Get initial confidence
    const initialReport = confidenceEngine.getCurrentReport()
    setConfidenceReport({
      confidenceScore: initialReport.confidenceScore,
      confidenceLevel: initialReport.confidenceLevel,
      riskLevel: initialReport.riskLevel,
      reasons: initialReport.reasons,
    })

    // Subscribe to confidence updates
    const handleConfidenceUpdate = (report: any) => {
      setConfidenceReport({
        confidenceScore: report.confidenceScore,
        confidenceLevel: report.confidenceLevel,
        riskLevel: report.riskLevel,
        reasons: report.reasons,
      })
    }
    confidenceEngine.on('confidenceUpdated', handleConfidenceUpdate)

    // Subscribe to events
    const eventBus = daemon.getEventBus()
    
    const handleObservation = (payload: any) => {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `obs-${payload.id}`,
          type: 'observation',
          content: payload.message,
          timestamp: payload.timestamp,
        },
      ])
    }

    const handleSuggestion = (payload: any) => {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `suggestion-${payload.id}`,
          type: 'suggestion',
          content: payload.message,
          timestamp: payload.timestamp,
          category: payload.category,
        },
      ])
    }

    const handlePlanProposed = (payload: any) => {
      const { plan } = payload
      planExecutor.registerPlan(plan)
      setAiMessages((prev) => [
        ...prev,
        {
          id: `plan-${plan.planId}`,
          type: 'plan',
          content: `Plan: ${plan.title}\n\n${plan.summary}`,
          timestamp: plan.createdAt,
          plan,
        },
      ])
    }

    const handleFileChanged = (payload: any) => {
      if (payload.path === activeFile) {
        setFileContent(payload.content)
      }
      // TASK D: Refresh file tree on FILE_CHANGED
      loadFiles()
    }

    // TASK 7: Subscribe to FILE_SAVED and WORKSPACE_CHANGED events to refresh file tree
    const handleFileSaved = (payload: any) => {
      // Refresh file list when files are saved
      loadFiles()
    }

    const handleWorkspaceChanged = (payload: any) => {
      // TASK 7: Refresh file tree on workspace change
      loadFiles()
    }

    eventBus.on('AGENT_OBSERVATION', handleObservation)
    eventBus.on('AGENT_SUGGESTION', handleSuggestion)
    eventBus.on('AGENT_PLAN_PROPOSED', handlePlanProposed)
    eventBus.on('FILE_CHANGED', handleFileChanged)
    eventBus.on('FILE_SAVED', handleFileSaved) // TASK 7: Subscribe to FILE_SAVED
    eventBus.on('WORKSPACE_CHANGED', handleWorkspaceChanged) // TASK 7: Subscribe to WORKSPACE_CHANGED

    return () => {
      eventBus.off('AGENT_OBSERVATION', handleObservation)
      eventBus.off('AGENT_SUGGESTION', handleSuggestion)
      eventBus.off('AGENT_PLAN_PROPOSED', handlePlanProposed)
      eventBus.off('FILE_CHANGED', handleFileChanged)
      eventBus.off('FILE_SAVED', handleFileSaved) // TASK 7: Unsubscribe from FILE_SAVED
      eventBus.off('WORKSPACE_CHANGED', handleWorkspaceChanged) // TASK 7: Unsubscribe from WORKSPACE_CHANGED
      confidenceEngine.off('confidenceUpdated', handleConfidenceUpdate)
    }
  }, [projectId, activeFile, workspaceInitialized, loadFiles])

  // TASK 7: Load files on mount (after initialization)
  useEffect(() => {
    if (workspaceInitialized) {
      loadFiles()
    }
  }, [loadFiles, workspaceInitialized])

  // Listen for folder upload events
  useEffect(() => {
    const handleFolderUploaded = () => {
      loadFiles()
    }
    window.addEventListener('workspace-folder-uploaded', handleFolderUploaded)
    return () => window.removeEventListener('workspace-folder-uploaded', handleFolderUploaded)
  }, [loadFiles])

  // Load file content
  const loadFileContent = useCallback(async (filePath: string) => {
    if (!projectId) return

    try {
      const response = await fetch(`/api/runtime/file/read?projectId=${projectId}&path=${encodeURIComponent(filePath)}`)
      if (response.ok) {
        const data = await response.json()
        setFileContent(data.content || '')
      }
    } catch (error) {
      console.error('Failed to load file content:', error)
    }
  }, [projectId])

  // Handle file selection
  const handleFileSelect = useCallback((filePath: string) => {
    setActiveFile(filePath)
    loadFileContent(filePath)
  }, [loadFileContent])

  // Handle file save (via API route to avoid client-side Node.js imports)
  const handleFileSave = useCallback(async (filePath: string, content: string) => {
    if (!projectId) return

    try {
      const response = await fetch('/api/runtime/file/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filePath,
          content,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setFileContent(content)
        } else {
          console.error('Failed to save file:', data.error)
        }
      } else {
        const error = await response.json()
        console.error('Failed to save file:', error.error)
      }
    } catch (error) {
      console.error('Failed to save file:', error)
    }
  }, [projectId])

  // Load runtime state
  useEffect(() => {
    if (!projectId) return

    const fetchRuntimeState = async () => {
      try {
        const response = await fetch(`/api/runtime/status?projectId=${projectId}`)
        if (response.ok) {
          const data = await response.json()
          setRuntimeState(data.state)
        }
      } catch (error) {
        console.error('Failed to fetch runtime state:', error)
      }
    }

    fetchRuntimeState()
    const interval = setInterval(fetchRuntimeState, 2000)
    return () => clearInterval(interval)
  }, [projectId])

  // Handle plan approval
  const handlePlanApproved = useCallback((planId: string) => {
    if (!projectId) return

    const daemon = getCoreWorkspaceDaemon(projectId)
    daemon.getEventBus().emit({
      type: 'AGENT_PLAN_APPROVED',
      payload: { planId },
    } as any)
  }, [projectId])

  // Handle step approval
  const handleStepApproved = useCallback((planId: string, stepId: string) => {
    if (!projectId) return

    const daemon = getCoreWorkspaceDaemon(projectId)
    daemon.getEventBus().emit({
      type: 'AGENT_PLAN_STEP_APPROVED',
      payload: { planId, stepId },
    } as any)
  }, [projectId])

  // Handle user prompt (TASK B: Wire to agent execution API)
  const handleUserPrompt = useCallback(async (prompt: string) => {
    if (!projectId) return

    // Add user message
    setAiMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        type: 'user',
        content: prompt,
        timestamp: Date.now(),
      },
    ])

    // Send to agent execution API (TASK B: POST /api/agent/execute)
    try {
      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          projectId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to execute agent')
      }

      // Stream execution events (TASK B: Stream agent responses)
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                
                // Handle execution events
                switch (event.type) {
                  case 'GENERATION_STARTED':
                  case 'GENERATION_PROGRESS':
                  case 'PLAN_PROPOSED':
                  case 'STEP_COMPLETED':
                    setAiMessages((prev) => [
                      ...prev,
                      {
                        id: `event-${Date.now()}`,
                        type: 'observation',
                        content: event.payload.message || JSON.stringify(event.payload),
                        timestamp: Date.now(),
                      },
                    ])
                    break
                  case 'EXECUTION_ERROR':
                    setAiMessages((prev) => [
                      ...prev,
                      {
                        id: `error-${Date.now()}`,
                        type: 'error',
                        content: event.payload.error,
                        timestamp: Date.now(),
                      },
                    ])
                    break
                  case 'RUNTIME_STARTED':
                    // TASK C: Runtime auto-start (already handled by router)
                    setRuntimeState((prev: any) => ({
                      ...prev,
                      status: 'running',
                    }))
                    break
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to execute agent:', error)
      setAiMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          type: 'error',
          content: error instanceof Error ? error.message : 'Failed to execute agent',
          timestamp: Date.now(),
        },
      ])
    }
  }, [projectId])

  // Menu handlers
  const handleNewFile = useCallback(() => {
    const newFileName = `untitled-${Date.now()}.txt`
    setActiveFile(newFileName)
    setFileContent('')
  }, [])

  const handleOpenFile = useCallback(() => {
    // File input is handled by IDEMenuBar
  }, [])

  const handleOpenFolder = useCallback(() => {
    // Folder input is handled by IDEMenuBar
  }, [])

  const handleSave = useCallback(() => {
    if (activeFile) {
      handleFileSave(activeFile, fileContent)
    }
  }, [activeFile, fileContent, handleFileSave])

  const handleSaveAs = useCallback(() => {
    const newName = prompt('Enter new file name:')
    if (newName && projectId) {
      handleFileSave(newName, fileContent)
      setActiveFile(newName)
    }
  }, [fileContent, projectId, handleFileSave])

  const handleClose = useCallback(() => {
    setActiveFile(undefined)
    setFileContent('')
  }, [])

  const handleGoToLine = useCallback(() => {
    const line = prompt('Enter line number:')
    if (line) {
      const lineNum = parseInt(line, 10)
      if (!isNaN(lineNum)) {
        editorRef.current?.goToLine(lineNum)
      }
    }
  }, [])

  const handleGoToFile = useCallback(() => {
    const fileName = prompt('Enter file name to open:')
    if (fileName) {
      const file = files.find(f => f.path.includes(fileName))
      if (file) {
        handleFileSelect(file.path)
      }
    }
  }, [files, handleFileSelect])

  const handleStartDebugging = useCallback(async () => {
    if (!projectId) return
    try {
      const response = await fetch('/api/runtime/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files: [] }),
      })
      if (response.ok) {
        console.log('Debugging started')
      }
    } catch (error) {
      console.error('Failed to start debugging:', error)
    }
  }, [projectId])

  const handleRunWithoutDebugging = useCallback(async () => {
    if (!projectId) return
    try {
      const response = await fetch('/api/runtime/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, files: [] }),
      })
      if (response.ok) {
        console.log('Running without debugging')
      }
    } catch (error) {
      console.error('Failed to run:', error)
    }
  }, [projectId])

  const handleStop = useCallback(async () => {
    if (!projectId) return
    try {
      const response = await fetch('/api/runtime/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })
      if (response.ok) {
        console.log('Stopped')
      }
    } catch (error) {
      console.error('Failed to stop:', error)
    }
  }, [projectId])

  const handleNewTerminal = useCallback(() => {
    setShowTerminal(true)
    // Force terminal to reconnect by dispatching event
    window.dispatchEvent(new CustomEvent('terminal-new', { detail: { projectId } }))
  }, [projectId])

  const handleSplitTerminal = useCallback(() => {
    // Terminal component handles split terminal
  }, [])

  const handleRunTask = useCallback(() => {
    // Task running is handled by terminal
  }, [])

  const handleCommandPalette = useCallback(() => {
    alert('Command Palette - Press Ctrl+Shift+P')
  }, [])

  const handleWelcome = useCallback(() => {
    router.push('/')
  }, [router])

  const handleAbout = useCallback(() => {
    alert('Devmate AI - App Generator IDE\nVersion 2.0.0')
  }, [])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with Domain Switcher and Theme Toggle */}
      <IDEHeader>
        <DomainSwitcher currentDomain="app-generator" />
        <ThemeToggle />
      </IDEHeader>

      {/* Menu Bar */}
      <IDEMenuBar
        projectId={projectId}
        onNewFile={handleNewFile}
        onOpenFile={handleOpenFile}
        onOpenFolder={handleOpenFolder}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onClose={handleClose}
        onUndo={() => editorRef.current?.undo()}
        onRedo={() => editorRef.current?.redo()}
        onCut={() => editorRef.current?.cut()}
        onCopy={() => editorRef.current?.copy()}
        onPaste={() => editorRef.current?.paste()}
        onFind={() => editorRef.current?.find()}
        onReplace={() => editorRef.current?.replace()}
        onFindInFiles={() => setShowSearch(true)}
        onGoToFile={handleGoToFile}
        onGoToSymbol={() => handleCommandPalette()}
        onGoToLine={handleGoToLine}
        onStartDebugging={handleStartDebugging}
        onRunWithoutDebugging={handleRunWithoutDebugging}
        onStop={handleStop}
        onNewTerminal={handleNewTerminal}
        onSplitTerminal={handleSplitTerminal}
        onRunTask={handleRunTask}
        onToggleSidebar={() => setShowSidebar(!showSidebar)}
        onToggleTerminal={() => setShowTerminal(!showTerminal)}
        onToggleExplorer={() => setShowExplorer(!showExplorer)}
        onToggleSearch={() => setShowSearch(!showSearch)}
        onToggleProblems={() => setShowProblems(!showProblems)}
        onToggleOutput={() => setShowOutput(!showOutput)}
        onToggleDebugConsole={() => setShowDebugConsole(!showDebugConsole)}
        onWordWrap={() => setWordWrap(!wordWrap)}
        onAppearance={() => handleCommandPalette()}
        onCommandPalette={handleCommandPalette}
        onWelcome={handleWelcome}
        onAbout={handleAbout}
      />

      {/* Main IDE Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar: Files */}
        {showSidebar && showExplorer && (
          <IDESidebar
            files={files}
            selectedFile={activeFile}
            onFileSelect={handleFileSelect}
          />
        )}

        {/* Center: Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <IDEEditor
            ref={editorRef}
            filePath={activeFile}
            content={fileContent}
            onSave={(content) => activeFile && handleFileSave(activeFile, content)}
            onChange={setFileContent}
          />
        </div>

        {/* Right Sidebar: Terminal, Chat, Runtime */}
        <div className="w-96 flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-800">
          {/* Terminal */}
          <IDETerminal
            projectId={projectId}
            className="h-64 flex-shrink-0 border-b border-gray-200 dark:border-gray-800"
          />

          {/* AI Chat */}
          <IDEChat
            messages={aiMessages}
            confidenceReport={confidenceReport}
            onSend={handleUserPrompt}
            onPlanApproved={handlePlanApproved}
            onStepApproved={handleStepApproved}
            className="flex-1 min-h-0"
            disabled={!workspaceInitialized} // TASK 2: Disable until workspace initialized
          />

          {/* Runtime Controls */}
          <IDERuntimeControls
            projectId={projectId}
            runtimeState={runtimeState}
            className="h-32 flex-shrink-0 border-t border-gray-200 dark:border-gray-800"
          />
        </div>
      </div>
    </div>
  )
}

