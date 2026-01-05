/**
 * Agent Observer
 * 
 * Read-only intelligence that observes workspace events.
 * Generates internal "thoughts" without taking actions.
 * 
 * RULES:
 * - NO file writes
 * - NO command execution
 * - NO runtime modification
 * - Read-only cognition only
 */

import { WorkspaceDaemon, WorkspaceEvent, WorkspaceState, IntentState, getWorkspaceDaemon } from './WorkspaceDaemon'
import { getAgentConfidenceEngine } from './AgentConfidenceEngine'

export interface AgentObservation {
  id: string
  timestamp: number
  message: string
  category: 'error' | 'intent' | 'stability' | 'pattern'
  confidence: number
}

export class AgentObserver {
  private daemon: WorkspaceDaemon
  private observations: AgentObservation[] = []
  private unsubscribeCallbacks: Array<() => void> = []
  
  // Pattern tracking
  private errorHistory: Array<{ type: string; timestamp: number }> = []
  private fileSaveHistory: Map<string, number[]> = new Map()
  private intentHistory: Array<{ intent: keyof IntentState; score: number; timestamp: number }> = []
  private lastIntent: keyof IntentState | null = null
  
  // Consecutive build failure tracking (for autonomous suggestions)
  private consecutiveBuildFailures: number = 0
  private lastBuildFailureTime: number = 0
  private suggestionEmitted: boolean = false

  constructor(daemon: WorkspaceDaemon) {
    this.daemon = daemon
    this.setupSubscriptions()
  }

  /**
   * Setup event subscriptions
   */
  private setupSubscriptions() {
    const eventBus = this.daemon.getEventBus()

    // Subscribe to all workspace events
    const unsubscribe1 = eventBus.on('BUILD_FAILED', (payload) => {
      this.observe({ type: 'BUILD_FAILED', payload }, this.daemon.getState())
    })

    const unsubscribe2 = eventBus.on('RUNTIME_CRASHED', (payload) => {
      this.observe({ type: 'RUNTIME_CRASHED', payload }, this.daemon.getState())
    })

    const unsubscribe3 = eventBus.on('FILE_SAVED', (payload) => {
      this.observe({ type: 'FILE_SAVED', payload }, this.daemon.getState())
    })

    const unsubscribe4 = eventBus.on('EDITOR_FOCUS_CHANGED', (payload) => {
      this.observe({ type: 'EDITOR_FOCUS_CHANGED', payload }, this.daemon.getState())
    })

    const unsubscribe5 = eventBus.on('BUILD_SUCCEEDED', (payload) => {
      // Reset consecutive failure counter on successful build
      this.consecutiveBuildFailures = 0
      this.suggestionEmitted = false
    })

    // Track intent changes by polling state
    this.startIntentTracking()

    this.unsubscribeCallbacks = [unsubscribe1, unsubscribe2, unsubscribe3, unsubscribe4, unsubscribe5]
  }

  /**
   * Start tracking intent changes
   */
  private startIntentTracking() {
    setInterval(() => {
      const state = this.daemon.getState()
      const currentIntent = state.dominantIntent
      const intentScore = state.intent[currentIntent]

      if (this.lastIntent !== currentIntent) {
        this.observe(
          { type: 'INTENT_CHANGED', payload: { intent: currentIntent, score: intentScore } },
          state
        )
        this.lastIntent = currentIntent
      }

      // Track intent history
      this.intentHistory.push({
        intent: currentIntent,
        score: intentScore,
        timestamp: Date.now(),
      })

      // Keep last 50 intent snapshots
      if (this.intentHistory.length > 50) {
        this.intentHistory.shift()
      }
    }, 3000) // Check every 3 seconds
  }

  /**
   * Observe event and generate thoughts
   */
  private observe(event: WorkspaceEvent, state: WorkspaceState): void {
    const observations: AgentObservation[] = []

    switch (event.type) {
      case 'BUILD_FAILED': {
        const errors = event.payload.errors || []
        const now = Date.now()
        
        // Track error history
        this.errorHistory.push({
          type: 'BUILD_FAILED',
          timestamp: now,
        })

        // Keep last 20 errors
        if (this.errorHistory.length > 20) {
          this.errorHistory.shift()
        }

        // Track consecutive build failures (within 10 minute window)
        if (now - this.lastBuildFailureTime < 600000) { // 10 minutes
          this.consecutiveBuildFailures++
        } else {
          // Reset if too much time has passed
          this.consecutiveBuildFailures = 1
        }
        this.lastBuildFailureTime = now

        // Detect recurring errors
        const recentErrors = this.errorHistory.filter(
          (e) => Date.now() - e.timestamp < 60000 // Last minute
        )

        if (recentErrors.length >= 2) {
          observations.push({
            id: `obs-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            message: `[observing] Build failed ${recentErrors.length} times recently. Likely dependency issue or syntax error.`,
            category: 'error',
            confidence: 0.8,
          })
        } else if (errors.length > 0) {
          const errorFiles = new Set(errors.map((e) => e.file))
          if (errorFiles.size === 1) {
            observations.push({
              id: `obs-${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
              message: `[observing] Build failed with ${errors.length} error${errors.length > 1 ? 's' : ''} in ${Array.from(errorFiles)[0]}.`,
              category: 'error',
              confidence: 0.7,
            })
          } else {
            observations.push({
              id: `obs-${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
              message: `[observing] Build failed with ${errors.length} errors across ${errorFiles.size} files.`,
              category: 'error',
              confidence: 0.7,
            })
          }
        }

        // AUTONOMOUS SUGGESTION: Two consecutive build failures
        if (this.consecutiveBuildFailures >= 2 && !this.suggestionEmitted) {
          this.suggestionEmitted = true
          
          // Get confidence context to reference in message
          let confidenceContext = ''
          try {
            const confidenceEngine = getAgentConfidenceEngine(this.daemon.getState().projectId)
            const report = confidenceEngine.getCurrentReport()
            if (report.riskLevel === 'HIGH') {
              confidenceContext = ' There\'s significant risk here — recent build failures detected.'
            } else if (report.riskLevel === 'MEDIUM') {
              confidenceContext = ' There\'s some risk here — recent build failures detected.'
            }
          } catch {
            // Confidence engine not available, skip context
          }
          
          // Emit suggestion event (distinct from observation)
          this.daemon.getEventBus().emit({
            type: 'AGENT_SUGGESTION',
            payload: {
              id: `suggestion-${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
              message: `[suggestion] The build failed twice in a row.${confidenceContext} I can investigate the error and propose a fix if you want.`,
              category: 'build-fix',
              confidence: 0.85,
            },
          } as any)
        }
        
        break
      }

      case 'RUNTIME_CRASHED': {
        const crashCount = state.runtime.status === 'crashed' ? 1 : 0
        
        observations.push({
          id: `obs-${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          message: `[observing] Runtime crashed. ${event.payload.error ? `Error: ${event.payload.error.substring(0, 100)}` : 'Unknown error'}.`,
          category: 'error',
          confidence: 0.9,
        })
        break
      }

      case 'FILE_SAVED': {
        const path = event.payload.path
        const now = Date.now()
        
        // Track file save frequency
        if (!this.fileSaveHistory.has(path)) {
          this.fileSaveHistory.set(path, [])
        }
        
        const saves = this.fileSaveHistory.get(path)!
        saves.push(now)
        
        // Keep last 20 saves per file
        if (saves.length > 20) {
          saves.shift()
        }

        // Detect unstable files (frequent saves)
        const recentSaves = saves.filter((s) => now - s < 10000) // Last 10 seconds
        if (recentSaves.length >= 2) {
          observations.push({
            id: `obs-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            message: `[observing] ${path} was saved multiple times in a short period.`,
            category: 'stability',
            confidence: 0.75,
          })
        }
        break
      }

      case 'INTENT_CHANGED': {
        const { intent, score } = event.payload
        
        // Detect significant intent shifts
        if (this.intentHistory.length >= 2) {
          const prevIntent = this.intentHistory[this.intentHistory.length - 2]
          if (prevIntent.intent !== intent) {
            observations.push({
              id: `obs-${Date.now()}-${Math.random()}`,
              timestamp: Date.now(),
              message: `[observing] User intent shifted from ${prevIntent.intent} to ${intent} (${(score * 100).toFixed(0)}% confidence).`,
              category: 'intent',
              confidence: score,
            })
          }
        }
        break
      }
    }

    // Add observations
    observations.forEach((obs) => {
      this.observations.push(obs)
      
      // Keep last 100 observations
      if (this.observations.length > 100) {
        this.observations.shift()
      }

      // Emit observation event
      this.daemon.getEventBus().emit({
        type: 'AGENT_OBSERVATION',
        payload: obs,
      } as any)
    })
  }

  /**
   * Get recent observations
   */
  getObservations(limit: number = 10): AgentObservation[] {
    return this.observations.slice(-limit)
  }

  /**
   * Get all observations
   */
  getAllObservations(): AgentObservation[] {
    return [...this.observations]
  }

  /**
   * Clear observations
   */
  clearObservations() {
    this.observations = []
  }

  /**
   * Cleanup
   */
  destroy() {
    this.unsubscribeCallbacks.forEach((unsub) => unsub())
    this.observations = []
    this.errorHistory = []
    this.fileSaveHistory.clear()
    this.intentHistory = []
    this.consecutiveBuildFailures = 0
    this.lastBuildFailureTime = 0
    this.suggestionEmitted = false
  }
}

// Singleton per project
const observerInstances = new Map<string, AgentObserver>()

export function getAgentObserver(projectId: string): AgentObserver {
  const daemon = getWorkspaceDaemon(projectId)
  
  if (!observerInstances.has(projectId)) {
    observerInstances.set(projectId, new AgentObserver(daemon))
  }
  return observerInstances.get(projectId)!
}

export function destroyAgentObserver(projectId: string) {
  const observer = observerInstances.get(projectId)
  if (observer) {
    observer.destroy()
    observerInstances.delete(projectId)
  }
}

