/**
 * PHASE F′-5: Goal Resolver
 * 
 * Determines which goal is currently active and evaluates goal completion.
 * Never mutates files or executes plans.
 */

import { getGoalMemoryStore, type ProjectGoal } from './GoalMemoryStore'
import { promises as fs } from 'fs'
import { join } from 'path'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

/**
 * Goal completion evaluation result
 */
export type GoalCompletionStatus = 'complete' | 'incomplete' | 'unknown'

/**
 * Goal Resolver
 * 
 * Resolves active goals and evaluates completion based on project state.
 */
export class GoalResolver {
  /**
   * Get the currently active goal for a project
   * 
   * Returns the highest priority goal with status "active".
   * PHASE F′-8: Creates goal tree if it doesn't exist.
   */
  static async getActiveGoal(projectId: string): Promise<ProjectGoal | null> {
    const store = getGoalMemoryStore()
    const goals = await store.getGoals(projectId)

    // Find active goals, sorted by priority
    const activeGoals = goals
      .filter(g => g.status === 'active')
      .sort((a, b) => a.priority - b.priority)

    const activeGoal = activeGoals.length > 0 ? activeGoals[0] : null

    // PHASE F′-8: Create goal tree if goal is active and tree doesn't exist
    if (activeGoal) {
      try {
        const { getGoalTreeStore } = await import('./GoalTreeStore')
        const { GoalDecompositionEngine } = await import('./GoalDecompositionEngine')
        const treeStore = getGoalTreeStore()
        
        const existingTree = await treeStore.getTree(projectId, activeGoal.id)
        if (!existingTree) {
          // Decompose goal into tree
          const tree = await GoalDecompositionEngine.decomposeGoal(projectId, activeGoal.id)
          if (tree) {
            await treeStore.saveTree(projectId, tree)
            console.log(`[GoalResolver] Created goal tree for goal: ${activeGoal.description}`)
          }
        }
      } catch (error: any) {
        // Log but don't fail if tree creation fails
        console.warn('[GoalResolver] Failed to create goal tree:', error)
      }
    }

    return activeGoal
  }

  /**
   * Get all active goals (ordered by priority)
   */
  static async getActiveGoals(projectId: string): Promise<ProjectGoal[]> {
    const store = getGoalMemoryStore()
    const goals = await store.getGoals(projectId)

    return goals
      .filter(g => g.status === 'active')
      .sort((a, b) => a.priority - b.priority)
  }

  /**
   * Get completed goals
   */
  static async getCompletedGoals(projectId: string): Promise<ProjectGoal[]> {
    const store = getGoalMemoryStore()
    const goals = await store.getGoals(projectId)

    return goals
      .filter(g => g.status === 'completed')
      .sort((a, b) => b.updatedAt - a.updatedAt) // Most recently completed first
  }

  /**
   * Evaluate whether a goal is complete based on project state
   * 
   * This is a heuristic evaluation - it checks if the goal description
   * appears to be satisfied by examining project files and structure.
   */
  static async evaluateGoalCompletion(
    projectId: string,
    goal: ProjectGoal
  ): Promise<GoalCompletionStatus> {
    if (goal.status === 'completed') {
      return 'complete'
    }

    if (goal.status === 'abandoned') {
      return 'unknown' // Don't evaluate abandoned goals
    }

    try {
      const rootPath = await WorkspaceRegistry.getRootPath(projectId)
      if (!rootPath) {
        return 'unknown'
      }

      // Simple heuristic: Check if goal description keywords appear in project files
      // This is a basic implementation - can be enhanced with more sophisticated analysis
      const goalKeywords = this.extractKeywords(goal.description)
      const projectFiles = await this.getProjectFiles(rootPath)

      // Check if goal-related code exists
      const matches = this.checkGoalCompletion(goalKeywords, projectFiles, goal.description)

      return matches ? 'complete' : 'incomplete'
    } catch (error: any) {
      console.warn(`[GoalResolver] Failed to evaluate goal completion:`, error)
      return 'unknown'
    }
  }

  /**
   * Extract keywords from goal description
   */
  private static extractKeywords(description: string): string[] {
    const lower = description.toLowerCase()
    // Extract meaningful words (skip common words)
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'may', 'might', 'must', 'can'])
    
    const words = lower
      .split(/\s+/)
      .map(w => w.replace(/[^\w]/g, ''))
      .filter(w => w.length > 3 && !commonWords.has(w))
    
    return [...new Set(words)] // Remove duplicates
  }

  /**
   * Get project files (excluding node_modules, .git, etc.)
   */
  private static async getProjectFiles(rootPath: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      await this.scanDirectory(rootPath, files, rootPath)
    } catch (error: any) {
      console.warn(`[GoalResolver] Failed to scan project files:`, error)
    }

    return files
  }

  /**
   * Recursively scan directory
   */
  private static async scanDirectory(
    dirPath: string,
    files: string[],
    rootPath: string,
    depth: number = 0
  ): Promise<void> {
    if (depth > 10) return // Limit depth to avoid infinite recursion

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        // Skip hidden files, node_modules, .git, etc.
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build') {
          continue
        }

        const fullPath = join(dirPath, entry.name)
        
        if (entry.isFile()) {
          // Only check code files
          if (this.isCodeFile(entry.name)) {
            files.push(fullPath.replace(rootPath, '').replace(/^[\\/]/, ''))
          }
        } else if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files, rootPath, depth + 1)
        }
      }
    } catch (error: any) {
      // Ignore permission errors
      if (error.code !== 'EACCES' && error.code !== 'EPERM') {
        throw error
      }
    }
  }

  /**
   * Check if file is a code file
   */
  private static isCodeFile(filename: string): boolean {
    const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.html', '.css', '.json']
    return codeExtensions.some(ext => filename.endsWith(ext))
  }

  /**
   * Check if goal appears to be complete based on files and description
   */
  private static checkGoalCompletion(
    keywords: string[],
    files: string[],
    description: string
  ): boolean {
    // Simple heuristic: if goal mentions specific features/components,
    // check if related files exist
    const lowerDesc = description.toLowerCase()

    // Check for specific patterns
    if (lowerDesc.includes('calculator')) {
      // Look for calculator-related files
      const hasCalculatorFiles = files.some(f => 
        f.toLowerCase().includes('calculator') || 
        f.toLowerCase().includes('calc')
      )
      if (hasCalculatorFiles) return true
    }

    if (lowerDesc.includes('api') || lowerDesc.includes('backend')) {
      const hasApiFiles = files.some(f => 
        f.toLowerCase().includes('api') || 
        f.toLowerCase().includes('route') ||
        f.toLowerCase().includes('server')
      )
      if (hasApiFiles) return true
    }

    // Generic check: if keywords appear in file names
    const keywordMatches = keywords.filter(keyword => 
      files.some(f => f.toLowerCase().includes(keyword))
    )

    // If more than 50% of keywords match, consider it complete
    return keywordMatches.length > keywords.length * 0.5
  }

  /**
   * Auto-mark completed goals
   * 
   * Evaluates all active goals and marks completed ones.
   */
  static async autoMarkCompletedGoals(projectId: string): Promise<ProjectGoal[]> {
    const store = getGoalMemoryStore()
    const activeGoals = await this.getActiveGoals(projectId)
    const completed: ProjectGoal[] = []

    for (const goal of activeGoals) {
      const status = await this.evaluateGoalCompletion(projectId, goal)
      if (status === 'complete') {
        await store.updateGoal(projectId, goal.id, { status: 'completed' })
        completed.push({ ...goal, status: 'completed' })
      }
    }

    return completed
  }
}
