/**
 * PHASE F′-6: Planning Store
 * 
 * Stores planning cycles per project.
 * Replaces old plans on regeneration.
 */

import type { PlanningCycle } from './PlanningEngine'

/**
 * Planning Store
 * 
 * Stores the last PlanningCycle per project.
 * No persistence beyond project scope required (in-memory for now).
 */
class PlanningStoreImpl {
  private cycles: Map<string, PlanningCycle> = new Map() // projectId -> PlanningCycle

  /**
   * Store a planning cycle (replaces existing)
   */
  store(cycle: PlanningCycle): void {
    this.cycles.set(cycle.projectId, cycle)
  }

  /**
   * Get the latest planning cycle for a project
   */
  get(projectId: string): PlanningCycle | null {
    return this.cycles.get(projectId) || null
  }

  /**
   * Clear planning cycle for a project
   */
  clear(projectId: string): void {
    this.cycles.delete(projectId)
  }

  /**
   * Check if a planning cycle exists for a project
   */
  has(projectId: string): boolean {
    return this.cycles.has(projectId)
  }
}

// Singleton instance
let storeInstance: PlanningStoreImpl | null = null

export function getPlanningStore(): PlanningStoreImpl {
  if (!storeInstance) {
    storeInstance = new PlanningStoreImpl()
  }
  return storeInstance
}
