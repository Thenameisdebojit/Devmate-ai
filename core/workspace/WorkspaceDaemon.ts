/**
 * Workspace Intelligence Daemon
 * 
 * Long-lived in-memory state container for workspace truth.
 * 
 * RULES:
 * - No AI calls
 * - No async logic
 * - No UI rendering
 * - No background loops
 * - Pure state management
 */

import { EventEmitter } from 'events'

/**
 * Workspace State
 * Canonical source of truth for workspace
 */
export interface WorkspaceState {
  projectId: string
  timestamp: number
  files: Map<string, FileState>
  editor: EditorState
  runtime: RuntimeState
  build: BuildState
  intent: IntentState
  dominantIntent: keyof IntentState
  hasAnnouncedPresence: boolean
}

export interface FileState {
  path: string
  content: string
  lastModified: number
  isDirty: boolean
}

export interface EditorState {
  activeFilePath?: string
  cursorLine?: number
  cursorColumn?: number
  lastActivity: number
}

export interface RuntimeState {
  status: 'idle' | 'running' | 'crashed'
  containerId?: string
  port?: number
}

export interface BuildState {
  status: 'idle' | 'building' | 'success' | 'failed'
  errors: Array<{ file: string; line: number; message: string }>
  lastBuildTime?: number
}

export interface IntentState {
  debugging: number
  refactoring: number
  generating: number
  learning: number
}

/**
 * Workspace Events
 */
export type WorkspaceEvent =
  | { type: 'FILE_CHANGED'; payload: { path: string; content: string } }
  | { type: 'FILE_SAVED'; payload: { path: string } }
  | { type: 'EDITOR_FOCUS_CHANGED'; payload: { filePath?: string } }
  | { type: 'EDITOR_CURSOR_MOVED'; payload: { line: number; column: number } }
  | { type: 'BUILD_STARTED'; payload: {} }
  | { type: 'BUILD_FAILED'; payload: { errors: Array<{ file: string; line: number; message: string }> } }
  | { type: 'BUILD_SUCCEEDED'; payload: {} }
  | { type: 'RUNTIME_STARTED'; payload: { containerId: string; port: number } }
  | { type: 'RUNTIME_CRASHED'; payload: { error: string } }
  | { type: 'RUNTIME_STOPPED'; payload: {} }
  | { type: 'NEW_FILES_CREATED'; payload: { count: number } }
  | { type: 'CURSOR_IDLE'; payload: { filePath: string; duration: number } }
  | { type: 'AGENT_OBSERVATION'; payload: { id: string; timestamp: number; message: string; category: string; confidence: number } }
  | { type: 'AGENT_SUGGESTION'; payload: { id: string; timestamp: number; message: string; category: string; confidence: number } }
  | { type: 'AGENT_ACTION_REQUESTED'; payload: { actionType: string } }
  | { type: 'AGENT_PLAN_PROPOSED'; payload: { plan: any } }
  | { type: 'AGENT_PLAN_APPROVED'; payload: { planId: string } }
  | { type: 'AGENT_PLAN_STEP_APPROVED'; payload: { planId: string; stepId: string } }
  | { type: 'AGENT_PLAN_STEP_COMPLETED'; payload: { planId: string; stepId: string; result: any } }

/**
 * Workspace Event Bus
 * Simple event emitter for workspace events
 */
export class WorkspaceEventBus extends EventEmitter {
  emit(event: WorkspaceEvent): boolean {
    return super.emit(event.type, event.payload)
  }

  on(eventType: WorkspaceEvent['type'], handler: (payload: any) => void): this {
    return super.on(eventType, handler)
  }

  off(eventType: WorkspaceEvent['type'], handler: (payload: any) => void): this {
    return super.off(eventType, handler)
  }
}

/**
 * Workspace Intelligence Daemon
 * 
 * Owns workspace state and event bus.
 * Pure state management - no side effects.
 */
export class WorkspaceDaemon {
  private state: WorkspaceState
  private eventBus: WorkspaceEventBus
  private decayInterval?: NodeJS.Timeout
  private lastFileSaveTime: Map<string, number> = new Map()
  private cursorIdleStart: Map<string, number> = new Map()

  constructor(projectId: string) {
    this.state = this.createInitialState(projectId)
    this.eventBus = new WorkspaceEventBus()
    this.startDecayLoop()
  }

  /**
   * Create initial workspace state
   */
  private createInitialState(projectId: string): WorkspaceState {
    const initialIntent: IntentState = {
      debugging: 0.25,
      refactoring: 0.25,
      generating: 0.25,
      learning: 0.25,
    }

    return {
      projectId,
      timestamp: Date.now(),
      files: new Map(),
      editor: {
        lastActivity: Date.now(),
      },
      runtime: {
        status: 'idle',
      },
      build: {
        status: 'idle',
        errors: [],
      },
      intent: initialIntent,
      dominantIntent: 'debugging',
      hasAnnouncedPresence: false,
    }
  }

  /**
   * Start decay loop for intent scores
   */
  private startDecayLoop() {
    // Decay every 2 seconds
    this.decayInterval = setInterval(() => {
      this.decayIntentScores()
    }, 2000)
  }

  /**
   * Decay intent scores by 2% and normalize
   */
  private decayIntentScores() {
    const intent = this.state.intent
    
    // Decay all scores by 2%
    const decayed: IntentState = {
      debugging: Math.max(0, intent.debugging * 0.98),
      refactoring: Math.max(0, intent.refactoring * 0.98),
      generating: Math.max(0, intent.generating * 0.98),
      learning: Math.max(0, intent.learning * 0.98),
    }

    // Normalize so total = 1
    const total = decayed.debugging + decayed.refactoring + decayed.generating + decayed.learning
    if (total > 0) {
      const normalized: IntentState = {
        debugging: decayed.debugging / total,
        refactoring: decayed.refactoring / total,
        generating: decayed.generating / total,
        learning: decayed.learning / total,
      }

      // Clamp between 0 and 1
      const clamped: IntentState = {
        debugging: Math.max(0, Math.min(1, normalized.debugging)),
        refactoring: Math.max(0, Math.min(1, normalized.refactoring)),
        generating: Math.max(0, Math.min(1, normalized.generating)),
        learning: Math.max(0, Math.min(1, normalized.learning)),
      }

      // Compute dominant intent
      const dominantIntent = this.computeDominantIntent(clamped)

      this.state = {
        ...this.state,
        intent: clamped,
        dominantIntent,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Compute dominant intent (max score)
   */
  private computeDominantIntent(intent: IntentState): keyof IntentState {
    let maxScore = intent.debugging
    let dominant: keyof IntentState = 'debugging'

    if (intent.refactoring > maxScore) {
      maxScore = intent.refactoring
      dominant = 'refactoring'
    }
    if (intent.generating > maxScore) {
      maxScore = intent.generating
      dominant = 'generating'
    }
    if (intent.learning > maxScore) {
      maxScore = intent.learning
      dominant = 'learning'
    }

    return dominant
  }

  /**
   * Update intent scores based on event
   */
  private updateIntentFromEvent(event: WorkspaceEvent) {
    const intent = { ...this.state.intent }

    switch (event.type) {
      case 'BUILD_FAILED':
        intent.debugging = Math.min(1, intent.debugging + 0.2)
        break

      case 'RUNTIME_CRASHED':
        intent.debugging = Math.min(1, intent.debugging + 0.3)
        break

      case 'FILE_SAVED': {
        const path = event.payload.path
        const now = Date.now()
        const lastSave = this.lastFileSaveTime.get(path) || 0
        
        // Rapid saves (within 5 seconds) indicate refactoring
        if (now - lastSave < 5000 && now - lastSave > 0) {
          intent.refactoring = Math.min(1, intent.refactoring + 0.1)
        }
        
        this.lastFileSaveTime.set(path, now)
        break
      }

      case 'NEW_FILES_CREATED':
        intent.generating = Math.min(1, intent.generating + 0.3)
        break

      case 'CURSOR_IDLE': {
        // Cursor idle on same file for > 10 seconds indicates learning
        if (event.payload.duration > 10000) {
          intent.learning = Math.min(1, intent.learning + 0.1)
        }
        break
      }

      default:
        // Other events don't affect intent
        return
    }

    // Normalize after updates
    const total = intent.debugging + intent.refactoring + intent.generating + intent.learning
    if (total > 0) {
      const normalized: IntentState = {
        debugging: intent.debugging / total,
        refactoring: intent.refactoring / total,
        generating: intent.generating / total,
        learning: intent.learning / total,
      }

      // Clamp between 0 and 1
      const clamped: IntentState = {
        debugging: Math.max(0, Math.min(1, normalized.debugging)),
        refactoring: Math.max(0, Math.min(1, normalized.refactoring)),
        generating: Math.max(0, Math.min(1, normalized.generating)),
        learning: Math.max(0, Math.min(1, normalized.learning)),
      }

      // Compute dominant intent
      const dominantIntent = this.computeDominantIntent(clamped)

      this.state = {
        ...this.state,
        intent: clamped,
        dominantIntent,
      }
    }
  }

  /**
   * Get current state (read-only)
   */
  getState(): Readonly<WorkspaceState> {
    return { ...this.state }
  }

  /**
   * Get event bus
   */
  getEventBus(): WorkspaceEventBus {
    return this.eventBus
  }

  /**
   * Dispatch event
   * Updates state via reducer and emits event
   */
  dispatch(event: WorkspaceEvent): void {
    // Update intent scores based on event
    this.updateIntentFromEvent(event)
    
    // Update state via reducer
    this.state = this.reduce(this.state, event)
    
    // Update timestamp
    this.state.timestamp = Date.now()
    
    // Emit workspace awareness message on first activation
    if (!this.state.hasAnnouncedPresence) {
      // Trigger on first file change or first editor focus
      if (event.type === 'FILE_CHANGED' || event.type === 'EDITOR_FOCUS_CHANGED') {
        // Mark as announced
        this.state.hasAnnouncedPresence = true
        
        // Emit workspace awareness observation
        this.eventBus.emit({
          type: 'AGENT_OBSERVATION',
          payload: {
            id: `presence-${Date.now()}`,
            timestamp: Date.now(),
            message: '[observing] Project initialized. I\'m tracking file changes and runtime health.',
            category: 'pattern',
            confidence: 1.0,
          },
        } as any)
      }
    }
    
    // Emit event
    this.eventBus.emit(event)
  }

  /**
   * Reducer function
   * Pure function that computes new state from event
   */
  private reduce(state: WorkspaceState, event: WorkspaceEvent): WorkspaceState {
    switch (event.type) {
      case 'FILE_CHANGED': {
        const { path, content } = event.payload
        const files = new Map(state.files)
        const existing = files.get(path)
        const isNewFile = !existing
        
        files.set(path, {
          path,
          content,
          lastModified: Date.now(),
          isDirty: existing ? content !== existing.content : false,
        })
        
        // Track new file creation for generating intent
        if (isNewFile) {
          // Update intent directly (synchronous)
          this.updateIntentFromEvent({
            type: 'NEW_FILES_CREATED',
            payload: { count: 1 },
          })
        }
        
        return {
          ...state,
          files,
        }
      }

      case 'FILE_SAVED': {
        const { path } = event.payload
        const files = new Map(state.files)
        const file = files.get(path)
        
        if (file) {
          files.set(path, {
            ...file,
            isDirty: false,
          })
        }
        
        return {
          ...state,
          files,
        }
      }

      case 'EDITOR_FOCUS_CHANGED': {
        const newFilePath = event.payload.filePath
        const oldFilePath = state.editor.activeFilePath
        
        // Reset cursor idle tracking when file changes
        if (oldFilePath && oldFilePath !== newFilePath) {
          this.cursorIdleStart.delete(oldFilePath)
        }
        if (newFilePath) {
          this.cursorIdleStart.set(newFilePath, Date.now())
        }
        
        return {
          ...state,
          editor: {
            ...state.editor,
            activeFilePath: newFilePath,
            lastActivity: Date.now(),
          },
        }
      }

      case 'EDITOR_CURSOR_MOVED': {
        const now = Date.now()
        const activeFile = state.editor.activeFilePath
        
        // Track cursor idle time for learning intent
        if (activeFile) {
          const lastMove = this.cursorIdleStart.get(activeFile) || now
          const idleDuration = now - lastMove
          
          // If cursor was idle for > 10 seconds, update learning intent
          if (idleDuration > 10000 && lastMove < now - 10000) {
            this.updateIntentFromEvent({
              type: 'CURSOR_IDLE',
              payload: { filePath: activeFile, duration: idleDuration },
            })
          }
          
          this.cursorIdleStart.set(activeFile, now)
        }
        
        return {
          ...state,
          editor: {
            ...state.editor,
            cursorLine: event.payload.line,
            cursorColumn: event.payload.column,
            lastActivity: Date.now(),
          },
        }
      }

      case 'BUILD_STARTED': {
        return {
          ...state,
          build: {
            status: 'building',
            errors: [],
            lastBuildTime: Date.now(),
          },
        }
      }

      case 'BUILD_FAILED': {
        return {
          ...state,
          build: {
            status: 'failed',
            errors: event.payload.errors,
            lastBuildTime: Date.now(),
          },
        }
      }

      case 'BUILD_SUCCEEDED': {
        return {
          ...state,
          build: {
            status: 'success',
            errors: [],
            lastBuildTime: Date.now(),
          },
        }
      }

      case 'RUNTIME_STARTED': {
        return {
          ...state,
          runtime: {
            status: 'running',
            containerId: event.payload.containerId,
            port: event.payload.port,
          },
        }
      }

      case 'RUNTIME_CRASHED': {
        return {
          ...state,
          runtime: {
            ...state.runtime,
            status: 'crashed',
          },
        }
      }

      case 'RUNTIME_STOPPED': {
        return {
          ...state,
          runtime: {
            status: 'idle',
            containerId: undefined,
            port: undefined,
          },
        }
      }

      case 'NEW_FILES_CREATED':
      case 'CURSOR_IDLE':
        // These events only affect intent, not state structure
        return state

      default:
        return state
    }
  }

  /**
   * Stop decay loop (cleanup)
   */
  stop() {
    if (this.decayInterval) {
      clearInterval(this.decayInterval)
    }
  }
}

/**
 * Singleton getter
 * Returns or creates WorkspaceDaemon instance for project
 */
const daemonInstances = new Map<string, WorkspaceDaemon>()

export function getWorkspaceDaemon(projectId: string): WorkspaceDaemon {
  if (!daemonInstances.has(projectId)) {
    daemonInstances.set(projectId, new WorkspaceDaemon(projectId))
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

