/**
 * Workspace Intelligence Daemon (WID)
 * 
 * Persistent, stateful workspace brain that owns canonical truth.
 * Never shuts down while workspace is open.
 * 
 * ARCHITECTURE:
 * - Single source of truth for workspace state
 * - Event-driven state updates
 * - Subscription API for agents and UI
 * - Survives across user actions
 */

import { EventEmitter } from 'events'

export type WorkspaceEvent =
  | 'FILE_CHANGED'
  | 'FILE_SAVED'
  | 'FILE_DELETED'
  | 'FILE_CREATED'
  | 'BUILD_FAILED'
  | 'BUILD_SUCCEEDED'
  | 'RUNTIME_CRASHED'
  | 'RUNTIME_STARTED'
  | 'RUNTIME_STOPPED'
  | 'DEPENDENCY_ADDED'
  | 'DEPENDENCY_REMOVED'
  | 'EDITOR_FOCUS_CHANGED'
  | 'EDITOR_CURSOR_MOVED'
  | 'EDITOR_SELECTION_CHANGED'
  | 'TERMINAL_ERROR_OUTPUT'
  | 'TERMINAL_OUTPUT'
  | 'ERROR_UNDER_CURSOR'
  | 'INTENT_DETECTED'

export interface FileState {
  path: string
  content: string
  savedContent: string
  isDirty: boolean
  lastModified: number
  openCount: number
  dwellTime: number // Time spent with file open
  errorCount: number
  errors: Array<{
    line: number
    column: number
    message: string
    severity: 'error' | 'warning'
  }>
}

export interface EditorState {
  activeFilePath?: string
  cursorPosition?: { line: number; column: number }
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } }
  focusedEditor: boolean
  lastActivity: number
}

export interface RuntimeState {
  status: 'idle' | 'starting' | 'running' | 'crashed' | 'stopped'
  containerId?: string
  port?: number
  previewUrl?: string
  lastError?: string
  startTime?: number
  crashCount: number
}

export interface BuildState {
  status: 'idle' | 'building' | 'success' | 'failed'
  lastBuildTime?: number
  errors: Array<{
    file: string
    line: number
    message: string
  }>
  warnings: Array<{
    file: string
    line: number
    message: string
  }>
}

export interface DependencyState {
  dependencies: Map<string, string>
  devDependencies: Map<string, string>
  lastUpdated: number
  compatibilityIssues: Array<{
    package: string
    issue: string
  }>
}

export interface TerminalState {
  output: string[]
  errorOutput: string[]
  lastErrorTime?: number
  commandHistory: string[]
}

export interface WorkspaceState {
  projectId: string
  files: Map<string, FileState>
  editor: EditorState
  runtime: RuntimeState
  build: BuildState
  dependencies: DependencyState
  terminal: TerminalState
  lastUpdated: number
}

export interface IntentScore {
  debugging: number
  refactoring: number
  learning: number
  writing: number
  exploring: number
  stuck: number
}

export class WorkspaceIntelligenceDaemon extends EventEmitter {
  private state: WorkspaceState
  private intentScore: IntentScore
  private isActive: boolean = true
  private updateInterval?: NodeJS.Timeout

  constructor(projectId: string) {
    super()
    
    this.state = {
      projectId,
      files: new Map(),
      editor: {
        focusedEditor: false,
        lastActivity: Date.now(),
      },
      runtime: {
        status: 'idle',
        crashCount: 0,
      },
      build: {
        status: 'idle',
        errors: [],
        warnings: [],
      },
      dependencies: {
        dependencies: new Map(),
        devDependencies: new Map(),
        lastUpdated: Date.now(),
        compatibilityIssues: [],
      },
      terminal: {
        output: [],
        errorOutput: [],
        commandHistory: [],
      },
      lastUpdated: Date.now(),
    }

    this.intentScore = {
      debugging: 0,
      refactoring: 0,
      learning: 0,
      writing: 0,
      exploring: 0,
      stuck: 0,
    }

    // Start background processing
    this.start()
  }

  /**
   * Start the daemon
   */
  private start() {
    // Periodic intent inference
    this.updateInterval = setInterval(() => {
      this.computeIntentScore()
      this.emit('INTENT_DETECTED', this.intentScore)
    }, 2000) // Every 2 seconds

    console.log(`[WID] Started for project: ${this.state.projectId}`)
  }

  /**
   * Stop the daemon
   */
  stop() {
    this.isActive = false
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
    this.removeAllListeners()
    console.log(`[WID] Stopped for project: ${this.state.projectId}`)
  }

  /**
   * Get current workspace state
   */
  getState(): WorkspaceState {
    return { ...this.state }
  }

  /**
   * Get intent score
   */
  getIntentScore(): IntentScore {
    return { ...this.intentScore }
  }

  /**
   * File operations
   */
  fileChanged(path: string, content: string) {
    const fileState = this.state.files.get(path) || {
      path,
      content: '',
      savedContent: '',
      isDirty: false,
      lastModified: Date.now(),
      openCount: 0,
      dwellTime: 0,
      errorCount: 0,
      errors: [],
    }

    fileState.content = content
    fileState.isDirty = fileState.content !== fileState.savedContent
    fileState.lastModified = Date.now()

    this.state.files.set(path, fileState)
    this.state.lastUpdated = Date.now()

    this.emit('FILE_CHANGED', { path, content, fileState })
  }

  fileSaved(path: string, content: string) {
    const fileState = this.state.files.get(path)
    if (fileState) {
      fileState.savedContent = content
      fileState.content = content
      fileState.isDirty = false
      fileState.lastModified = Date.now()
    }

    this.state.lastUpdated = Date.now()
    this.emit('FILE_SAVED', { path, content })
  }

  fileCreated(path: string, content: string) {
    const fileState: FileState = {
      path,
      content,
      savedContent: content,
      isDirty: false,
      lastModified: Date.now(),
      openCount: 0,
      dwellTime: 0,
      errorCount: 0,
      errors: [],
    }

    this.state.files.set(path, fileState)
    this.state.lastUpdated = Date.now()
    this.emit('FILE_CREATED', { path, content })
  }

  fileDeleted(path: string) {
    this.state.files.delete(path)
    this.state.lastUpdated = Date.now()
    this.emit('FILE_DELETED', { path })
  }

  /**
   * Editor operations
   */
  editorFocusChanged(filePath: string | undefined) {
    // Update dwell time for previous file
    if (this.state.editor.activeFilePath && this.state.editor.activeFilePath !== filePath) {
      const prevFile = this.state.files.get(this.state.editor.activeFilePath)
      if (prevFile) {
        const timeSpent = Date.now() - this.state.editor.lastActivity
        prevFile.dwellTime += timeSpent
      }
    }

    this.state.editor.activeFilePath = filePath
    this.state.editor.lastActivity = Date.now()
    this.state.editor.focusedEditor = true

    if (filePath) {
      const fileState = this.state.files.get(filePath)
      if (fileState) {
        fileState.openCount++
      }
    }

    this.emit('EDITOR_FOCUS_CHANGED', { filePath })
  }

  editorCursorMoved(line: number, column: number) {
    this.state.editor.cursorPosition = { line, column }
    this.state.editor.lastActivity = Date.now()
    this.emit('EDITOR_CURSOR_MOVED', { line, column })
  }

  editorSelectionChanged(start: { line: number; column: number }, end: { line: number; column: number }) {
    this.state.editor.selection = { start, end }
    this.state.editor.lastActivity = Date.now()
    this.emit('EDITOR_SELECTION_CHANGED', { start, end })
  }

  errorUnderCursor(filePath: string, line: number, column: number, message: string, severity: 'error' | 'warning') {
    const fileState = this.state.files.get(filePath)
    if (fileState) {
      const existingError = fileState.errors.find(
        (e) => e.line === line && e.column === column && e.message === message
      )
      if (!existingError) {
        fileState.errors.push({ line, column, message, severity })
        fileState.errorCount++
      }
    }

    this.emit('ERROR_UNDER_CURSOR', { filePath, line, column, message, severity })
  }

  /**
   * Runtime operations
   */
  runtimeStarted(containerId: string, port: number, previewUrl: string) {
    this.state.runtime = {
      status: 'running',
      containerId,
      port,
      previewUrl,
      startTime: Date.now(),
      crashCount: this.state.runtime.crashCount,
    }
    this.emit('RUNTIME_STARTED', this.state.runtime)
  }

  runtimeCrashed(error: string) {
    this.state.runtime.status = 'crashed'
    this.state.runtime.lastError = error
    this.state.runtime.crashCount++
    this.emit('RUNTIME_CRASHED', { error, crashCount: this.state.runtime.crashCount })
  }

  runtimeStopped() {
    this.state.runtime.status = 'stopped'
    this.emit('RUNTIME_STOPPED')
  }

  /**
   * Build operations
   */
  buildFailed(errors: Array<{ file: string; line: number; message: string }>) {
    this.state.build.status = 'failed'
    this.state.build.errors = errors
    this.state.build.lastBuildTime = Date.now()

    // Update file error states
    errors.forEach((error) => {
      const fileState = this.state.files.get(error.file)
      if (fileState) {
        fileState.errorCount++
        fileState.errors.push({
          line: error.line,
          column: 0,
          message: error.message,
          severity: 'error',
        })
      }
    })

    this.emit('BUILD_FAILED', { errors })
  }

  buildSucceeded(warnings?: Array<{ file: string; line: number; message: string }>) {
    this.state.build.status = 'success'
    this.state.build.errors = []
    this.state.build.warnings = warnings || []
    this.state.build.lastBuildTime = Date.now()
    this.emit('BUILD_SUCCEEDED', { warnings })
  }

  /**
   * Dependency operations
   */
  dependencyAdded(packageName: string, version: string, isDev: boolean = false) {
    if (isDev) {
      this.state.dependencies.devDependencies.set(packageName, version)
    } else {
      this.state.dependencies.dependencies.set(packageName, version)
    }
    this.state.dependencies.lastUpdated = Date.now()
    this.emit('DEPENDENCY_ADDED', { packageName, version, isDev })
  }

  dependencyRemoved(packageName: string, isDev: boolean = false) {
    if (isDev) {
      this.state.dependencies.devDependencies.delete(packageName)
    } else {
      this.state.dependencies.dependencies.delete(packageName)
    }
    this.state.dependencies.lastUpdated = Date.now()
    this.emit('DEPENDENCY_REMOVED', { packageName, isDev })
  }

  /**
   * Terminal operations
   */
  terminalOutput(output: string) {
    this.state.terminal.output.push(output)
    if (this.state.terminal.output.length > 1000) {
      this.state.terminal.output.shift() // Keep last 1000 lines
    }
    this.emit('TERMINAL_OUTPUT', { output })
  }

  terminalErrorOutput(error: string) {
    this.state.terminal.errorOutput.push(error)
    this.state.terminal.lastErrorTime = Date.now()
    if (this.state.terminal.errorOutput.length > 100) {
      this.state.terminal.errorOutput.shift()
    }
    this.emit('TERMINAL_ERROR_OUTPUT', { error })
  }

  /**
   * Compute intent score based on workspace state
   */
  private computeIntentScore() {
    const state = this.state
    const intent: IntentScore = {
      debugging: 0,
      refactoring: 0,
      learning: 0,
      writing: 0,
      exploring: 0,
      stuck: 0,
    }

    // Debugging signals
    if (state.build.errors.length > 0) intent.debugging += 0.3
    if (state.runtime.status === 'crashed') intent.debugging += 0.4
    if (state.terminal.errorOutput.length > 0) intent.debugging += 0.2
    if (state.editor.cursorPosition) {
      const activeFile = state.files.get(state.editor.activeFilePath || '')
      if (activeFile) {
        const errorAtCursor = activeFile.errors.some(
          (e) => e.line === state.editor.cursorPosition?.line
        )
        if (errorAtCursor) intent.debugging += 0.3
      }
    }

    // Refactoring signals
    const filesWithErrors = Array.from(state.files.values()).filter((f) => f.errorCount > 0).length
    if (filesWithErrors > 2) intent.refactoring += 0.3
    if (state.build.warnings.length > 5) intent.refactoring += 0.2

    // Learning signals
    const highDwellTime = Array.from(state.files.values()).some((f) => f.dwellTime > 60000)
    if (highDwellTime) intent.learning += 0.3
    if (state.editor.selection) intent.learning += 0.2 // Reading code

    // Writing signals
    const dirtyFiles = Array.from(state.files.values()).filter((f) => f.isDirty).length
    if (dirtyFiles > 0) intent.writing += 0.4
    if (state.editor.lastActivity && Date.now() - state.editor.lastActivity < 5000) {
      intent.writing += 0.3 // Recent activity
    }

    // Exploring signals
    const manyOpenFiles = Array.from(state.files.values()).filter((f) => f.openCount > 0).length
    if (manyOpenFiles > 5) intent.exploring += 0.3
    if (state.editor.cursorPosition && state.editor.lastActivity) {
      const timeSinceActivity = Date.now() - state.editor.lastActivity
      if (timeSinceActivity < 2000) intent.exploring += 0.2 // Active navigation
    }

    // Stuck signals
    if (state.runtime.crashCount > 2) intent.stuck += 0.4
    if (state.build.errors.length > 5) intent.stuck += 0.3
    if (state.terminal.errorOutput.length > 10) intent.stuck += 0.3
    const noActivity = state.editor.lastActivity && Date.now() - state.editor.lastActivity > 30000
    if (noActivity && state.build.errors.length > 0) intent.stuck += 0.4

    // Normalize scores to 0-1
    Object.keys(intent).forEach((key) => {
      intent[key as keyof IntentScore] = Math.min(1, intent[key as keyof IntentScore])
    })

    this.intentScore = intent
  }

  /**
   * Subscribe to workspace events
   */
  subscribe(event: WorkspaceEvent, callback: (data: any) => void) {
    this.on(event, callback)
    return () => this.off(event, callback)
  }

  /**
   * Get file state
   */
  getFileState(path: string): FileState | undefined {
    return this.state.files.get(path)
  }

  /**
   * Get all files with errors
   */
  getFilesWithErrors(): FileState[] {
    return Array.from(this.state.files.values()).filter((f) => f.errorCount > 0)
  }

  /**
   * Get active file
   */
  getActiveFile(): FileState | undefined {
    if (!this.state.editor.activeFilePath) return undefined
    return this.state.files.get(this.state.editor.activeFilePath)
  }
}

// Singleton per project
const daemonInstances = new Map<string, WorkspaceIntelligenceDaemon>()

export function getWorkspaceDaemon(projectId: string): WorkspaceIntelligenceDaemon {
  if (!daemonInstances.has(projectId)) {
    daemonInstances.set(projectId, new WorkspaceIntelligenceDaemon(projectId))
  }
  return daemonInstances.get(projectId)!
}

export function stopWorkspaceDaemon(projectId: string) {
  const daemon = daemonInstances.get(projectId)
  if (daemon) {
    daemon.stop()
    daemonInstances.delete(projectId)
  }
}

