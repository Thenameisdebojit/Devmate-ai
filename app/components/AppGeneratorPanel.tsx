'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import FilesystemTree, { FileNode } from './AppGenerator/FilesystemTree'
import MonacoEditorPanel, { EditorTab } from './AppGenerator/MonacoEditorPanel'
import AIMessagePanel, { AIMessage, ToolCall } from './AppGenerator/AIMessagePanel'
import CommandBar, { CommandAction } from './AppGenerator/CommandBar'
import PreviewPanel from './AppGenerator/PreviewPanel'
import CheckpointPanel from './AppGenerator/CheckpointPanel'
import EditorSensor from './AppGenerator/EditorSensor'
import AgentPresence from './AppGenerator/AgentPresence'
import PromptInput from './AppGenerator/PromptInput'
import { AgentMessageGenerator } from '@/lib/runtime/agentMessages'
import { contextCache } from '@/lib/runtime/contextCache'
import { getWorkspaceDaemon as getCoreWorkspaceDaemon, getAgentObserver, getAgentActionHandler, getAgentPlanExecutor, type AgentPlan } from '@/core/workspace'

interface ProjectFile {
  path: string
  content: string
}

interface GeneratedProject {
  projectName: string
  framework: string
  description: string
  files: ProjectFile[]
  setupInstructions: string
  workspaceMetadata?: {
    projectId: string
    checkpointId: string
    fileCount: number
  }
}

/**
 * WorkspaceAI Panel (formerly AppGeneratorPanel)
 * 
 * This is now a workspace-native AI system, not a feature.
 * The AI is a resident subsystem that observes and reasons proactively.
 */
export default function AppGeneratorPanel() {
  // Workspace state
  const [files, setFiles] = useState<FileNode[]>([])
  const [editorTabs, setEditorTabs] = useState<EditorTab[]>([])
  const [activeTab, setActiveTab] = useState<string | undefined>()
  const [selectedFile, setSelectedFile] = useState<string | undefined>()

  // AI state
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  // Preview/Console/Terminal
  const [panelType, setPanelType] = useState<'preview' | 'console' | 'terminal'>('preview')
  const [consoleOutput, setConsoleOutput] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | undefined>()
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>()
  const [isRunning, setIsRunning] = useState(false)

  // Editor sensor state
  const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number } | undefined>()
  const [selection, setSelection] = useState<{ start: { line: number; column: number }; end: { line: number; column: number } } | undefined>()

  // Initialize workspace daemon and agent observer
  useEffect(() => {
    if (!currentProjectId) return

    // Initialize core workspace daemon
    const daemon = getCoreWorkspaceDaemon(currentProjectId)
    
    // Initialize agent observer (read-only intelligence)
    const observer = getAgentObserver(currentProjectId)
    
    // Initialize agent action handler (user-approved actions only)
    const actionHandler = getAgentActionHandler(currentProjectId)
    
    // Initialize agent plan executor (multi-step plans)
    const planExecutor = getAgentPlanExecutor(currentProjectId)
    
    // Subscribe to agent observations
    const eventBus = daemon.getEventBus()
    const handleObservation = (payload: any) => {
      // Add observation as AI message
      setAiMessages((prev) => [
        ...prev,
        {
          id: `obs-${payload.id}`,
          type: 'thinking',
          content: payload.message,
          timestamp: payload.timestamp,
        },
      ])
    }
    eventBus.on('AGENT_OBSERVATION', handleObservation)

    // Subscribe to agent suggestions (visually distinct)
    const handleSuggestion = (payload: any) => {
      // Add suggestion as AI message with distinct type
      setAiMessages((prev) => [
        ...prev,
        {
          id: `suggestion-${payload.id}`,
          type: 'suggestion',
          content: payload.message,
          timestamp: payload.timestamp,
          category: payload.category, // Store category for Fix it button logic
        },
      ])
    }
    eventBus.on('AGENT_SUGGESTION', handleSuggestion)

    // Subscribe to plan proposals
    const handlePlanProposed = (payload: any) => {
      const { plan } = payload
      planExecutor.registerPlan(plan)
      // Add plan as a special message type
      setAiMessages((prev) => [
        ...prev,
        {
          id: `plan-${plan.planId}`,
          type: 'suggestion',
          content: `Plan: ${plan.title}\n\n${plan.summary}\n\nSteps:\n${plan.steps.map((s: any, i: number) => `${i + 1}. ${s.description}`).join('\n')}\n\n⚠️ No changes will be made until you approve.`,
          timestamp: plan.createdAt,
          category: 'plan',
          plan: plan, // Store full plan object
        },
      ])
    }
    eventBus.on('AGENT_PLAN_PROPOSED', handlePlanProposed)

    // Subscribe to plan step completion to update UI
    const handleStepCompleted = (payload: any) => {
      const { planId, stepId, result } = payload
      // Update the plan message in UI
      setAiMessages((prev) =>
        prev.map((msg) => {
          if (msg.plan && msg.plan.planId === planId) {
            const updatedPlan = { ...msg.plan }
            const step = updatedPlan.steps.find((s: any) => s.stepId === stepId)
            if (step) {
              step.status = 'completed'
              step.result = result
            }
            return { ...msg, plan: updatedPlan }
          }
          return msg
        })
      )
    }
    eventBus.on('AGENT_PLAN_STEP_COMPLETED', handleStepCompleted)

    // Subscribe to FILE_CHANGED events from agent actions to sync UI
    const handleFileChanged = (payload: any) => {
      const { path, content } = payload
      
      // Update editor tabs (update if open, add if not)
      setEditorTabs((prev) => {
        const isOpen = prev.some((tab) => tab.path === path)
        if (isOpen) {
          return prev.map((tab) =>
            tab.path === path
              ? { ...tab, content, dirty: true, modifiedByAI: true }
              : tab
          )
        } else {
          return [...prev, { path, content, dirty: true, modifiedByAI: true }]
        }
      })

      // Update files array
      setFiles((prev) =>
        prev.map((file) =>
          file.path === path
            ? { ...file, content, dirty: true, modifiedByAI: true }
            : file
        )
      )

      // Switch to the modified file
      setActiveTab(path)
      setSelectedFile(path)

      toast.success(`File ${path} updated by AI`)
    }
    eventBus.on('FILE_CHANGED', handleFileChanged)

    console.log('[WorkspaceDaemon] Initialized for project:', currentProjectId)
    console.log('[AgentObserver] Started observing workspace events')

    return () => {
      eventBus.off('AGENT_OBSERVATION', handleObservation)
      eventBus.off('AGENT_SUGGESTION', handleSuggestion)
      eventBus.off('AGENT_PLAN_PROPOSED', handlePlanProposed)
      eventBus.off('AGENT_PLAN_STEP_COMPLETED', handleStepCompleted)
      eventBus.off('FILE_CHANGED', handleFileChanged)
    }
  }, [currentProjectId])

  // Convert project files to FileNode format
  const convertToFileNodes = useCallback((projectFiles: ProjectFile[]): FileNode[] => {
    return projectFiles.map((file) => ({
      path: file.path,
      content: file.content,
      isDirectory: false,
      modifiedByAI: true, // All generated files are AI-modified
      dirty: false,
    }))
  }, [])

  // Handle file selection from tree
  const handleFileSelect = useCallback((path: string) => {
    setSelectedFile(path)
    
    // Find file content
    const file = files.find((f) => f.path === path)
    if (file && file.content !== undefined) {
      // Add or update tab
      setEditorTabs((prev) => {
        const existing = prev.find((t) => t.path === path)
        if (existing) {
          return prev
        }
        return [
          ...prev,
          {
            path: file.path,
            content: file.content,
            dirty: false,
            modifiedByAI: file.modifiedByAI,
          },
        ]
      })
      setActiveTab(path)
      
      // Emit EDITOR_FOCUS_CHANGED event to workspace daemon
      if (currentProjectId) {
        const daemon = getCoreWorkspaceDaemon(currentProjectId)
        daemon.dispatch({
          type: 'EDITOR_FOCUS_CHANGED',
          payload: { filePath: path },
        })
      }
    }
  }, [files, currentProjectId])

  // Handle tab operations
  const handleTabSelect = useCallback((path: string) => {
    setActiveTab(path)
    setSelectedFile(path)
    
    // Emit EDITOR_FOCUS_CHANGED event to workspace daemon
    if (currentProjectId) {
      const daemon = getCoreWorkspaceDaemon(currentProjectId)
      daemon.dispatch({
        type: 'EDITOR_FOCUS_CHANGED',
        payload: { filePath: path },
      })
    }
  }, [currentProjectId])

  const handleTabClose = useCallback((path: string) => {
    setEditorTabs((prev) => prev.filter((t) => t.path !== path))
    if (activeTab === path) {
      const remaining = editorTabs.filter((t) => t.path !== path)
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1].path : undefined)
      setSelectedFile(remaining.length > 0 ? remaining[remaining.length - 1].path : undefined)
    }
  }, [activeTab, editorTabs])

  // Handle file save (Ctrl+S / Cmd+S)
  const handleSave = useCallback((path: string) => {
    // Mark tab as no longer dirty
    setEditorTabs((prev) =>
      prev.map((tab) => (tab.path === path ? { ...tab, dirty: false } : tab))
    )

    // Dispatch FILE_SAVED event to WorkspaceDaemon
    if (currentProjectId) {
      const daemon = getCoreWorkspaceDaemon(currentProjectId)
      daemon.dispatch({
        type: 'FILE_SAVED',
        payload: { path },
      })
    }
  }, [currentProjectId])

  // Simple content hash function
  const hashContent = (content: string): string => {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  const handleContentChange = useCallback((path: string, content: string) => {
    // Update tab content and mark as dirty
    setEditorTabs((prev) =>
      prev.map((tab) =>
        tab.path === path
          ? { ...tab, content, dirty: true, modifiedByAI: false }
          : tab
      )
    )

    // Emit FILE_CHANGED event to workspace daemon
    if (currentProjectId) {
      const daemon = getCoreWorkspaceDaemon(currentProjectId)
      daemon.dispatch({
        type: 'FILE_CHANGED',
        payload: { path, content },
      })
    }

    // Update file in files array
    setFiles((prev) =>
      prev.map((file) =>
        file.path === path
          ? { ...file, content, dirty: true, modifiedByAI: false }
          : file
      )
    )
  }, [])

  // Handle file revert
  const handleFileRevert = useCallback((path: string) => {
    // Find original content (if available)
    // For now, just remove dirty flag
    setFiles((prev) =>
      prev.map((file) =>
        file.path === path ? { ...file, dirty: false } : file
      )
    )
    setEditorTabs((prev) =>
      prev.map((tab) =>
        tab.path === path ? { ...tab, dirty: false } : tab
      )
    )
    toast.success(`Reverted changes to ${path}`)
  }, [])

  // Create minimal project (bootstrap)
  const createMinimalProject = useCallback(() => {
    // Generate project ID
    const projectId = `proj-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`
    
    // Create minimal files
    const minimalFiles: FileNode[] = [
      {
        path: 'src/index.ts',
        content: `// Welcome to your new project
console.log('Hello, World!')
`,
        isDirectory: false,
        modifiedByAI: false,
        dirty: false,
      },
      {
        path: 'package.json',
        content: `{
  "name": "my-project",
  "version": "1.0.0",
  "description": "A new project",
  "main": "src/index.ts",
  "scripts": {
    "start": "node src/index.ts"
  }
}
`,
        isDirectory: false,
        modifiedByAI: false,
        dirty: false,
      },
      {
        path: 'README.md',
        content: `# My Project

A new project created in Devmate.

## Getting Started

Run the project:
\`\`\`bash
npm start
\`\`\`
`,
        isDirectory: false,
        modifiedByAI: false,
        dirty: false,
      },
    ]

    // Set files
    setFiles(minimalFiles)
    
    // Set project ID
    setCurrentProjectId(projectId)
    
    // Initialize workspace daemon
    const daemon = getCoreWorkspaceDaemon(projectId)
    
    // Initialize files in daemon state
    minimalFiles.forEach((file) => {
      daemon.dispatch({
        type: 'FILE_CHANGED',
        payload: { path: file.path, content: file.content },
      })
    })
    
    // Open first file in editor
    const firstFile = minimalFiles[0]
    if (firstFile) {
      setEditorTabs([
        {
          path: firstFile.path,
          content: firstFile.content,
          dirty: false,
          modifiedByAI: false,
        },
      ])
      setActiveTab(firstFile.path)
      setSelectedFile(firstFile.path)
      
      // Dispatch EDITOR_FOCUS_CHANGED
      daemon.dispatch({
        type: 'EDITOR_FOCUS_CHANGED',
        payload: { filePath: firstFile.path },
      })
    }
    
    toast.success('Project created successfully!')
  }, [])

  // Handle user prompt from input box
  const handleUserPrompt = useCallback(async (userPrompt: string) => {
    if (!userPrompt.trim()) return

    setIsProcessing(true)
    
    // If no project exists, create minimal project first
    if (!currentProjectId) {
      createMinimalProject()
      setIsProcessing(false)
      // After project is created, process the prompt
      setTimeout(() => {
        handleUserPrompt(userPrompt)
      }, 100)
      return
    }

    // Add user message to AI messages
    setAiMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        type: 'thinking',
        content: userPrompt,
        timestamp: Date.now(),
      },
    ])

    // For now, just acknowledge the prompt
    // TODO: Route to appropriate AI handler based on prompt intent
    setTimeout(() => {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          type: 'thinking',
          content: `I understand: "${userPrompt}". How would you like me to help?`,
          timestamp: Date.now(),
        },
      ])
      setIsProcessing(false)
    }, 500)
  }, [currentProjectId, createMinimalProject])

  // Handle command bar actions
  const handleCommand = useCallback(async (action: CommandAction, prompt?: string) => {
    setIsProcessing(true)

    switch (action) {
      case 'generate':
        // If no project exists, create minimal project first
        if (!currentProjectId) {
          createMinimalProject()
          setIsProcessing(false)
          return
        }
        // Otherwise, use AI generation
        await handleGenerate(prompt || '')
        break
      case 'run':
        await handleRun()
        break
      case 'fix-errors':
        await handleFixErrors()
        break
      case 'explain':
        await handleExplain()
        break
      case 'optimize':
        await handleOptimize()
        break
    }

    setIsProcessing(false)
  }, [currentProjectId, createMinimalProject])

  // Generate app
  const handleGenerate = async (userPrompt: string) => {
    if (!userPrompt.trim()) {
      const prompt = window.prompt('Describe the app you want to generate:')
      if (!prompt) return
      userPrompt = prompt
    }

    setIsStreaming(true)
    setAiMessages([
      {
        id: 'msg-1',
        type: 'thinking',
        content: 'Analyzing requirements and planning project structure...',
        timestamp: Date.now(),
      },
    ])

    try {
      const response = await fetch('/api/generate-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt, stream: true }),
      })

      if (!response.ok) {
        throw new Error('Failed to start generation')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response stream')

      let projectData: GeneratedProject | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)

              if (parsed.type === 'step') {
                // Generate progress message with confidence
                const progressMessage = AgentMessageGenerator.generateProgressMessage(
                  parsed.step || 1,
                  parsed.total || 6,
                  'generate'
                )
                const actingMessage = AgentMessageGenerator.generateMessage({
                  type: parsed.status === 'completed' ? 'done' : 'acting',
                  action: 'generate',
                  progress: progressMessage.progress,
                  context: {
                    filesModified: parsed.filesModified || 0,
                  },
                })

                setAiMessages((prev) => [
                  ...prev.slice(0, -1),
                  {
                    id: `msg-${Date.now()}`,
                    type: parsed.status === 'completed' ? 'done' : 'acting',
                    content: progressMessage.content || parsed.message,
                    progress: progressMessage.progress,
                    confidence: actingMessage.confidence,
                    timestamp: Date.now(),
                  },
                ])
              } else if (parsed.type === 'result') {
                projectData = parsed.project
              } else if (parsed.type === 'error') {
                // Generate error message with details and follow-up
                const errorMessage = AgentMessageGenerator.generateMessage({
                  type: 'error',
                  error: new Error(parsed.message),
                })

                setAiMessages((prev) => [
                  ...prev,
                  {
                    id: `msg-${Date.now()}`,
                    type: 'error',
                    content: errorMessage.content,
                    errorDetails: errorMessage.errorDetails,
                    followUp: errorMessage.followUp,
                    timestamp: Date.now(),
                  },
                ])
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }

      if (projectData) {
        // Convert project files to FileNode format
        const fileNodes = convertToFileNodes(projectData.files)
        setFiles(fileNodes)

        // Store project ID from workspace metadata
        if (projectData.workspaceMetadata) {
          const projectId = projectData.workspaceMetadata.projectId
          setCurrentProjectId(projectId)
          
          // Initialize workspace daemon (minimal wiring)
          const daemon = getCoreWorkspaceDaemon(projectId)
          
          // Initialize files in daemon state
          projectData.files.forEach((file) => {
            daemon.dispatch({
              type: 'FILE_CHANGED',
              payload: { path: file.path, content: file.content },
            })
          })
        }

        // Cache context
        const filesMap = new Map(projectData.files.map((f) => [f.path, f.content]))
        contextCache.setContext(projectData.workspaceMetadata?.projectId || '', {
          projectId: projectData.workspaceMetadata?.projectId || '',
          files: filesMap,
          metadata: {
            framework: projectData.framework,
            lastModified: Date.now(),
            fileCount: projectData.files.length,
          },
          checksums: new Map(),
        })

        // Cache response
        const promptHash = contextCache.hashPrompt(prompt, projectData.workspaceMetadata?.projectId)
        contextCache.cacheResponse(promptHash, prompt, JSON.stringify(projectData))

        // Generate done message with follow-up
        const doneMessage = AgentMessageGenerator.generateMessage({
          type: 'done',
          context: {
            filesModified: projectData.files.length,
            timeElapsed: Date.now() - (messages[0]?.timestamp || Date.now()),
          },
        })

        // Add AI message about completion
        setAiMessages((prev) => [
          ...prev,
          {
            id: `msg-${Date.now()}`,
            type: 'done',
            content: doneMessage.content,
            confidence: doneMessage.confidence,
            fileReferences: projectData.files.map((f) => f.path),
            followUp: doneMessage.followUp,
            timestamp: Date.now(),
          },
        ])

        toast.success('Application generated successfully!')
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      
      // Generate error message with details
      const errorMessage = AgentMessageGenerator.generateMessage({
        type: 'error',
        error: error,
      })

      setAiMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          type: 'error',
          content: errorMessage.content,
          errorDetails: errorMessage.errorDetails,
          followUp: errorMessage.followUp,
          timestamp: Date.now(),
        },
      ])
      toast.error(error.message || 'Failed to generate application')
    } finally {
      setIsStreaming(false)
      setIsProcessing(false)
    }
  }

  // Handle plan approval
  const handlePlanApproved = useCallback((planId: string) => {
    if (!currentProjectId) return
    const daemon = getCoreWorkspaceDaemon(currentProjectId)
    daemon.dispatch({
      type: 'AGENT_PLAN_APPROVED',
      payload: { planId },
    })
    toast.success('Plan approved. Starting execution...')
  }, [currentProjectId])

  // Handle step approval
  const handleStepApproved = useCallback((planId: string, stepId: string) => {
    if (!currentProjectId) return
    const daemon = getCoreWorkspaceDaemon(currentProjectId)
    daemon.dispatch({
      type: 'AGENT_PLAN_STEP_APPROVED',
      payload: { planId, stepId },
    })
  }, [currentProjectId])

  // Handle step rollback
  const handleStepRollback = useCallback(async (planId: string, stepId: string) => {
    if (!currentProjectId) return
    const executor = getAgentPlanExecutor(currentProjectId)
    await executor.rollbackStep(planId, stepId)
    toast.success('Step rolled back')
  }, [currentProjectId])

  // Handle plan rollback
  const handlePlanRollback = useCallback(async (planId: string) => {
    if (!currentProjectId) return
    const executor = getAgentPlanExecutor(currentProjectId)
    await executor.rollbackPlan(planId)
    toast.success('Plan rolled back')
  }, [currentProjectId])

  // Handle follow-up actions
  const handleFollowUpAction = async (action: string, messageId: string) => {
    switch (action) {
      case 'auto-fix':
        await handleFixErrors()
        break
      case 'run':
        await handleRun()
        break
      case 'explain':
        await handleExplainArchitecture()
        break
      case 'optimize':
        await handleOptimize()
        break
      case 'retry':
        // Retry last command
        const lastMessage = aiMessages[aiMessages.length - 1]
        if (lastMessage?.type === 'error') {
          // Find the command that failed and retry
          // This is a simplified version - in production, track the last command
          toast('Retrying last command...', { icon: '🔄' })
        }
        break
      case 'help':
        toast('Help documentation will be available soon', { icon: 'ℹ️' })
        break
      default:
        console.log('Unknown follow-up action:', action)
    }
  }

  // Handle fix action (user-approved)
  const handleFixAction = useCallback((messageId: string) => {
    if (!currentProjectId) {
      toast.error('No project active')
      return
    }

    // Dispatch AGENT_ACTION_REQUESTED event
    const daemon = getCoreWorkspaceDaemon(currentProjectId)
    daemon.dispatch({
      type: 'AGENT_ACTION_REQUESTED',
      payload: {
        actionType: 'FIX_BUILD_ERROR',
      },
    })

    // Show user feedback
    toast.success('Fixing build error...')
  }, [currentProjectId])

  // Run project
  const handleRun = async () => {
    if (!currentProjectId) {
      toast.error('No project to run. Generate a project first.')
      return
    }

    setIsRunning(true)
    setAiMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        type: 'acting',
        content: 'Starting container and building project...',
        timestamp: Date.now(),
      },
    ])
    setConsoleOutput(['Starting development server...'])
    setPanelType('console')

    try {
      // Get current files
      const projectFiles = files.map((f) => ({
        path: f.path,
        content: f.content || '',
      }))

      // Call run API
      const response = await fetch('/api/runtime/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: currentProjectId,
          files: projectFiles,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to run project')
      }

      const data = await response.json()
      const container = data.container

      // Get preview URL
      const previewResponse = await fetch(`/api/runtime/preview/url?projectId=${currentProjectId}`)
      if (previewResponse.ok) {
        const previewData = await previewResponse.json()
        setPreviewUrl(previewData.url)
        setPanelType('preview')
      }

      // Start streaming logs
      startLogStream(currentProjectId)

      // Emit RUNTIME_STARTED event to workspace daemon
      if (currentProjectId) {
        const daemon = getCoreWorkspaceDaemon(currentProjectId)
        daemon.dispatch({
          type: 'RUNTIME_STARTED',
          payload: { containerId: container.id, port: container.port },
        })
      }

      setAiMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          type: 'done',
          content: `Project is running on port ${container.port}`,
          timestamp: Date.now(),
        },
      ])

      toast.success('Project is running!')
    } catch (error: any) {
      console.error('Run error:', error)
      setAiMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          type: 'error',
          content: error.message || 'Failed to run project',
          timestamp: Date.now(),
        },
      ])
      toast.error(error.message || 'Failed to run project')
    } finally {
      setIsRunning(false)
    }
  }

  // Stream logs from container
  const startLogStream = (projectId: string) => {
    const eventSource = new EventSource(`/api/runtime/logs/stream?projectId=${projectId}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'log' || data.type === 'error') {
          setConsoleOutput((prev) => [...prev, data.content])
        }
      } catch (error) {
        console.error('Log stream error:', error)
      }
    }

    eventSource.onerror = () => {
      eventSource.close()
    }

    // Cleanup on unmount
    return () => {
      eventSource.close()
    }
  }

  // Fix errors
  const handleFixErrors = async () => {
    setAiMessages([
      {
        id: `msg-${Date.now()}`,
        type: 'thinking',
        content: 'Analyzing codebase for errors...',
        timestamp: Date.now(),
      },
    ])
    // TODO: Implement error fixing logic
    toast('Fix errors functionality will be implemented', { icon: 'ℹ️' })
  }

  // Explain architecture
  const handleExplain = async () => {
    setAiMessages([
      {
        id: `msg-${Date.now()}`,
        type: 'thinking',
        content: 'Analyzing project architecture...',
        timestamp: Date.now(),
      },
    ])
    // TODO: Implement explanation logic
    toast('Explain architecture functionality will be implemented', { icon: 'ℹ️' })
  }

  // Optimize
  const handleOptimize = async () => {
    setAiMessages([
      {
        id: `msg-${Date.now()}`,
        type: 'thinking',
        content: 'Analyzing code for optimization opportunities...',
        timestamp: Date.now(),
      },
    ])
    // TODO: Implement optimization logic
    toast('Optimize functionality will be implemented', { icon: 'ℹ️' })
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Main Layout: Sidebar + Editor + Preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left Sidebar: Filesystem Tree + Checkpoints */}
        <div className="w-64 flex-shrink-0 flex">
          <div className="w-1/2 border-r border-gray-200 dark:border-gray-800">
            <FilesystemTree
              files={files}
              selectedPath={selectedFile}
              onFileSelect={handleFileSelect}
              onFileRevert={handleFileRevert}
              onRefresh={() => {
                // TODO: Implement refresh
                toast.info('Refresh functionality will be implemented')
              }}
              projectId={currentProjectId}
            />
          </div>
          <div className="w-1/2">
            <CheckpointPanel
              projectId={currentProjectId}
              onRollback={(checkpointId, filePath) => {
                // Reload files after rollback
                if (filePath) {
                  // Reload specific file
                  const file = files.find((f) => f.path === filePath)
                  if (file) {
                    handleFileSelect(filePath)
                  }
                } else {
                  // Reload all files
                  toast.success('Project rolled back. Refreshing files...')
                  // TODO: Reload files from project
                }
              }}
            />
          </div>
        </div>

        {/* Center: Monaco Editor */}
        <div className="flex-1 min-w-0 relative">
          <MonacoEditorPanel
            tabs={editorTabs}
            activeTab={activeTab}
            onTabSelect={handleTabSelect}
            onTabClose={handleTabClose}
            onContentChange={handleContentChange}
            onSave={handleSave}
            onCursorChange={(line, column) => {
              setCursorPosition({ line, column })
              
              // Emit EDITOR_CURSOR_MOVED event to workspace daemon
              if (currentProjectId && activeTab) {
                const daemon = getCoreWorkspaceDaemon(currentProjectId)
                daemon.dispatch({
                  type: 'EDITOR_CURSOR_MOVED',
                  payload: { line, column },
                })
              }
            }}
            onSelectionChange={(start, end) => {
              setSelection({ start, end })
              // Selection changes are tracked but not dispatched as separate events
            }}
            readOnly={false}
          />
          {/* Editor Sensor - captures signals for workspace daemon */}
          <EditorSensor
            projectId={currentProjectId}
            activeFilePath={activeTab}
            cursorPosition={cursorPosition}
            selection={selection}
            content={activeTab ? editorTabs.find((t) => t.path === activeTab)?.content : undefined}
          />
        </div>

        {/* Right Panel: Preview/Console/Terminal */}
        <div className="w-96 flex-shrink-0">
          <PreviewPanel
            type={panelType}
            onTypeChange={setPanelType}
            previewUrl={previewUrl}
            consoleOutput={consoleOutput}
            projectId={currentProjectId}
          />
        </div>
      </div>

      {/* Bottom: AI Message Panel */}
      <div className="h-64 flex-shrink-0 border-t border-gray-200 dark:border-gray-800">
        <AIMessagePanel
          messages={aiMessages}
          isStreaming={isStreaming}
          onFileClick={handleFileSelect}
          onFollowUpAction={handleFollowUpAction}
          onFixAction={handleFixAction}
          onPlanApproved={handlePlanApproved}
          onStepApproved={handleStepApproved}
          onStepRollback={handleStepRollback}
          onPlanRollback={handlePlanRollback}
        />
      </div>

      {/* Bottom: User Prompt Input (Replit-style) */}
      <PromptInput
        onSend={handleUserPrompt}
        isProcessing={isProcessing}
        placeholder="Make lightweight changes, quickly..."
      />

      {/* Bottom: Command Bar */}
      <CommandBar onCommand={handleCommand} isProcessing={isProcessing} />

      {/* Agent Presence Indicator - Replit-style */}
      <AgentPresence projectId={currentProjectId} />
    </div>
  )
}
