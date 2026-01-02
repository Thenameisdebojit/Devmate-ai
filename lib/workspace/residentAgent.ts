/**
 * Resident Agent
 * 
 * Event-driven AI agent that observes workspace and reasons proactively.
 * Never sleeps while workspace is active.
 * 
 * ARCHITECTURE:
 * - Subscribes to workspace events
 * - Background reasoning queue
 * - Proactive problem detection
 * - Non-intrusive suggestions
 */

import { WorkspaceIntelligenceDaemon, WorkspaceEvent, IntentScore } from './workspaceDaemon'
import { AgentMessageGenerator } from '../runtime/agentMessages'

export type AgentState = 'watching' | 'ready' | 'acting' | 'thinking'

export interface ReasoningTask {
  id: string
  priority: number
  type: 'fix' | 'explain' | 'optimize' | 'suggest'
  context: any
  createdAt: number
}

export interface AgentSuggestion {
  id: string
  type: 'fix' | 'explain' | 'optimize' | 'hint'
  message: string
  action?: string
  confidence: number
  nonIntrusive: boolean
}

export class ResidentAgent {
  private daemon: WorkspaceIntelligenceDaemon
  private state: AgentState = 'watching'
  private reasoningQueue: ReasoningTask[] = []
  private suggestions: AgentSuggestion[] = []
  private isProcessing: boolean = false
  private unsubscribeCallbacks: Array<() => void> = []

  constructor(projectId: string) {
    this.daemon = WorkspaceIntelligenceDaemon.prototype.constructor === WorkspaceIntelligenceDaemon
      ? new WorkspaceIntelligenceDaemon(projectId)
      : require('./workspaceDaemon').getWorkspaceDaemon(projectId)

    this.setupSubscriptions()
    this.startBackgroundReasoning()
    
    console.log(`[ResidentAgent] Initialized for project: ${projectId}`)
  }

  /**
   * Setup event subscriptions
   */
  private setupSubscriptions() {
    // Build failures → pre-compute fixes
    const unsubscribe1 = this.daemon.subscribe('BUILD_FAILED', (data) => {
      this.queueReasoningTask({
        id: `fix-build-${Date.now()}`,
        priority: 10,
        type: 'fix',
        context: { errors: data.errors },
        createdAt: Date.now(),
      })
    })

    // Runtime crashes → analyze and prepare fix
    const unsubscribe2 = this.daemon.subscribe('RUNTIME_CRASHED', (data) => {
      this.queueReasoningTask({
        id: `fix-runtime-${Date.now()}`,
        priority: 9,
        type: 'fix',
        context: { error: data.error, crashCount: data.crashCount },
        createdAt: Date.now(),
      })
    })

    // Terminal errors → monitor and suggest
    const unsubscribe3 = this.daemon.subscribe('TERMINAL_ERROR_OUTPUT', (data) => {
      const state = this.daemon.getState()
      if (state.terminal.errorOutput.length > 5) {
        this.queueReasoningTask({
          id: `analyze-terminal-${Date.now()}`,
          priority: 7,
          type: 'suggest',
          context: { errors: state.terminal.errorOutput },
          createdAt: Date.now(),
        })
      }
    })

    // File changes → check for issues
    const unsubscribe4 = this.daemon.subscribe('FILE_CHANGED', (data) => {
      const fileState = this.daemon.getFileState(data.path)
      if (fileState && fileState.errors.length > 0) {
        this.queueReasoningTask({
          id: `check-file-${data.path}-${Date.now()}`,
          priority: 5,
          type: 'fix',
          context: { filePath: data.path, errors: fileState.errors },
          createdAt: Date.now(),
        })
      }
    })

    // Dependency added → check compatibility
    const unsubscribe5 = this.daemon.subscribe('DEPENDENCY_ADDED', (data) => {
      this.queueReasoningTask({
        id: `check-dependency-${data.packageName}-${Date.now()}`,
        priority: 6,
        type: 'suggest',
        context: { packageName: data.packageName, version: data.version },
        createdAt: Date.now(),
      })
    })

    // Intent changes → adapt behavior
    const unsubscribe6 = this.daemon.subscribe('INTENT_DETECTED', (intent: IntentScore) => {
      this.adaptToIntent(intent)
    })

    // Error under cursor → immediate attention
    const unsubscribe7 = this.daemon.subscribe('ERROR_UNDER_CURSOR', (data) => {
      this.queueReasoningTask({
        id: `fix-cursor-error-${Date.now()}`,
        priority: 8,
        type: 'fix',
        context: data,
        createdAt: Date.now(),
      })
    })

    this.unsubscribeCallbacks = [
      unsubscribe1,
      unsubscribe2,
      unsubscribe3,
      unsubscribe4,
      unsubscribe5,
      unsubscribe6,
      unsubscribe7,
    ]
  }

  /**
   * Queue a reasoning task
   */
  private queueReasoningTask(task: ReasoningTask) {
    this.reasoningQueue.push(task)
    this.reasoningQueue.sort((a, b) => b.priority - a.priority)
    
    // Limit queue size
    if (this.reasoningQueue.length > 50) {
      this.reasoningQueue = this.reasoningQueue.slice(0, 50)
    }
  }

  /**
   * Start background reasoning loop
   */
  private startBackgroundReasoning() {
    setInterval(() => {
      if (!this.isProcessing && this.reasoningQueue.length > 0) {
        this.processNextTask()
      }
    }, 1000) // Check every second
  }

  /**
   * Process next reasoning task
   */
  private async processNextTask() {
    if (this.reasoningQueue.length === 0) return

    this.isProcessing = true
    this.state = 'thinking'

    const task = this.reasoningQueue.shift()!
    
    try {
      switch (task.type) {
        case 'fix':
          await this.reasonAboutFix(task)
          break
        case 'explain':
          await this.reasonAboutExplain(task)
          break
        case 'optimize':
          await this.reasonAboutOptimize(task)
          break
        case 'suggest':
          await this.reasonAboutSuggestion(task)
          break
      }
    } catch (error) {
      console.error('[ResidentAgent] Reasoning error:', error)
    } finally {
      this.isProcessing = false
      this.state = 'watching'
    }
  }

  /**
   * Reason about fixes
   */
  private async reasonAboutFix(task: ReasoningTask) {
    const state = this.daemon.getState()
    
    // Pre-compute fix suggestions
    if (task.context.errors) {
      // Analyze errors and prepare fixes
      const fixes = this.analyzeErrors(task.context.errors)
      
      if (fixes.length > 0) {
        this.addSuggestion({
          id: `fix-${task.id}`,
          type: 'fix',
          message: `I found ${fixes.length} issue${fixes.length > 1 ? 's' : ''} that I can fix`,
          action: 'auto-fix',
          confidence: 0.85,
          nonIntrusive: true,
        })
      }
    }
  }

  /**
   * Reason about explanations
   */
  private async reasonAboutExplain(task: ReasoningTask) {
    // Prepare explanation context
    const activeFile = this.daemon.getActiveFile()
    if (activeFile) {
      this.addSuggestion({
        id: `explain-${task.id}`,
        type: 'explain',
        message: 'I can explain this code',
        action: 'explain',
        confidence: 0.9,
        nonIntrusive: true,
      })
    }
  }

  /**
   * Reason about optimizations
   */
  private async reasonAboutOptimize(task: ReasoningTask) {
    const state = this.daemon.getState()
    const filesWithIssues = this.daemon.getFilesWithErrors()
    
    if (filesWithIssues.length > 0) {
      this.addSuggestion({
        id: `optimize-${task.id}`,
        type: 'optimize',
        message: 'I can optimize this code',
        action: 'optimize',
        confidence: 0.8,
        nonIntrusive: true,
      })
    }
  }

  /**
   * Reason about suggestions
   */
  private async reasonAboutSuggestion(task: ReasoningTask) {
    // Context-aware suggestions
    const intent = this.daemon.getIntentScore()
    
    if (intent.stuck > 0.7) {
      this.addSuggestion({
        id: `help-${task.id}`,
        type: 'hint',
        message: 'Need help? I can suggest solutions',
        confidence: 0.75,
        nonIntrusive: true,
      })
    }
  }

  /**
   * Analyze errors and prepare fixes
   */
  private analyzeErrors(errors: Array<{ file: string; line: number; message: string }>): Array<{ fix: string; confidence: number }> {
    // Simple error pattern matching
    const fixes: Array<{ fix: string; confidence: number }> = []
    
    errors.forEach((error) => {
      const message = error.message.toLowerCase()
      
      if (message.includes('cannot find module') || message.includes('module not found')) {
        fixes.push({
          fix: `Install missing dependency or fix import path`,
          confidence: 0.9,
        })
      } else if (message.includes('unexpected token') || message.includes('syntax error')) {
        fixes.push({
          fix: `Fix syntax error at line ${error.line}`,
          confidence: 0.85,
        })
      } else if (message.includes('is not defined')) {
        fixes.push({
          fix: `Define missing variable or import`,
          confidence: 0.8,
        })
      }
    })
    
    return fixes
  }

  /**
   * Adapt agent behavior to user intent
   */
  private adaptToIntent(intent: IntentScore) {
    // Adjust reasoning priorities based on intent
    if (intent.debugging > 0.7) {
      // Prioritize fix tasks
      this.reasoningQueue.forEach((task) => {
        if (task.type === 'fix') {
          task.priority += 2
        }
      })
    } else if (intent.learning > 0.6) {
      // Prioritize explain tasks
      this.reasoningQueue.forEach((task) => {
        if (task.type === 'explain') {
          task.priority += 2
        }
      })
    }
    
    // Re-sort queue
    this.reasoningQueue.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Add suggestion
   */
  private addSuggestion(suggestion: AgentSuggestion) {
    // Remove similar suggestions
    this.suggestions = this.suggestions.filter(
      (s) => s.type !== suggestion.type || s.message !== suggestion.message
    )
    
    this.suggestions.push(suggestion)
    
    // Limit suggestions
    if (this.suggestions.length > 10) {
      this.suggestions = this.suggestions.slice(-10)
    }
    
    // Emit suggestion event
    this.daemon.emit('AGENT_SUGGESTION', suggestion)
  }

  /**
   * Get current state
   */
  getState(): AgentState {
    return this.state
  }

  /**
   * Get suggestions
   */
  getSuggestions(): AgentSuggestion[] {
    return [...this.suggestions]
  }

  /**
   * Clear suggestions
   */
  clearSuggestions() {
    this.suggestions = []
  }

  /**
   * Cleanup
   */
  destroy() {
    this.unsubscribeCallbacks.forEach((unsub) => unsub())
    this.reasoningQueue = []
    this.suggestions = []
    this.isProcessing = false
    this.state = 'watching'
  }
}

// Singleton per project
const agentInstances = new Map<string, ResidentAgent>()

export function getResidentAgent(projectId: string): ResidentAgent {
  if (!agentInstances.has(projectId)) {
    agentInstances.set(projectId, new ResidentAgent(projectId))
  }
  return agentInstances.get(projectId)!
}

export function destroyResidentAgent(projectId: string) {
  const agent = agentInstances.get(projectId)
  if (agent) {
    agent.destroy()
    agentInstances.delete(projectId)
  }
}

