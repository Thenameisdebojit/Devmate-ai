/**
 * PHASE F′-5: Goal Memory Store
 * 
 * Persistent storage for project-level goals.
 * Goals are human-readable, persistent, and mutable only through explicit actions.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'

/**
 * Project Goal
 * 
 * Represents a project-level goal that guides AI behavior over time.
 */
export type ProjectGoal = {
  id: string
  description: string
  priority: number // Lower number = higher priority
  status: 'active' | 'completed' | 'abandoned'
  createdAt: number
  updatedAt: number
}

/**
 * Goals file structure
 */
interface GoalsFile {
  projectId: string
  goals: ProjectGoal[]
  version: number
}

/**
 * Goal Memory Store
 * 
 * Stores goals per project with disk persistence.
 * Rules:
 * - Unique IDs per goal
 * - Stable ordering by priority
 * - No AI calls
 * - No business logic
 */
class GoalMemoryStoreImpl {
  private goalsCache: Map<string, ProjectGoal[]> = new Map()
  private readonly GOALS_FILE = '.devmate/goals.json'

  /**
   * Get goals file path for a project
   */
  private async getGoalsFilePath(projectId: string): Promise<string> {
    const rootManager = getProjectRootManager()
    const rootPath = await rootManager.getProjectRoot(projectId)
    return join(rootPath, this.GOALS_FILE)
  }

  /**
   * Load goals from disk
   */
  private async loadGoals(projectId: string): Promise<ProjectGoal[]> {
    // Check cache first
    if (this.goalsCache.has(projectId)) {
      return this.goalsCache.get(projectId)!
    }

    try {
      const filePath = await this.getGoalsFilePath(projectId)
      const content = await fs.readFile(filePath, 'utf-8')
      const data: GoalsFile = JSON.parse(content)

      if (data.projectId !== projectId) {
        console.warn(`[GoalMemoryStore] Goals file projectId mismatch: expected ${projectId}, got ${data.projectId}`)
        return []
      }

      // Sort by priority (lower number = higher priority)
      const goals = data.goals.sort((a, b) => a.priority - b.priority)
      this.goalsCache.set(projectId, goals)
      return goals
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - return empty array
        this.goalsCache.set(projectId, [])
        return []
      }
      console.error(`[GoalMemoryStore] Failed to load goals for ${projectId}:`, error)
      return []
    }
  }

  /**
   * Save goals to disk
   */
  private async saveGoals(projectId: string, goals: ProjectGoal[]): Promise<void> {
    try {
      const filePath = await this.getGoalsFilePath(projectId)
      const dir = join(filePath, '..')
      
      // Ensure .devmate directory exists
      await fs.mkdir(dir, { recursive: true })

      // Sort by priority before saving
      const sortedGoals = [...goals].sort((a, b) => a.priority - b.priority)

      const data: GoalsFile = {
        projectId,
        goals: sortedGoals,
        version: 1,
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      this.goalsCache.set(projectId, sortedGoals)
    } catch (error: any) {
      console.error(`[GoalMemoryStore] Failed to save goals for ${projectId}:`, error)
      throw new Error(`Failed to save goals: ${error.message}`)
    }
  }

  /**
   * Get all goals for a project
   */
  async getGoals(projectId: string): Promise<ProjectGoal[]> {
    return this.loadGoals(projectId)
  }

  /**
   * Add a new goal
   */
  async addGoal(projectId: string, goal: Omit<ProjectGoal, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProjectGoal> {
    const goals = await this.loadGoals(projectId)

    // Generate unique ID
    const id = `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const newGoal: ProjectGoal = {
      ...goal,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }

    goals.push(newGoal)
    await this.saveGoals(projectId, goals)

    return newGoal
  }

  /**
   * Update an existing goal
   */
  async updateGoal(
    projectId: string,
    goalId: string,
    patch: Partial<Omit<ProjectGoal, 'id' | 'createdAt' | 'projectId'>>
  ): Promise<ProjectGoal> {
    const goals = await this.loadGoals(projectId)
    const index = goals.findIndex(g => g.id === goalId)

    if (index === -1) {
      throw new Error(`Goal ${goalId} not found`)
    }

    const updated: ProjectGoal = {
      ...goals[index],
      ...patch,
      updatedAt: Date.now(),
    }

    goals[index] = updated
    await this.saveGoals(projectId, goals)

    return updated
  }

  /**
   * Remove a goal
   */
  async removeGoal(projectId: string, goalId: string): Promise<void> {
    const goals = await this.loadGoals(projectId)
    const filtered = goals.filter(g => g.id !== goalId)

    if (filtered.length === goals.length) {
      throw new Error(`Goal ${goalId} not found`)
    }

    await this.saveGoals(projectId, filtered)
  }

  /**
   * Clear cache for a project (useful for testing or reloads)
   */
  clearCache(projectId: string): void {
    this.goalsCache.delete(projectId)
  }
}

// Singleton instance
let storeInstance: GoalMemoryStoreImpl | null = null

export function getGoalMemoryStore(): GoalMemoryStoreImpl {
  if (!storeInstance) {
    storeInstance = new GoalMemoryStoreImpl()
  }
  return storeInstance
}
