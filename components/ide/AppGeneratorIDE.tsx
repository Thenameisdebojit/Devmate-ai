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
import IDECodePlayground from './IDECodePlayground'
import IDETerminalPanel from './IDETerminalPanel'
import IDEBottomPanel from './IDEBottomPanel'
import IDEChat from './IDEChat'
import IDERuntimeControls from './IDERuntimeControls'
import IDEActivityBar from './IDEActivityBar'
import IDESourceControl from './IDESourceControl'
import IDEResizablePanel from './IDEResizablePanel'
import IDESettingsPanel, { type EditorSettings } from './IDESettingsPanel'
import ThemeToggle from '@/app/components/ThemeToggle'
import ConfirmationDialog from './ConfirmationDialog'
import { getWorkspaceDaemon as getCoreWorkspaceDaemon, getAgentObserver, getAgentActionHandler, getAgentPlanExecutor, getAgentConfidenceEngine, type AgentPlan } from '@/core/workspace'
import { sessionManager, type AgentSession } from '@/lib/ide/AgentSession'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'
import type { ConfidenceReport } from '@/core/workspace/AgentConfidenceEngine'

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
  const [confidenceReport, setConfidenceReport] = useState<ConfidenceReport | null>(null) // PHASE 6: Typed confidence report
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean
    intent: ExecutionIntent | null
    confidenceReport: ConfidenceReport | null
  }>({
    isOpen: false,
    intent: null,
    confidenceReport: null,
  })
  const [aiMessages, setAiMessages] = useState<any[]>([])
  const [workspaceInitialized, setWorkspaceInitialized] = useState(false) // TASK 2: Track initialization
  const [isProcessing, setIsProcessing] = useState(false) // PHASE 1: Track agent execution
  const [agentState, setAgentState] = useState<'idle' | 'thinking' | 'acting' | 'done' | 'error'>('idle') // PHASE 7: Agent state
  const [agentMessage, setAgentMessage] = useState<string>('') // PHASE 7: Current agent action
  const [showBottomPanel, setShowBottomPanel] = useState<boolean>(true) // Bottom panel visibility
  const [currentDomain, setCurrentDomain] = useState<string>('app-generator') // PHASE 1: Track domain for session scoping
  const [aiModifiedFiles, setAiModifiedFiles] = useState<Set<string>>(new Set()) // PHASE 1: Track AI-modified files
  const [showSidebar, setShowSidebar] = useState(true)
  const [showTerminal, setShowTerminal] = useState(false) // Terminal hidden by default
  const [showExplorer, setShowExplorer] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [showDebugConsole, setShowDebugConsole] = useState(false)
  const [wordWrap, setWordWrap] = useState(false)
  const [activeView, setActiveView] = useState<'explorer' | 'search' | 'source-control' | 'run' | 'extensions'>('explorer')
  const [sidebarWidth, setSidebarWidth] = useState(256)
  const [chatWidth, setChatWidth] = useState(384)
  const [gitStatus, setGitStatus] = useState<any>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    fontSize: 14,
    wordWrap: false,
    autoSaveMode: 'off',
  })

  // Load settings from localStorage
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('appGeneratorEditorSettings')
      if (stored) {
        const parsed = JSON.parse(stored)
        setEditorSettings((prev) => ({
          ...prev,
          ...parsed,
        }))
      }
    } catch {
      // ignore
    }
  }, [])

  // Persist settings
  useEffect(() => {
    try {
      window.localStorage.setItem('appGeneratorEditorSettings', JSON.stringify(editorSettings))
    } catch {
      // ignore
    }
  }, [editorSettings])

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
      // PHASE 1: Track AI-modified files
      if (payload.modifiedByAI) {
        setAiModifiedFiles((prev) => new Set(prev).add(payload.path))
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

  // Fetch Git status
  useEffect(() => {
    if (!projectId) return

    const fetchGitStatus = async () => {
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

    fetchGitStatus()
    const interval = setInterval(fetchGitStatus, 10000)
    return () => clearInterval(interval)
  }, [projectId])

  // Handle view change
  const handleViewChange = (view: 'explorer' | 'search' | 'source-control' | 'run' | 'extensions') => {
    setActiveView(view)
    if (view === 'explorer') {
      setShowExplorer(true)
      setShowSearch(false)
    } else if (view === 'search') {
      setShowSearch(true)
      setShowExplorer(false)
    } else if (view === 'source-control') {
      setShowExplorer(false)
      setShowSearch(false)
    }
    setShowSidebar(true)
  }

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
    if (!projectId) {
      alert('Project ID is required to save files')
      return
    }

    // Ensure workspace is initialized before saving
    if (!workspaceInitialized) {
      // Try to initialize workspace first
      try {
        const initResponse = await fetch('/api/workspace/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            mode: 'app-generator',
          }),
        })

        if (!initResponse.ok) {
          const error = await initResponse.json()
          throw new Error(error.error || 'Failed to initialize workspace')
        }

        const initData = await initResponse.json()
        if (initData.initialized === true) {
          setWorkspaceInitialized(true)
        } else {
          throw new Error('Workspace initialization failed')
        }
      } catch (error) {
        alert(`Cannot save file: Workspace not initialized. ${error instanceof Error ? error.message : 'Unknown error'}`)
        return
      }
    }

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
          // Refresh file list to show updated file
          loadFiles()
        } else {
          console.error('Failed to save file:', data.error)
          alert(`Failed to save file: ${data.error || 'Unknown error'}`)
        }
      } else {
        const error = await response.json()
        console.error('Failed to save file:', error.error)
        alert(`Failed to save file: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to save file:', error)
      alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }, [projectId, workspaceInitialized, loadFiles])

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

  // PHASE 1: Session-scoped chat initialization
  useEffect(() => {
    if (!projectId || !currentDomain) return

    // Get or create session
    const session = sessionManager.getSession(currentDomain, projectId) || 
                    sessionManager.createSession(currentDomain, projectId)
    
    // Load messages from session
    setAiMessages(session.messages.map((msg) => ({
      id: msg.id,
      type: msg.type,
      content: msg.content,
      timestamp: msg.timestamp,
      intent: msg.intent,
      metadata: msg.metadata,
    })))
  }, [projectId, currentDomain])

  // PHASE 1: Handle command with ExecutionIntent
  const handleCommand = useCallback(async (intent: ExecutionIntent) => {
    if (!projectId || !currentDomain) {
      alert('Project ID is required to execute commands')
      return
    }

    // Ensure workspace is initialized before executing agent commands
    if (!workspaceInitialized) {
      // Try to initialize workspace first
      try {
        setAgentState('thinking')
        setAgentMessage('Initializing workspace...')
        
        const initResponse = await fetch('/api/workspace/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            mode: 'app-generator',
          }),
        })

        if (!initResponse.ok) {
          const error = await initResponse.json()
          throw new Error(error.error || 'Failed to initialize workspace')
        }

        const initData = await initResponse.json()
        if (initData.initialized === true) {
          setWorkspaceInitialized(true)
          setAgentState('idle')
          setAgentMessage('')
        } else {
          throw new Error('Workspace initialization failed')
        }
      } catch (error) {
        setAgentState('error')
        setAgentMessage(`Workspace not initialized: ${error instanceof Error ? error.message : 'Unknown error'}`)
        const errorMessage = sessionManager.addMessage(currentDomain, projectId, {
          type: 'error',
          content: `Cannot execute command: Workspace not initialized. ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        setAiMessages((prev) => [...prev, errorMessage])
        setIsProcessing(false)
        setTimeout(() => {
          setAgentState('idle')
          setAgentMessage('')
        }, 5000)
        return
      }
    }

    // PHASE 6: Check confidence before risky actions
    const { getAgentConfidenceEngine } = await import('@/core/workspace/AgentConfidenceEngine')
    const confidenceEngine = getAgentConfidenceEngine(projectId)
    const currentConfidence = confidenceEngine.getCurrentReport()
    
    // Check if this is a risky action
    const isRiskyAction = intent.type === 'mutate' || intent.type === 'fix' || intent.type === 'generate'
    const needsConfirmation = isRiskyAction && 
      (currentConfidence.confidenceLevel === 'LOW' || currentConfidence.riskLevel === 'HIGH')

    if (needsConfirmation && currentConfidence.riskLevel === 'HIGH' && currentConfidence.confidenceLevel === 'LOW') {
      // Show confirmation dialog
      setConfirmationDialog({
        isOpen: true,
        intent,
        confidenceReport: currentConfidence,
      })
      return // Don't proceed until user confirms
    }

    setIsProcessing(true)

    // Get or create session
    const session = sessionManager.getSession(currentDomain, projectId) || 
                    sessionManager.createSession(currentDomain, projectId)

    // Add user message to session
    const userMessage = sessionManager.addMessage(currentDomain, projectId, {
      type: 'user',
      content: intent.description,
      intent,
    })

    // Update UI
    setAiMessages((prev) => [...prev, userMessage])

    // Send to agent execution API with intent
    try {
      const response = await fetch('/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          sessionId: session.id,
          executionIntent: intent, // PHASE 1: Send intent, not just prompt
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to execute agent' }))
        throw new Error(errorData.error || 'Failed to execute agent')
      }

      // Stream execution events
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
                  case 'AGENT_THINKING':
                    // PHASE 7: Update agent state
                    setAgentState('thinking')
                    setAgentMessage(event.payload.message || 'Analyzing...')
                    break
                  case 'AGENT_ACTION':
                    // PHASE 7: Update agent state
                    setAgentState('acting')
                    setAgentMessage(event.payload.details?.message || event.payload.action || 'Working...')
                    // PHASE 4: Show checkpoint messages
                    if (event.payload.action === 'create_checkpoint') {
                      const checkpointMessage = sessionManager.addMessage(currentDomain, projectId, {
                        type: 'system',
                        content: `✓ ${event.payload.details.message || 'Checkpoint created'}`,
                      })
                      setAiMessages((prev) => [...prev, checkpointMessage])
                    }
                    break
                  case 'AGENT_DONE':
                    // PHASE 7: Update agent state
                    setAgentState('done')
                    setAgentMessage(event.payload.message || 'Completed')
                    // Auto-reset to idle after 2 seconds
                    setTimeout(() => {
                      setAgentState('idle')
                      setAgentMessage('')
                    }, 2000)
                    break
                  case 'AGENT_ERROR':
                    // PHASE 7: Update agent state
                    setAgentState('error')
                    setAgentMessage(event.payload.error || 'Error occurred')
                    const errorMsg = sessionManager.addMessage(currentDomain, projectId, {
                      type: 'error',
                      content: event.payload.error,
                    })
                    setAiMessages((prev) => [...prev, errorMsg])
                    // Auto-reset to idle after 3 seconds
                    setTimeout(() => {
                      setAgentState('idle')
                      setAgentMessage('')
                    }, 3000)
                    break
                  case 'GENERATION_STARTED':
                  case 'GENERATION_PROGRESS':
                  case 'PLAN_PROPOSED':
                  case 'STEP_COMPLETED':
                    const obsMessage = sessionManager.addMessage(currentDomain, projectId, {
                      type: 'observation',
                      content: event.payload.message || JSON.stringify(event.payload),
                    })
                    setAiMessages((prev) => [...prev, obsMessage])
                    break
                  case 'EXECUTION_ERROR':
                    setAgentState('error')
                    setAgentMessage(event.payload.error || 'Execution error')
                    const execErrorMessage = sessionManager.addMessage(currentDomain, projectId, {
                      type: 'error',
                      content: event.payload.error,
                    })
                    setAiMessages((prev) => [...prev, execErrorMessage])
                    break
                  case 'RUNTIME_STARTED':
                    setRuntimeState((prev: any) => ({
                      ...prev,
                      status: 'running',
                    }))
                    break
                  case 'FILE_CHANGED':
                    // PHASE 1: Track AI-modified files
                    if (event.payload.path) {
                      setAiModifiedFiles((prev) => new Set(prev).add(event.payload.path))
                    }
                    // PHASE 5: Schedule runtime restart on file change
                    if (projectId && runtimeState?.status === 'running') {
                      fetch('/api/runtime/restart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                          projectId,
                          filePath: event.payload.path,
                        }),
                      }).catch(err => console.error('Failed to schedule restart:', err))
                    }
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
      
      // PHASE -1: Provide helpful error messages
      let errorContent = 'Failed to execute agent'
      if (error instanceof Error) {
        errorContent = error.message
        // Provide context-specific help
        if (error.message.includes('empty') || error.message.includes('no files')) {
          errorContent = `${error.message}\n\n💡 Tip: Try describing what you want to build, e.g., "build a simple calculator website"`
        } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
          errorContent = `${error.message}\n\n💡 Tip: Describe what you want to build in natural language, e.g., "create a todo app" or "build a snake game"`
        } else if (error.message.includes('No files were generated') || error.message.includes('No valid files')) {
          errorContent = `${error.message}\n\n💡 Tip: Try being more specific, e.g., "build a simple calculator website using HTML, CSS, and JavaScript"`
        } else if (error.message.includes('Workspace not initialized')) {
          errorContent = `${error.message}\n\n💡 Tip: The workspace is initializing. Please wait a moment and try again.`
        }
      }
      
      const errorMessage = sessionManager.addMessage(currentDomain, projectId, {
        type: 'error',
        content: errorContent,
      })
      setAiMessages((prev) => [...prev, errorMessage])
      setAgentState('error')
      setAgentMessage(errorContent)
      setTimeout(() => {
        setAgentState('idle')
        setAgentMessage('')
      }, 5000)
    } finally {
      setIsProcessing(false)
    }
  }, [projectId, currentDomain])

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
        // Go to line is handled by Monaco editor internally via keyboard shortcut
        // This is just a placeholder for the menu action
        console.log('Go to line:', lineNum)
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
    // Dispatch event to create new terminal
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

  // PHASE 4: Handle project rollback
  // PHASE 6: Handle confirmation dialog
  const handleConfirmAction = useCallback(() => {
    if (!confirmationDialog.intent) return
    
    setConfirmationDialog({ isOpen: false, intent: null, confidenceReport: null })
    // Proceed with the action
    handleCommand(confirmationDialog.intent)
  }, [confirmationDialog.intent, handleCommand])

  const handleCancelAction = useCallback(() => {
    setConfirmationDialog({ isOpen: false, intent: null, confidenceReport: null })
  }, [])

  const handleRollbackProject = useCallback(async () => {
    if (!projectId) {
      alert('No project selected')
      return
    }

    if (!confirm('Rollback entire project to last checkpoint? This will revert all files to their previous state.')) {
      return
    }

    try {
      const response = await fetch('/api/checkpoint/rollback-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to rollback project')
      }

      const data = await response.json()
      
      // Add rollback message to chat
      const rollbackMessage = sessionManager.addMessage(currentDomain, projectId, {
        type: 'system',
        content: `✓ Project rolled back to checkpoint. ${data.filesRolledBack?.length || 0} file(s) reverted.`,
      })
      setAiMessages((prev) => [...prev, rollbackMessage])

      // Refresh files
      loadFiles()

      // Clear AI-modified files (they've been rolled back)
      setAiModifiedFiles(new Set())
    } catch (error: any) {
      alert(`Rollback failed: ${error.message}`)
    }
  }, [projectId, currentDomain, loadFiles, sessionManager])

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header with Domain Switcher and Theme Toggle */}
      <IDEHeader>
        <DomainSwitcher 
          currentDomain={currentDomain}
          onDomainChange={(newDomain) => {
            // PHASE 1: Reset UI state on domain switch
            if (newDomain !== currentDomain && projectId) {
              // Clear session for old domain
              sessionManager.clearSession(currentDomain, projectId)
              // Reset messages
              setAiMessages([])
              setAiModifiedFiles(new Set())
              setIsProcessing(false)
              // Update domain
              setCurrentDomain(newDomain)
            }
          }}
        />
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
        onUndo={() => {
          // Editor operations handled by IDECodePlayground
        }}
        onRedo={() => {}}
        onCut={() => {}}
        onCopy={() => {}}
        onPaste={() => {}}
        onFind={() => {}}
        onReplace={() => {}}
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
        onToggleTerminal={() => {
          setShowBottomPanel(!showBottomPanel)
          if (!showBottomPanel) {
            setBottomPanelTab('terminal')
          }
        }}
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
        onRollbackProject={handleRollbackProject}
      />

      {/* Main IDE Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Activity Bar */}
        <IDEActivityBar
          activeView={activeView}
          onViewChange={handleViewChange}
          gitStatus={gitStatus}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Left Sidebar: Files/Search/Source Control */}
        {showSidebar && (
          <IDEResizablePanel
            defaultWidth={sidebarWidth}
            minWidth={200}
            maxWidth={600}
            onResize={setSidebarWidth}
          >
            {activeView === 'explorer' && (
              <IDESidebar
                files={files}
                selectedFile={activeFile}
                onFileSelect={handleFileSelect}
                projectId={projectId}
                onFilesChange={loadFiles}
                aiModifiedFiles={aiModifiedFiles}
                onCreateFile={async (filePath: string) => {
                  try {
                    const response = await fetch('/api/runtime/file/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectId, filePath, content: '' }),
                    })
                    if (response.ok) {
                      loadFiles()
                      handleFileSelect(filePath)
                    } else {
                      const error = await response.json()
                      alert(error.error || 'Failed to create file')
                    }
                  } catch (error) {
                    console.error('Create file error:', error)
                    alert('Failed to create file')
                  }
                }}
                onCreateFolder={async (folderPath: string) => {
                  try {
                    const response = await fetch('/api/runtime/folder/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ projectId, folderPath }),
                    })
                    if (response.ok) {
                      loadFiles()
                    } else {
                      const error = await response.json()
                      alert(error.error || 'Failed to create folder')
                    }
                  } catch (error) {
                    console.error('Create folder error:', error)
                    alert('Failed to create folder')
                  }
                }}
              />
            )}
            {activeView === 'search' && (
              <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Search functionality coming soon
                </div>
              </div>
            )}
            {activeView === 'source-control' && (
              <IDESourceControl projectId={projectId} />
            )}
            {activeView === 'run' && (
              <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Run and Debug panel coming soon
                </div>
              </div>
            )}
            {activeView === 'extensions' && (
              <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                  Extensions panel coming soon
                </div>
              </div>
            )}
          </IDEResizablePanel>
        )}

        {/* Center: Code Playground with Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          <IDECodePlayground
            projectId={projectId}
            filePath={activeFile}
            content={fileContent}
            onSave={(content) => {
              if (activeFile) {
                handleFileSave(activeFile, content)
              } else {
                alert('No file selected. Please select a file or create a new one first.')
              }
            }}
            onChange={setFileContent}
            editorSettings={editorSettings}
            onRun={(filePath, mode) => {
              // Dispatch command to terminal
              window.dispatchEvent(new CustomEvent('terminal-command', {
                detail: { projectId, filePath, mode },
              }))
            }}
          />
        </div>

        {/* Right Sidebar: Chat, Runtime (Resizable) */}
        <IDEResizablePanel
          defaultWidth={chatWidth}
          minWidth={250}
          maxWidth={600}
          onResize={setChatWidth}
        >
          <div className="h-full flex flex-col border-l border-gray-200 dark:border-gray-800">
            {/* AI Chat */}
            <div className="flex-1 min-h-0">
              <IDEChat
                messages={aiMessages}
                confidenceReport={confidenceReport}
                onCommand={handleCommand}
                onPlanApproved={handlePlanApproved}
                onStepApproved={handleStepApproved}
                className="h-full"
                disabled={!workspaceInitialized}
                isProcessing={isProcessing}
                agentState={agentState}
                agentMessage={agentMessage}
              />
            </div>

            {/* Runtime Controls */}
            <IDERuntimeControls
              projectId={projectId}
              runtimeState={runtimeState}
              className="h-32 flex-shrink-0 border-t border-gray-200 dark:border-gray-800"
            />
          </div>
        </IDEResizablePanel>
      </div>

      {/* PHASE 5: Bottom Panel (Terminal / Preview / Console) */}
      <IDEBottomPanel
        projectId={projectId}
        previewUrl={runtimeState?.previewUrl}
        previewStatus={runtimeState?.previewStatus}
        runtimeState={runtimeState}
        buildErrors={runtimeState?.buildErrors || []}
        onErrorClick={(file, line) => {
          // Open file at line
          handleFileSelect(file)
          // TODO: Navigate to line in editor
        }}
        isVisible={showBottomPanel}
        onClose={() => setShowBottomPanel(false)}
      />

      {/* Settings Panel */}
      <IDESettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={editorSettings}
        setSettings={setEditorSettings}
      />

      {/* PHASE 6: Confirmation Dialog for Risky Actions */}
      {confirmationDialog.confidenceReport && (
        <ConfirmationDialog
          isOpen={confirmationDialog.isOpen}
          title="High Risk Action Detected"
          message={`The agent wants to ${confirmationDialog.intent?.type || 'perform an action'}, but confidence is low with high risk.`}
          confidenceReport={confirmationDialog.confidenceReport}
          actionType={confirmationDialog.intent?.type as any}
          onConfirm={handleConfirmAction}
          onCancel={handleCancelAction}
        />
      )}
    </div>
  )
}

