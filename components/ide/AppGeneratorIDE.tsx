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
import IDEActivityBar from './IDEActivityBar'
import IDESourceControl from './IDESourceControl'
import IDEResizablePanel from './IDEResizablePanel'
import IDESettingsPanel, { type EditorSettings } from './IDESettingsPanel'
import IDEExtensionsPanel from './IDEExtensionsPanel'
import ThemeToggle from '@/app/components/ThemeToggle'
import ConfirmationDialog from './ConfirmationDialog'
import SettingsView from '@/app/views/settings/SettingsView'
import CommandPalette from '@/app/components/ide/CommandPalette'
import IDETabBar, { type IDETab } from './IDETabBar'
import { isDevmateFile } from '@/lib/ide/explorer/ExplorerVisibility'
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
  // PHASE 2: Tab management for multiple files + Settings
  const [editorTabs, setEditorTabs] = useState<IDETab[]>([])
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
  
  // PHASE D: Workspace Stage (UX truth, not backend state)
  type WorkspaceStage = 'empty' | 'bootstrapped' | 'generated' | 'running' | 'error'
  const [workspaceStage, setWorkspaceStage] = useState<WorkspaceStage>('empty')
  const [showBottomPanel, setShowBottomPanel] = useState<boolean>(true) // Bottom panel visibility
  const [bottomPanelTab, setBottomPanelTab] = useState<'terminal' | 'preview' | 'console' | 'problems'>('terminal')
  const [diagnostics, setDiagnostics] = useState<any[]>([])
  const [currentDomain, setCurrentDomain] = useState<string>('app-generator') // PHASE 1: Track domain for session scoping
  const [aiModifiedFiles, setAiModifiedFiles] = useState<Set<string>>(new Set()) // PHASE 1: Track AI-modified files
  const [showSidebar, setShowSidebar] = useState(true)
  const [showTerminal, setShowTerminal] = useState(false) // Terminal hidden by default
  const [showExplorer, setShowExplorer] = useState(true)
  const [showChat, setShowChat] = useState(true) // Chat panel visibility
  const [splitEditor, setSplitEditor] = useState(false) // Split editor mode
  const [showSearch, setShowSearch] = useState(false)
  const [showProblems, setShowProblems] = useState(false)
  const [showOutput, setShowOutput] = useState(false)
  const [showDebugConsole, setShowDebugConsole] = useState(false)
  const [wordWrap, setWordWrap] = useState(false)
  const [activeView, setActiveView] = useState<'explorer' | 'search' | 'source-control' | 'run' | 'extensions' | 'settings'>('explorer')
  const [showCommandPalette, setShowCommandPalette] = useState(false)
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
          // PHASE D: Derive initial workspace stage from file count
          const fileCount = data.fileCount || 0
          if (fileCount === 0) {
            setWorkspaceStage('empty')
          } else {
            setWorkspaceStage('bootstrapped') // Has files, assume bootstrapped
          }
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

  // Listen for diagnostics updates from compiler/build system
  useEffect(() => {
    const handleDiagnosticsUpdate = (event: CustomEvent) => {
      if (event.detail.projectId === projectId) {
        const newDiagnostics = event.detail.diagnostics || []
        setDiagnostics(newDiagnostics)
        console.log('[AppGeneratorIDE] Diagnostics updated:', newDiagnostics.length, 'items')
      }
    }

    window.addEventListener('diagnostics-updated', handleDiagnosticsUpdate as EventListener)
    return () => {
      window.removeEventListener('diagnostics-updated', handleDiagnosticsUpdate as EventListener)
    }
  }, [projectId])

  // PHASE D: Helper function for context-aware error messages
  const getContextAwareErrorMessage = (
    errorMessage: string,
    stage: WorkspaceStage,
    fileCount: number,
    intentType?: string
  ): string => {
    // Replace generic "Failed to execute agent" with context-aware messages
    if (errorMessage.includes('Failed to execute agent') || errorMessage.includes('execute agent')) {
      if (fileCount === 0) {
        return 'No files exist yet. Create a project first by describing what you want to build.'
      }
      if (intentType === 'fix') {
        return 'Nothing to fix — your project has no errors.'
      }
      if (intentType === 'run' && stage !== 'running') {
        return 'Runtime isn\'t running yet. Click Run to start your app.'
      }
      return 'An error occurred. Please try again or describe what you want to build.'
    }
    
    // Context-specific error handling
    if (errorMessage.includes('empty') || errorMessage.includes('no files')) {
      return 'No files exist yet. Create a project first by describing what you want to build.'
    }
    if (errorMessage.includes('Project creation is handled by the IDE')) {
      return 'Project creation is handled automatically. Just describe what you want to build.'
    }
    if (errorMessage.includes('Nothing to fix')) {
      return 'Nothing to fix — your project has no errors.'
    }
    
    return errorMessage
  }

  // PHASE E: Debounced file tree refresh to prevent excessive API calls
  const loadFilesDebounceRef = useRef<NodeJS.Timeout | null>(null)
  const loadFiles = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:237',message:'loadFiles called',data:{hasProjectId:!!projectId,projectId:projectId||'null',workspaceInitialized},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion

    if (!projectId) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:242',message:'loadFiles early return - no projectId',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.warn('[AppGeneratorIDE] loadFiles: Early return - no projectId')
      return
    }

    // Don't require workspaceInitialized - files might exist even if workspace isn't fully initialized
    // This allows file listing to work after folder uploads even if initialization is pending
    if (!workspaceInitialized) {
      console.warn('[AppGeneratorIDE] loadFiles: Workspace not initialized, but proceeding anyway (files may have been uploaded)')
    }

    // PHASE E: Debounce file tree refresh (300ms)
    if (loadFilesDebounceRef.current) {
      clearTimeout(loadFilesDebounceRef.current)
    }
    
    loadFilesDebounceRef.current = setTimeout(async () => {
      try {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:250',message:'Fetching file list',data:{url:`/api/runtime/file/list?projectId=${projectId}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        const response = await fetch(`/api/runtime/file/list?projectId=${projectId}`)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:252',message:'File list response received',data:{ok:response.ok,status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        if (response.ok) {
          const data = await response.json()
          const regularFiles = data.files || []
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:256',message:'Files loaded',data:{fileCount:regularFiles.length,firstFewFiles:regularFiles.slice(0,5).map(f=>f.path)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
          
          // PHASE 2: Virtual documents removed - use Settings View instead
          setFiles(regularFiles)
          
          // PHASE D: Update workspace stage based on file count (excluding virtual docs)
          const fileCount = regularFiles.length
          if (fileCount === 0) {
            setWorkspaceStage('empty')
          } else if (workspaceStage === 'empty') {
            setWorkspaceStage('bootstrapped')
          }
        } else {
          // #region agent log
          const errorText = await response.text().catch(()=>'unknown')
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:264',message:'File list API error',data:{status:response.status,error:errorText},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
        }
      } catch (error) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:267',message:'loadFiles exception',data:{error:error instanceof Error?error.message:'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        console.error('Failed to load files:', error)
      }
    }, 300)
  }, [projectId, workspaceInitialized, workspaceStage])

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
    const handleFolderUploaded = (event: CustomEvent) => {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:392',message:'workspace-folder-uploaded event received',data:{projectId:event.detail?.projectId||projectId||'null',workspaceInitialized,hasProjectId:!!projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      console.log('[AppGeneratorIDE] Folder uploaded event received, reloading files...', { workspaceInitialized, projectId, eventProjectId: event.detail?.projectId })
      
      // If workspace not initialized, try to initialize it first, then load files
      if (!workspaceInitialized && projectId) {
        console.log('[AppGeneratorIDE] Workspace not initialized, attempting to initialize...')
        // Try to initialize workspace
        fetch('/api/workspace/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, mode: 'app-generator' }),
        })
          .then(async (response) => {
            if (response.ok) {
              const data = await response.json()
              if (data.initialized) {
                setWorkspaceInitialized(true)
                // Wait a bit for state to update, then load files
                setTimeout(() => {
                  console.log('[AppGeneratorIDE] Workspace initialized, loading files...')
                  loadFiles()
                }, 200)
              } else {
                // Still try to load files even if initialization fails
                console.warn('[AppGeneratorIDE] Workspace initialization failed, but trying to load files anyway...')
                loadFiles()
              }
            } else {
              // Still try to load files
              console.warn('[AppGeneratorIDE] Workspace initialization request failed, but trying to load files anyway...')
              loadFiles()
            }
          })
          .catch((error) => {
            console.error('[AppGeneratorIDE] Workspace initialization error:', error)
            // Still try to load files
            loadFiles()
          })
      } else {
        // Workspace is initialized, just load files
        loadFiles()
      }
    }
    window.addEventListener('workspace-folder-uploaded', handleFolderUploaded as EventListener)
    return () => window.removeEventListener('workspace-folder-uploaded', handleFolderUploaded as EventListener)
  }, [loadFiles, workspaceInitialized, projectId])

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

  // PHASE 2: Handle opening Settings View as a tab (NOT as a file)
  const openSettings = useCallback(() => {
    const settingsTabPath = 'Settings'
    
    setEditorTabs(prev => {
      // Check if Settings tab already exists
      const existingTab = prev.find(tab => tab.path === settingsTabPath && tab.type === 'settings')
      if (existingTab) {
        // Switch to existing Settings tab
        setActiveFile(settingsTabPath)
        return prev
      }
      
      // Add Settings as a new tab
      const newTabs = [
        ...prev,
        {
          path: settingsTabPath,
          type: 'settings' as const,
        }
      ]
      
      // Switch to Settings tab
      setActiveFile(settingsTabPath)
      setActiveView('explorer') // Reset view to explorer when opening settings
      return newTabs
    })
  }, [])

  // PHASE 2: Handle Command Palette
  const handleOpenCommandPalette = useCallback(() => {
    setShowCommandPalette(true)
  }, [])

  // Handle view change - VS Code style: toggle sidebar if clicking active view
  const handleViewChange = (view: 'explorer' | 'search' | 'source-control' | 'run' | 'extensions' | 'settings') => {
    // PHASE 2: If clicking Settings, open Settings View as a tab (NOT a file)
    if (view === 'settings') {
      openSettings()
      return
    }
    
    // PHASE F-4: If clicking Extensions, open extensions panel (not as file anymore)
    if (view === 'extensions') {
      setActiveView('extensions')
      setShowSidebar(true)
      return
    }
    
    // If clicking the same active view, toggle sidebar visibility
    if (activeView === view && showSidebar) {
      setShowSidebar(false)
      return
    }
    
    // Otherwise, activate the view and show sidebar
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

  // PHASE 2: Load file content - PREVENT .devmate files from opening, update tab content
  const loadFileContent = useCallback(async (filePath: string) => {
    if (!projectId) return

    // PHASE 2: HARD RULE - .devmate files must NEVER open as editable source
    if (isDevmateFile(filePath) || filePath.startsWith('.devmate/') || filePath === '.devmate') {
      console.warn(`[AppGeneratorIDE] Blocked attempt to open .devmate file: ${filePath}. Use Settings View instead.`)
      // If user tries to open settings.json, open Settings View instead
      if (filePath.includes('settings')) {
        openSettings()
      }
      return
    }

    try {
      // Load regular file only
      const response = await fetch(`/api/runtime/file/read?projectId=${projectId}&path=${encodeURIComponent(filePath)}`)
      if (response.ok) {
        const data = await response.json()
        const content = data.content || ''
        
        // Update file content state
        setFileContent(content)
        
        // Update tab content
        setEditorTabs(prev => prev.map(tab => 
          tab.path === filePath && tab.type === 'file'
            ? { ...tab, content }
            : tab
        ))
      }
    } catch (error) {
      console.error('Failed to load file content:', error)
    }
  }, [projectId, openSettings, editorTabs])
  
  // PHASE 2: Handle tab selection
  const handleTabSelect = useCallback((tabPath: string) => {
    setActiveFile(tabPath)
    
    // For file tabs, load content if not already loaded or if switching tabs
    setEditorTabs(prev => {
      const tab = prev.find(t => t.path === tabPath)
      if (tab && tab.type === 'file') {
        // Try to get content from tab if it exists
        if ('content' in tab && tab.content !== undefined) {
          setFileContent(tab.content)
        } else {
          // Load content if not available
          loadFileContent(tabPath)
        }
      }
      return prev
    })
  }, [loadFileContent])
  
  // PHASE 2: Handle tab close
  const handleTabClose = useCallback((tabPath: string) => {
    setEditorTabs(prev => {
      const remainingTabs = prev.filter(tab => tab.path !== tabPath)
      
      // Check if we're closing the active tab using functional state update
      setActiveFile(currentActive => {
        if (currentActive === tabPath) {
          // If closing the active tab, switch to another tab
          if (remainingTabs.length > 0) {
            // Switch to the tab at the same index, or last tab if closing last
            const currentIndex = prev.findIndex(tab => tab.path === tabPath)
            const newIndex = Math.min(currentIndex, remainingTabs.length - 1)
            const newActiveTab = remainingTabs[newIndex] || remainingTabs[remainingTabs.length - 1]
            
            // For file tabs, ensure content is loaded
            if (newActiveTab.type === 'file') {
              // Try to get content from previous tabs or load it
              const prevTabWithContent = prev.find(t => t.path === newActiveTab.path && 'content' in t)
              if (prevTabWithContent && 'content' in prevTabWithContent && prevTabWithContent.content) {
                setFileContent(prevTabWithContent.content)
              } else {
                loadFileContent(newActiveTab.path)
              }
            }
            
            return newActiveTab.path
          } else {
            // No tabs left
            setFileContent('')
            return undefined
          }
        }
        // Not closing active tab, keep current active
        return currentActive
      })
      
      return remainingTabs
    })
  }, [loadFileContent])

  // Handle file selection - PHASE 2: Block .devmate files, support tabs
  const handleFileSelect = useCallback((filePath: string) => {
    // PHASE 2: HARD RULE - .devmate files must NEVER open as editable source
    if (isDevmateFile(filePath) || filePath.startsWith('.devmate/') || filePath === '.devmate') {
      console.warn(`[AppGeneratorIDE] Blocked attempt to select .devmate file: ${filePath}`)
      // If user tries to select settings.json, open Settings View instead
      if (filePath.includes('settings')) {
        openSettings()
      }
      return
    }
    
    setEditorTabs(prev => {
      // Check if file is already open in a tab
      const existingTab = prev.find(tab => tab.path === filePath && tab.type === 'file')
      if (existingTab) {
        // Switch to existing tab
        setActiveFile(filePath)
        // Load content if not already loaded
        const tabWithContent = prev.find(tab => tab.path === filePath)
        if (tabWithContent && 'content' in tabWithContent && tabWithContent.content !== undefined) {
          setFileContent(tabWithContent.content as string)
        } else {
          loadFileContent(filePath)
        }
        return prev
      }
      
      // Add file as new tab
      const newTabs = [
        ...prev,
        {
          path: filePath,
          type: 'file' as const,
        }
      ]
      
      setActiveFile(filePath)
      loadFileContent(filePath)
      return newTabs
    })
  }, [openSettings, loadFileContent])

  // PHASE 2: Handle file save - PREVENT saving .devmate files
  const handleFileSave = useCallback(async (filePath: string, content: string) => {
    if (!projectId) {
      alert('Project ID is required to save files')
      return
    }

    // PHASE 2: HARD RULE - .devmate files must NEVER be saved as editable source
    if (isDevmateFile(filePath) || filePath.startsWith('.devmate/') || filePath === '.devmate') {
      console.warn(`[AppGeneratorIDE] Blocked attempt to save .devmate file: ${filePath}. Settings must be changed via Settings View.`)
      alert('Cannot save .devmate files directly. Please use the Settings View to change settings.')
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

    // Save regular file only
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

  // PHASE 2: Keyboard shortcuts (Ctrl/Cmd+Shift+P for Command Palette)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Command Palette: Ctrl+Shift+P (Windows/Linux) or Cmd+Shift+P (Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
        e.preventDefault()
        handleOpenCommandPalette()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleOpenCommandPalette])

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
    // PHASE A: Convert SessionMessage types to AIMessage types for display
    setAiMessages(session.messages.map((msg) => {
      // Convert SessionMessage type to AIMessage type
      let aimessageType: 'thinking' | 'acting' | 'done' | 'error' | 'suggestion'
      if (msg.type === 'assistant') {
        aimessageType = 'done' // Assistant messages show as "done" in chat
      } else if (msg.type === 'error') {
        aimessageType = 'error'
      } else if (msg.type === 'observation') {
        aimessageType = 'acting' // Observations show as "acting"
      } else if (msg.type === 'system') {
        aimessageType = 'thinking' // System messages show as "thinking"
      } else {
        aimessageType = 'done' // Default fallback (user messages are filtered out)
      }

      return {
        id: msg.id,
        type: aimessageType,
        content: msg.content,
        timestamp: msg.timestamp,
        intent: msg.intent,
        metadata: msg.metadata,
      }
    }))
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

    // PHASE 6: Check confidence before risky actions (skip for empty generate - handled by UI)
    const isEmptyIntent = (intent as any).isEmptyIntent === true
    if (!isEmptyIntent || intent.type !== 'generate') {
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
    }

    // Ensure workspace is initialized before execution
    let workspaceFileCount = 0
    if (!workspaceInitialized) {
      try {
        setAgentState('thinking')
        setAgentMessage('Initializing workspace...')
        const initResponse = await fetch('/api/workspace/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, mode: 'app-generator' }),
        })

        if (!initResponse.ok) {
          const error = await initResponse.json()
          throw new Error(error.error || 'Failed to initialize workspace')
        }

        const initData = await initResponse.json()
        workspaceFileCount = initData.fileCount || 0
        setWorkspaceInitialized(true)
        setAgentState('idle')
        setAgentMessage('')
      } catch (error) {
        console.error('Workspace initialization error:', error)
        const errorMessage = sessionManager.addMessage(currentDomain, projectId, {
          type: 'error',
          content: `Failed to initialize workspace: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        setAiMessages((prev) => [...prev, errorMessage])
        setAgentState('error')
        setAgentMessage('Workspace initialization failed')
        setIsProcessing(false)
        setTimeout(() => {
          setAgentState('idle')
          setAgentMessage('')
        }, 3000)
        return // Stop execution if initialization fails
      }
    } else {
      // Get current file count if workspace is already initialized
      try {
        const initResponse = await fetch('/api/workspace/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, mode: 'app-generator' }),
        })
        if (initResponse.ok) {
          const initData = await initResponse.json()
          workspaceFileCount = initData.fileCount || 0
        }
      } catch (error) {
        // Ignore error, will check on backend
      }
    }

    // PHASE C: Check for empty generate intent - handle via UI-level bootstrap
    const isEmptyGenerate = intent.type === 'generate' && (isEmptyIntent || workspaceFileCount === 0)
    
    if (isEmptyGenerate) {
      // PHASE C: Handle empty generate via UI-level bootstrap (no agent)
      setIsProcessing(true)
      setAgentState('thinking')
      setAgentMessage('Creating starter project...')

      // Add user message
      const userMessage = sessionManager.addMessage(currentDomain, projectId, {
        type: 'user',
        content: intent.description || 'Create a new project',
        intent,
      })
      setAiMessages((prev) => [...prev, userMessage])

      try {
        const response = await fetch('/api/workspace/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            platform: intent.platform || 'web',
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to create project' }))
          throw new Error(errorData.error || 'Failed to create project')
        }

        const result = await response.json()
        
        // PHASE B: Bootstrap transaction committed on server - UI updates are best-effort only
        // OS bootstrap is already complete, UI failures cannot affect it
        try {
          // PHASE D: Update workspace stage (UI state only, OS already committed)
          setWorkspaceStage('bootstrapped')
        } catch (e) {
          console.warn('[AppGeneratorIDE] UI init failed; OS already committed:', e)
        }

        // PHASE B: UI boundary hardening - all UI operations wrapped in try-catch
        // Bootstrap must never depend on UI success
        try {
          // Verify files were created
          console.log('[AppGeneratorIDE] Bootstrap committed on server:', result)
          console.log('[AppGeneratorIDE] Files created:', result.filesCreated)
          
          // Wait a bit for files to be written to disk, then force immediate file list refresh
          // Clear any pending debounce and load files immediately
          if (loadFilesDebounceRef.current) {
            clearTimeout(loadFilesDebounceRef.current)
          }
          
          // Retry file list loading a few times with delays to ensure files are written
          let fileLoadAttempts = 0
          const maxAttempts = 5
          let regularFiles: any[] = []
          
          while (fileLoadAttempts < maxAttempts && regularFiles.length === 0) {
            await new Promise(resolve => setTimeout(resolve, 300)) // Wait for file writes to complete
            
            try {
              const fileResponse = await fetch(`/api/runtime/file/list?projectId=${projectId}`)
              if (fileResponse.ok) {
                const fileData = await fileResponse.json()
                regularFiles = fileData.files || []
                console.log(`[AppGeneratorIDE] File list attempt ${fileLoadAttempts + 1}: ${regularFiles.length} files found`)
                
                if (regularFiles.length > 0) {
                  setFiles(regularFiles)
                  break // Files found, exit retry loop
                }
              }
            } catch (error) {
              console.error(`[AppGeneratorIDE] Failed to load files (attempt ${fileLoadAttempts + 1}):`, error)
            }
            
            fileLoadAttempts++
          }
          
          // PHASE B: Open initial files (best-effort, wrapped in try-catch)
          if (regularFiles.length > 0) {
            const firstFile = regularFiles.find((f: any) => !f.isDirectory && f.type === 'file')
            if (firstFile) {
              console.log('[AppGeneratorIDE] Opening first file:', firstFile.path)
              
              try {
                setEditorTabs([{
                  path: firstFile.path,
                  type: 'file',
                  dirty: false,
                  modifiedByAI: false,
                }])
                setActiveFile(firstFile.path)
              } catch (e) {
                console.warn('[AppGeneratorIDE] Failed to open file in tab (non-fatal):', e)
              }
              
              // Load file content
              try {
                const contentResponse = await fetch(`/api/runtime/file/read?projectId=${projectId}&path=${encodeURIComponent(firstFile.path)}`)
                if (contentResponse.ok) {
                  const contentData = await contentResponse.json()
                  const content = contentData.content || ''
                  console.log(`[AppGeneratorIDE] Loaded file content (${content.length} chars):`, firstFile.path)
                  setFileContent(content)
                  
                  // Update tab with content
                  setEditorTabs(prev => prev.map(tab => 
                    tab.path === firstFile.path && tab.type === 'file'
                      ? { ...tab, content }
                      : tab
                  ))
                } else {
                  console.error('[AppGeneratorIDE] Failed to read file content:', contentResponse.status)
                }
              } catch (error) {
                console.error('[AppGeneratorIDE] Failed to load first file content:', error)
              }
            }
          } else {
            console.warn('[AppGeneratorIDE] No files found after bootstrap, filesCreated:', result.filesCreated)
            // Still try to load files normally
            loadFiles()
          }
        } catch (error) {
          // PHASE B: UI init failed but OS bootstrap already committed
          console.warn('[AppGeneratorIDE] UI init failed; OS already committed:', error)
          // Still try to load files normally
          loadFiles()
        }

        // PHASE F: UX Truthfulness - Clear, explicit summary message with capabilities
        const platformName = result.platform === 'web' ? 'web' : result.platform === 'node' ? 'Node.js' : 'web'
        const assistantMessage = sessionManager.addMessage(currentDomain, projectId, {
          type: 'assistant',
          content: `✅ Starter ${platformName} project created with ${result.fileCount} file${result.fileCount !== 1 ? 's' : ''}.\n\nThis project currently uses a simple HTML/CSS/JS structure.\n\nI can:\n• Add features (e.g., "add calculator logic")\n• Improve UI/UX (e.g., "redesign the interface")\n• Migrate to a framework (e.g., "convert to React")\n\nWhat would you like to do?`,
          metadata: { filesCreated: result.filesCreated, platform: result.platform },
        })
        setAiMessages((prev) => [...prev, assistantMessage])

        setAgentState('done')
        setAgentMessage('Project created')
        setTimeout(() => {
          setAgentState('idle')
          setAgentMessage('')
        }, 2000)
      } catch (error) {
        console.error('Failed to bootstrap project:', error)
        const errorMessage = sessionManager.addMessage(currentDomain, projectId, {
          type: 'error',
          content: `Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`,
        })
        setAiMessages((prev) => [...prev, errorMessage])
        setAgentState('error')
        setAgentMessage('Failed to create project')
        setTimeout(() => {
          setAgentState('idle')
          setAgentMessage('')
        }, 3000)
      } finally {
        setIsProcessing(false)
      }
      return // Exit early - don't call agent
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
                  case 'ASSISTANT_MESSAGE':
                    // PHASE A: Create visible assistant message for chat
                    // PHASE F-3: If requiresConfirmation, mark message for user approval
                    const assistantMsg = sessionManager.addMessage(currentDomain, projectId, {
                      type: 'assistant',
                      content: event.payload.content,
                      metadata: {
                        ...event.payload.metadata,
                        requiresConfirmation: event.payload.metadata?.requiresConfirmation || false,
                        planType: event.payload.metadata?.planType,
                      },
                    })
                    setAiMessages((prev) => [...prev, assistantMsg])
                    // PHASE D: Update workspace stage if generation completed
                    if (event.payload.metadata?.filesCreated) {
                      setWorkspaceStage('generated')
                    }
                    // PHASE F-3: If requires confirmation, pause execution (AgentExecutionRouter will wait)
                    if (event.payload.metadata?.requiresConfirmation) {
                      setAgentState('thinking')
                      setAgentMessage('Waiting for your confirmation...')
                    }
                    break
                  case 'AGENT_DONE':
                    // PHASE 7: Update agent state
                    setAgentState('done')
                    setAgentMessage(event.payload.message || 'Completed')
                    // PHASE D: Update workspace stage if files were created
                    if (event.payload.result?.filesCreated) {
                      setWorkspaceStage('generated')
                    }
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
                    // PHASE D: Context-aware error message
                    const contextAwareError = getContextAwareErrorMessage(event.payload.error || 'Error occurred', workspaceStage, files.length)
                    const errorMsg = sessionManager.addMessage(currentDomain, projectId, {
                      type: 'error',
                      content: contextAwareError,
                    })
                    setAiMessages((prev) => [...prev, errorMsg])
                    setWorkspaceStage('error')
                    // Auto-reset to idle after 3 seconds
                    setTimeout(() => {
                      setAgentState('idle')
                      setAgentMessage('')
                      // Reset error stage if no persistent error
                      if (files.length > 0) {
                        setWorkspaceStage('generated')
                      } else {
                        setWorkspaceStage('empty')
                      }
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
                    // PHASE D: Context-aware error message
                    const execContextError = getContextAwareErrorMessage(event.payload.error || 'Execution error', workspaceStage, files.length)
                    const execErrorMessage = sessionManager.addMessage(currentDomain, projectId, {
                      type: 'error',
                      content: execContextError,
                    })
                    setAiMessages((prev) => [...prev, execErrorMessage])
                    setWorkspaceStage('error')
                    break
                  case 'RUNTIME_STARTED':
                    setRuntimeState((prev: any) => ({
                      ...prev,
                      status: 'running',
                    }))
                    // PHASE D: Update workspace stage
                    setWorkspaceStage('running')
                    // PHASE D: Clear summary message
                    const runtimeMessage = sessionManager.addMessage(currentDomain, projectId, {
                      type: 'assistant',
                      content: `▶ App is running. Preview is available.`,
                    })
                    setAiMessages((prev) => [...prev, runtimeMessage])
                    break
                  case 'FILE_CHANGED':
                    // PHASE 1: Track AI-modified files
                    if (event.payload.path) {
                      setAiModifiedFiles((prev) => new Set(prev).add(event.payload.path))
                    }
                    // Refresh file list to show new/modified files immediately
                    loadFiles()
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
      
      // PHASE D: Context-aware error messages (replace generic "Failed to execute agent")
      let errorContent = 'An error occurred'
      if (error instanceof Error) {
        errorContent = getContextAwareErrorMessage(error.message, workspaceStage, files.length, intent.type)
      }
      
      const errorMessage = sessionManager.addMessage(currentDomain, projectId, {
        type: 'error',
        content: errorContent,
      })
      setAiMessages((prev) => [...prev, errorMessage])
      setAgentState('error')
      setAgentMessage(errorContent)
      setWorkspaceStage('error')
      setTimeout(() => {
        setAgentState('idle')
        setAgentMessage('')
        // Reset error stage
        if (files.length > 0) {
          setWorkspaceStage('generated')
        } else {
          setWorkspaceStage('empty')
        }
      }, 3000)
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'AppGeneratorIDE.tsx:1337',message:'handleOpenFolder called',data:{projectId:projectId||'null',hasProjectId:!!projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    console.log('[AppGeneratorIDE] handleOpenFolder called', { projectId, hasProjectId: !!projectId })
    // Trigger folder input click via custom event (IDEMenuBar will handle it)
    window.dispatchEvent(new CustomEvent('open-workspace-folder', { detail: { projectId } }))
  }, [projectId])

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

  // PHASE 2: Command Palette handler
  const handleCommandPalette = useCallback(() => {
    setShowCommandPalette(true)
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
          const newValue = !showBottomPanel
          setShowBottomPanel(newValue)
          if (newValue) {
            setBottomPanelTab('terminal')
          }
        }}
        onToggleExplorer={() => {
          const newValue = !showExplorer
          setShowExplorer(newValue)
          // Also toggle sidebar if explorer is being shown
          if (newValue && !showSidebar) {
            setShowSidebar(true)
            setActiveView('explorer')
          }
        }}
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
        showExplorer={showExplorer && showSidebar}
        showTerminal={showBottomPanel}
        showChat={showChat}
        onToggleChat={() => setShowChat(!showChat)}
      />

      {/* Main IDE Layout */}
      <div className="flex-1 flex min-h-0">
        {/* Activity Bar */}
        <IDEActivityBar
          activeView={activeView}
          onViewChange={handleViewChange}
          gitStatus={gitStatus}
          onOpenSettings={openSettings}
        />

        {/* Left Sidebar: Files/Search/Source Control */}
        {showSidebar && showExplorer && (
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
              <IDEExtensionsPanel />
            )}
          </IDEResizablePanel>
        )}

        {/* Center: Code Playground with Editor OR Settings View */}
        <div className={`flex-1 flex min-w-0 ${splitEditor ? 'flex-row' : 'flex-col'}`}>
          {/* Primary Editor */}
          <div className={`flex flex-col min-w-0 ${splitEditor ? 'flex-1' : 'flex-1'}`}>
            {/* PHASE 2: Tab Bar (VS Code-style with close buttons) */}
            {editorTabs.length > 0 && (
              <IDETabBar
                tabs={editorTabs}
                activeTab={activeFile}
                onTabSelect={handleTabSelect}
                onTabClose={handleTabClose}
              />
            )}

            {/* Content Area: Editor or Settings View based on active tab */}
            {activeFile && editorTabs.find(tab => tab.path === activeFile && tab.type === 'settings') ? (
              // Settings View (as a tab)
              <div className="flex-1 min-h-0 overflow-hidden">
                <SettingsView 
                  projectId={projectId} 
                  onClose={() => {
                    // Close Settings tab
                    handleTabClose(activeFile)
                  }} 
                />
              </div>
            ) : activeFile ? (
            // File Editor (as a tab)
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
              splitEditor={splitEditor}
              onToggleSplitEditor={() => setSplitEditor(!splitEditor)}
              onOpenTerminal={() => {
                // Open terminal panel and set to terminal tab
                setShowBottomPanel(true)
                setBottomPanelTab('terminal')
              }}
              onRun={(filePath, mode) => {
                // This is handled by IDECodePlayground's handleRun
              }}
            />
            ) : (
              // No tabs open - show empty state
              <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <p className="text-lg mb-2">No files open</p>
                  <p className="text-sm">Select a file from the explorer to start editing</p>
                </div>
              </div>
            )}
          </div>

          {/* Split Editor (Secondary Editor) */}
          {splitEditor && (
            <div className="flex-1 flex flex-col min-w-0 border-l border-gray-200 dark:border-gray-800">
              <div className="h-8 flex items-center px-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs text-gray-500 dark:text-gray-400">Split Editor</span>
              </div>
              {activeFile ? (
                <IDECodePlayground
                  projectId={projectId}
                  filePath={activeFile}
                  content={fileContent}
                  onSave={(content) => {
                    if (activeFile) {
                      handleFileSave(activeFile, content)
                    }
                  }}
                  onChange={(newContent) => {
                    // Update the same file content for split view
                    setFileContent(newContent)
                  }}
                  editorSettings={editorSettings}
                  onOpenTerminal={() => {
                    // Open terminal panel and set to terminal tab
                    setShowBottomPanel(true)
                    setBottomPanelTab('terminal')
                  }}
                  onRun={(filePath, mode) => {
                    // This is handled by IDECodePlayground's handleRun
                  }}
                />
              ) : (
                <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <p className="text-sm mb-2">Split Editor</p>
                    <p className="text-xs">Open a file to view in split mode</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar: Chat (Resizable) */}
        {showChat && (
          <IDEResizablePanel
            defaultWidth={chatWidth}
            minWidth={250}
            maxWidth={600}
            onResize={setChatWidth}
            resizeHandlePosition="left" // Resize handle on left for right sidebar
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
                  workspaceStage={workspaceStage}
                  fileCount={files.length}
                />
              </div>

            </div>
          </IDEResizablePanel>
        )}
      </div>

      {/* PHASE 5: Bottom Panel (Terminal / Preview / Console / Problems) */}
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
        defaultTab={bottomPanelTab}
        problems={diagnostics}
        onProblemClick={(problem) => {
          // Open file at problem location
          if (problem.file) {
            handleFileSelect(problem.file)
            // TODO: Navigate to line and column in editor
          }
        }}
      />

      {/* PHASE 2: Command Palette */}
      <CommandPalette
        projectId={projectId}
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onCommandExecuted={(commandId) => {
          console.log(`[AppGeneratorIDE] Command executed: ${commandId}`)
        }}
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

