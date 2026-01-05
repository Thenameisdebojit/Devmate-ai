/**
 * Agent Confidence Engine
 * 
 * Computes confidence and risk from real runtime signals.
 * Deterministic, explainable, non-blocking.
 * 
 * RULES:
 * - No ML, no randomness
 * - Same inputs → same output
 * - Confidence derived from signals, not guesses
 * - Risk is observed, not predicted
 */

import { WorkspaceDaemon, WorkspaceEvent, getWorkspaceDaemon } from './WorkspaceDaemon'
import { EventEmitter } from 'events'

export interface ConfidenceReport {
  confidenceScore: number // 0.0 – 1.0
  confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  reasons: string[] // Human-readable, deterministic
  signalSnapshot: {
    buildSuccessRate: number // 0.0 – 1.0
    crashCount: number
    fileChurnScore: number // 0.0 – 1.0
    recoveryTimeMs: number | null
    totalBuilds: number
    successfulBuilds: number
    recentCrashes: number // Last 5 minutes
  }
  timestamp: number
}

interface SignalHistory {
  builds: Array<{ timestamp: number; success: boolean }>
  crashes: Array<{ timestamp: number; error: string }>
  fileSaves: Array<{ timestamp: number; path: string }>
  plans: Array<{ timestamp: number; success: boolean }>
  recoveries: Array<{ timestamp: number; crashTime: number; recoveryTime: number }>
}

/**
 * Agent Confidence Engine
 * Computes confidence and risk from real signals
 */
export class AgentConfidenceEngine extends EventEmitter {
  private daemon: WorkspaceDaemon
  private projectId: string
  private history: SignalHistory
  private unsubscribeCallbacks: Array<() => void> = []
  private lastConfidenceReport: ConfidenceReport | null = null

  // Configuration
  private readonly MAX_HISTORY_AGE = 30 * 60 * 1000 // 30 minutes
  private readonly CRASH_WINDOW = 5 * 60 * 1000 // 5 minutes
  private readonly FILE_CHURN_THRESHOLD = 10 // saves per file per minute
  private readonly RECOVERY_TIMEOUT = 2 * 60 * 1000 // 2 minutes

  constructor(daemon: WorkspaceDaemon, projectId: string) {
    super()
    this.daemon = daemon
    this.projectId = projectId
    this.history = {
      builds: [],
      crashes: [],
      fileSaves: [],
      plans: [],
      recoveries: [],
    }
    this.setupSubscriptions()
    this.computeAndEmitConfidence()
  }

  /**
   * Setup event subscriptions
   */
  private setupSubscriptions() {
    const eventBus = this.daemon.getEventBus()

    const unsubscribe1 = eventBus.on('BUILD_SUCCEEDED', () => {
      this.recordBuild(true)
      this.computeAndEmitConfidence()
    })

    const unsubscribe2 = eventBus.on('BUILD_FAILED', (payload: any) => {
      this.recordBuild(false)
      this.computeAndEmitConfidence()
    })

    const unsubscribe3 = eventBus.on('RUNTIME_STARTED', () => {
      // Check if this is a recovery from crash
      this.checkRecovery()
      this.computeAndEmitConfidence()
    })

    const unsubscribe4 = eventBus.on('RUNTIME_CRASHED', (payload: any) => {
      this.recordCrash(payload.error || 'Unknown error')
      this.computeAndEmitConfidence()
    })

    const unsubscribe5 = eventBus.on('FILE_SAVED', (payload: any) => {
      this.recordFileSave(payload.path)
      this.computeAndEmitConfidence()
    })

    const unsubscribe6 = eventBus.on('AGENT_PLAN_STEP_COMPLETED', () => {
      this.recordPlanSuccess()
      this.computeAndEmitConfidence()
    })

    this.unsubscribeCallbacks = [
      unsubscribe1,
      unsubscribe2,
      unsubscribe3,
      unsubscribe4,
      unsubscribe5,
      unsubscribe6,
    ]
  }

  /**
   * Record build result
   */
  private recordBuild(success: boolean): void {
    this.history.builds.push({
      timestamp: Date.now(),
      success,
    })
    this.cleanupOldHistory()
  }

  /**
   * Record crash
   */
  private recordCrash(error: string): void {
    this.history.crashes.push({
      timestamp: Date.now(),
      error,
    })
    this.cleanupOldHistory()
  }

  /**
   * Record file save
   */
  private recordFileSave(path: string): void {
    this.history.fileSaves.push({
      timestamp: Date.now(),
      path,
    })
    this.cleanupOldHistory()
  }

  /**
   * Record plan success
   */
  private recordPlanSuccess(): void {
    this.history.plans.push({
      timestamp: Date.now(),
      success: true,
    })
    this.cleanupOldHistory()
  }

  /**
   * Check if runtime start is a recovery from crash
   */
  private checkRecovery(): void {
    if (this.history.crashes.length === 0) return

    const lastCrash = this.history.crashes[this.history.crashes.length - 1]
    const now = Date.now()
    const timeSinceCrash = now - lastCrash.timestamp

    if (timeSinceCrash < this.RECOVERY_TIMEOUT) {
      // Recovery within timeout
      this.history.recoveries.push({
        timestamp: now,
        crashTime: lastCrash.timestamp,
        recoveryTime: timeSinceCrash,
      })
    }
  }

  /**
   * Cleanup old history
   */
  private cleanupOldHistory(): void {
    const now = Date.now()
    const cutoff = now - this.MAX_HISTORY_AGE

    this.history.builds = this.history.builds.filter((b) => b.timestamp > cutoff)
    this.history.crashes = this.history.crashes.filter((c) => c.timestamp > cutoff)
    this.history.fileSaves = this.history.fileSaves.filter((f) => f.timestamp > cutoff)
    this.history.plans = this.history.plans.filter((p) => p.timestamp > cutoff)
    this.history.recoveries = this.history.recoveries.filter((r) => r.timestamp > cutoff)
  }

  /**
   * Compute confidence score (deterministic)
   */
  computeConfidence(): ConfidenceReport {
    const now = Date.now()

    // Build success rate
    const recentBuilds = this.history.builds.filter(
      (b) => now - b.timestamp < this.MAX_HISTORY_AGE
    )
    const successfulBuilds = recentBuilds.filter((b) => b.success).length
    const buildSuccessRate = recentBuilds.length > 0 
      ? successfulBuilds / recentBuilds.length 
      : 0.5 // Neutral if no builds

    // Crash count
    const crashCount = this.history.crashes.length

    // Recent crashes (last 5 minutes)
    const recentCrashes = this.history.crashes.filter(
      (c) => now - c.timestamp < this.CRASH_WINDOW
    ).length

    // File churn score (0 = low churn, 1 = high churn)
    const fileChurnScore = this.computeFileChurnScore()

    // Recovery time (average, or null if no recoveries)
    const recoveryTimeMs = this.computeAverageRecoveryTime()

    // Compute confidence score (0.0 – 1.0)
    let confidenceScore: number
    // First run: lower confidence (no history)
    if (recentBuilds.length === 0) {
      confidenceScore = 0.4 // First run - low confidence
    } else {
      confidenceScore = 0.8 // Start with base confidence

      // Adjust based on build success rate
      confidenceScore += (buildSuccessRate - 0.5) * 0.3 // ±0.15

      // Adjust based on crashes
      confidenceScore -= recentCrashes * 0.2 // -0.2 per recent crash
      confidenceScore -= (crashCount / 10) * 0.1 // -0.1 per 10 total crashes

      // Adjust based on file churn (high churn = lower confidence)
      confidenceScore -= fileChurnScore * 0.15 // -0.15 for high churn

      // Adjust based on recovery (fast recovery = higher confidence)
      if (recoveryTimeMs !== null && recoveryTimeMs < 60000) {
        confidenceScore += 0.1 // Fast recovery bonus
      }

      // Clamp between 0 and 1
      confidenceScore = Math.max(0, Math.min(1, confidenceScore))
    }

    // Map to confidence level
    let confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH'
    if (confidenceScore >= 0.75) {
      confidenceLevel = 'HIGH'
    } else if (confidenceScore >= 0.4) {
      confidenceLevel = 'MEDIUM'
    } else {
      confidenceLevel = 'LOW'
    }

    // Compute risk level
    const riskLevel = this.computeRiskLevel(recentBuilds, recentCrashes, fileChurnScore, recoveryTimeMs)

    // Generate reasons
    const reasons = this.generateReasons(
      buildSuccessRate,
      recentCrashes,
      fileChurnScore,
      recoveryTimeMs,
      recentBuilds.length
    )

    const report: ConfidenceReport = {
      confidenceScore,
      confidenceLevel,
      riskLevel,
      reasons,
      signalSnapshot: {
        buildSuccessRate,
        crashCount,
        fileChurnScore,
        recoveryTimeMs,
        totalBuilds: recentBuilds.length,
        successfulBuilds,
        recentCrashes,
      },
      timestamp: now,
    }

    this.lastConfidenceReport = report
    return report
  }

  /**
   * Compute file churn score (0 = low, 1 = high)
   */
  private computeFileChurnScore(): number {
    if (this.history.fileSaves.length === 0) return 0

    const now = Date.now()
    const window = 5 * 60 * 1000 // 5 minutes

    // Count saves per file in recent window
    const fileSaveCounts = new Map<string, number>()
    const recentSaves = this.history.fileSaves.filter((f) => now - f.timestamp < window)

    for (const save of recentSaves) {
      fileSaveCounts.set(save.path, (fileSaveCounts.get(save.path) || 0) + 1)
    }

    // Find max saves per file
    let maxSavesPerFile = 0
    for (const count of fileSaveCounts.values()) {
      maxSavesPerFile = Math.max(maxSavesPerFile, count)
    }

    // Normalize to 0-1 (threshold = 10 saves per file per 5 minutes)
    return Math.min(1, maxSavesPerFile / this.FILE_CHURN_THRESHOLD)
  }

  /**
   * Compute average recovery time
   */
  private computeAverageRecoveryTime(): number | null {
    if (this.history.recoveries.length === 0) return null

    const total = this.history.recoveries.reduce((sum, r) => sum + r.recoveryTime, 0)
    return total / this.history.recoveries.length
  }

  /**
   * Compute risk level
   */
  private computeRiskLevel(
    recentBuilds: Array<{ timestamp: number; success: boolean }>,
    recentCrashes: number,
    fileChurnScore: number,
    recoveryTimeMs: number | null
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    // HIGH RISK triggers
    if (recentCrashes >= 2) return 'HIGH'
    
    const last3Builds = recentBuilds.slice(-3)
    const failures = last3Builds.filter((b) => !b.success).length
    if (failures >= 2) return 'HIGH'

    if (fileChurnScore > 0.8) return 'HIGH' // Very high churn

    if (recoveryTimeMs === null && this.history.crashes.length > 0) {
      // Crash without recovery
      const lastCrash = this.history.crashes[this.history.crashes.length - 1]
      const timeSinceCrash = Date.now() - lastCrash.timestamp
      if (timeSinceCrash > this.RECOVERY_TIMEOUT) return 'HIGH'
    }

    // MEDIUM RISK triggers
    if (recentBuilds.length === 0) return 'MEDIUM' // First run

    const successRate = recentBuilds.filter((b) => b.success).length / recentBuilds.length
    if (successRate < 0.7 && successRate > 0.3) return 'MEDIUM' // Mixed success

    if (recentCrashes === 1) return 'MEDIUM'

    if (fileChurnScore > 0.5) return 'MEDIUM'

    // LOW RISK
    return 'LOW'
  }

  /**
   * Generate human-readable reasons
   */
  private generateReasons(
    buildSuccessRate: number,
    recentCrashes: number,
    fileChurnScore: number,
    recoveryTimeMs: number | null,
    totalBuilds: number
  ): string[] {
    const reasons: string[] = []

    if (totalBuilds === 0) {
      reasons.push('No build history yet — first run')
      return reasons
    }

    if (buildSuccessRate >= 0.9) {
      reasons.push(`Build success rate: ${(buildSuccessRate * 100).toFixed(0)}%`)
    } else if (buildSuccessRate >= 0.7) {
      reasons.push(`Build success rate: ${(buildSuccessRate * 100).toFixed(0)}% — mostly stable`)
    } else if (buildSuccessRate >= 0.5) {
      reasons.push(`Build success rate: ${(buildSuccessRate * 100).toFixed(0)}% — mixed results`)
    } else {
      reasons.push(`Build success rate: ${(buildSuccessRate * 100).toFixed(0)}% — frequent failures`)
    }

    if (recentCrashes > 0) {
      reasons.push(`${recentCrashes} crash${recentCrashes > 1 ? 'es' : ''} in last 5 minutes`)
    }

    if (fileChurnScore > 0.7) {
      reasons.push('High file churn detected — frequent saves')
    } else if (fileChurnScore > 0.4) {
      reasons.push('Moderate file churn')
    }

    if (recoveryTimeMs !== null) {
      if (recoveryTimeMs < 60000) {
        reasons.push(`Fast recovery: ${(recoveryTimeMs / 1000).toFixed(0)}s`)
      } else {
        reasons.push(`Recovery time: ${(recoveryTimeMs / 1000).toFixed(0)}s`)
      }
    } else if (this.history.crashes.length > 0) {
      reasons.push('No recovery detected after crash')
    }

    if (reasons.length === 0) {
      reasons.push('Stable runtime with consistent builds')
    }

    return reasons
  }

  /**
   * Compute and emit confidence update
   */
  private computeAndEmitConfidence(): void {
    const report = this.computeConfidence()

    // Emit event
    this.daemon.getEventBus().emit({
      type: 'AGENT_CONFIDENCE_UPDATED',
      payload: report,
    } as any)

    // Emit on this instance too
    this.emit('confidenceUpdated', report)
  }

  /**
   * Get last confidence report
   */
  getLastReport(): ConfidenceReport | null {
    return this.lastConfidenceReport
  }

  /**
   * Get current confidence report (computes if needed)
   */
  getCurrentReport(): ConfidenceReport {
    return this.computeConfidence()
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.unsubscribeCallbacks.forEach((unsub) => unsub())
    this.removeAllListeners()
  }
}

// Singleton per project
const engineInstances = new Map<string, AgentConfidenceEngine>()

export function getAgentConfidenceEngine(projectId: string): AgentConfidenceEngine {
  const daemon = getWorkspaceDaemon(projectId)
  
  if (!engineInstances.has(projectId)) {
    engineInstances.set(projectId, new AgentConfidenceEngine(daemon, projectId))
  }
  return engineInstances.get(projectId)!
}

export function destroyAgentConfidenceEngine(projectId: string): void {
  const engine = engineInstances.get(projectId)
  if (engine) {
    engine.destroy()
    engineInstances.delete(projectId)
  }
}

