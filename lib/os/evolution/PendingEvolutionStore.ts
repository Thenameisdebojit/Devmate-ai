/**
 * PHASE F′-4: Pending Evolution Store
 * 
 * Authoritative server-side store for pending evolution plans.
 * Only one evolution can be pending or executing at a time.
 */

import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'
import type { ProjectStage } from '../ProjectEvolutionEngine'

/**
 * Pending Evolution
 * 
 * Represents an architect-generated plan awaiting user confirmation.
 */
export type PendingEvolution = {
  id: string
  projectId: string
  plan: string
  intents: ExecutionIntent[]
  stageSnapshot: ProjectStage
  status: 'awaiting_confirmation' | 'executing' | 'completed' | 'aborted'
  createdAt: number
  confirmedAt?: number
  executedAt?: number
  completedAt?: number
  error?: string
}

/**
 * Pending Evolution Store
 * 
 * Singleton store for pending evolutions.
 * Rules:
 * - Only one evolution per project at a time
 * - Survives server restarts (in-memory for now, can be persisted later)
 */
class PendingEvolutionStoreImpl {
  private evolutions: Map<string, PendingEvolution> = new Map()
  private projectToEvolutionId: Map<string, string> = new Map() // projectId -> evolutionId

  /**
   * Create a new pending evolution
   * 
   * Throws if project already has a pending/executing evolution.
   */
  create(evolution: Omit<PendingEvolution, 'id' | 'createdAt' | 'status'>): PendingEvolution {
    const { projectId } = evolution

    // Check if project already has a pending/executing evolution
    const existingId = this.projectToEvolutionId.get(projectId)
    if (existingId) {
      const existing = this.evolutions.get(existingId)
      if (existing && (existing.status === 'awaiting_confirmation' || existing.status === 'executing')) {
        throw new Error(
          `Project ${projectId} already has a ${existing.status} evolution. ` +
          `Complete or abort it before creating a new one.`
        )
      }
    }

    // Create new evolution
    const id = `evolution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const pendingEvolution: PendingEvolution = {
      ...evolution,
      id,
      createdAt: Date.now(),
      status: 'awaiting_confirmation',
    }

    this.evolutions.set(id, pendingEvolution)
    this.projectToEvolutionId.set(projectId, id)

    return pendingEvolution
  }

  /**
   * Get pending evolution for a project
   */
  getByProjectId(projectId: string): PendingEvolution | null {
    const evolutionId = this.projectToEvolutionId.get(projectId)
    if (!evolutionId) {
      return null
    }

    return this.evolutions.get(evolutionId) || null
  }

  /**
   * Get evolution by ID
   */
  getById(id: string): PendingEvolution | null {
    return this.evolutions.get(id) || null
  }

  /**
   * Confirm evolution (mark as ready for execution)
   */
  confirm(id: string): PendingEvolution {
    const evolution = this.evolutions.get(id)
    if (!evolution) {
      throw new Error(`Evolution ${id} not found`)
    }

    if (evolution.status !== 'awaiting_confirmation') {
      throw new Error(`Evolution ${id} is not awaiting confirmation (status: ${evolution.status})`)
    }

    const updated: PendingEvolution = {
      ...evolution,
      status: 'executing',
      confirmedAt: Date.now(),
    }

    this.evolutions.set(id, updated)
    return updated
  }

  /**
   * Mark evolution as executing
   */
  markExecuting(id: string): PendingEvolution {
    const evolution = this.evolutions.get(id)
    if (!evolution) {
      throw new Error(`Evolution ${id} not found`)
    }

    const updated: PendingEvolution = {
      ...evolution,
      status: 'executing',
      executedAt: Date.now(),
    }

    this.evolutions.set(id, updated)
    return updated
  }

  /**
   * Mark evolution as completed
   */
  markCompleted(id: string): PendingEvolution {
    const evolution = this.evolutions.get(id)
    if (!evolution) {
      throw new Error(`Evolution ${id} not found`)
    }

    const updated: PendingEvolution = {
      ...evolution,
      status: 'completed',
      completedAt: Date.now(),
    }

    this.evolutions.set(id, updated)
    
    // Clean up project mapping after a delay (allow querying for a bit)
    setTimeout(() => {
      this.projectToEvolutionId.delete(evolution.projectId)
    }, 60000) // 1 minute

    return updated
  }

  /**
   * Abort evolution
   */
  abort(id: string, reason?: string): PendingEvolution {
    const evolution = this.evolutions.get(id)
    if (!evolution) {
      throw new Error(`Evolution ${id} not found`)
    }

    const updated: PendingEvolution = {
      ...evolution,
      status: 'aborted',
      error: reason,
    }

    this.evolutions.set(id, updated)
    this.projectToEvolutionId.delete(evolution.projectId)

    return updated
  }

  /**
   * Check if project has pending/executing evolution
   */
  hasActiveEvolution(projectId: string): boolean {
    const evolution = this.getByProjectId(projectId)
    return evolution !== null && 
           (evolution.status === 'awaiting_confirmation' || evolution.status === 'executing')
  }

  /**
   * PHASE F′-8: Get all evolutions for a project
   */
  getAllForProject(projectId: string): PendingEvolution[] {
    const allEvolutions: PendingEvolution[] = []
    for (const evolution of this.evolutions.values()) {
      if (evolution.projectId === projectId) {
        allEvolutions.push(evolution)
      }
    }
    return allEvolutions
  }
}

// Singleton instance
let storeInstance: PendingEvolutionStoreImpl | null = null

export function getPendingEvolutionStore(): PendingEvolutionStoreImpl {
  if (!storeInstance) {
    storeInstance = new PendingEvolutionStoreImpl()
  }
  return storeInstance
}
