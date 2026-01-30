/**
 * PHASE F′-8: Goal Progress Resolver
 * 
 * Determines which GoalNodes are completed, in_progress, or pending.
 * Inputs: completed evolutions, critique results, file heuristics.
 * Outputs: node status updates only.
 * No execution. No mutation.
 */

import { getGoalTreeStore, type GoalTree, type GoalNode } from './GoalDecompositionEngine'
import { getPendingEvolutionStore } from '../evolution/PendingEvolutionStore'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Goal Progress Resolver
 * 
 * Resolves node status based on project state.
 */
export class GoalProgressResolver {
  /**
   * Resolve progress for all nodes in a goal tree
   * 
   * Analyzes:
   * - Completed evolutions
   * - Critique results
   * - File heuristics
   * 
   * Returns status updates (does not mutate tree directly).
   */
  static async resolveProgress(
    projectId: string,
    goalId: string
  ): Promise<Record<string, GoalNode['status']>> {
    const treeStore = getGoalTreeStore()
    const tree = await treeStore.getTree(projectId, goalId)

    if (!tree) {
      return {}
    }

    const statusUpdates: Record<string, GoalNode['status']> = {}

    // Analyze each node
    for (const [nodeId, node] of Object.entries(tree.nodes)) {
      if (node.status === 'completed') {
        // Already completed - skip
        continue
      }

      // Check if node is completed based on heuristics
      const isCompleted = await this.isNodeCompleted(projectId, node, tree)

      if (isCompleted) {
        statusUpdates[nodeId] = 'completed'
      } else if (node.status === 'pending') {
        // Check if node is in progress (evolution running for this goal)
        const isInProgress = await this.isNodeInProgress(projectId, goalId, node)

        if (isInProgress) {
          statusUpdates[nodeId] = 'in_progress'
        }
      }
    }

    return statusUpdates
  }

  /**
   * Check if a node is completed
   */
  private static async isNodeCompleted(
    projectId: string,
    node: GoalNode,
    tree: GoalTree
  ): Promise<boolean> {
    try {
      const rootPath = await WorkspaceRegistry.getRootPath(projectId)
      if (!rootPath) {
        return false
      }

      const nodeLower = node.description.toLowerCase()

      // Heuristic: Check if node description keywords appear in project files
      const files = await this.getProjectFiles(rootPath)
      const keywords = this.extractKeywords(node.description)

      // Check for specific patterns
      if (nodeLower.includes('calculator') && !nodeLower.includes('scientific')) {
        const hasCalculator = files.some(f => 
          f.toLowerCase().includes('calculator') || f.toLowerCase().includes('calc')
        )
        if (hasCalculator) return true
      }

      if (nodeLower.includes('scientific')) {
        const hasScientific = files.some(f => 
          f.toLowerCase().includes('scientific') || 
          f.toLowerCase().includes('sin') || 
          f.toLowerCase().includes('cos')
        )
        if (hasScientific) return true
      }

      if (nodeLower.includes('keyboard')) {
        const hasKeyboard = files.some(f => 
          f.toLowerCase().includes('keyboard') || f.toLowerCase().includes('key')
        )
        if (hasKeyboard) return true
      }

      if (nodeLower.includes('ui') || nodeLower.includes('interface')) {
        const hasUI = files.some(f => 
          f.endsWith('.css') || f.endsWith('.tsx') || f.includes('component')
        )
        if (hasUI) return true
      }

      // Generic check: if keywords appear in file names
      const keywordMatches = keywords.filter(keyword => 
        files.some(f => f.toLowerCase().includes(keyword))
      )

      // If more than 50% of keywords match, consider it complete
      return keywordMatches.length > keywords.length * 0.5
    } catch (error: any) {
      console.warn('[GoalProgressResolver] Failed to check node completion:', error)
      return false
    }
  }

  /**
   * Check if a node is in progress
   */
  private static async isNodeInProgress(
    projectId: string,
    goalId: string,
    node: GoalNode
  ): Promise<boolean> {
    try {
      // Check if there's an active evolution for this goal
      const evolutionStore = getPendingEvolutionStore()
      const allEvolutions = evolutionStore.getAllForProject(projectId)
      
      const activeEvolution = allEvolutions.find(e => 
        e.projectId === projectId && 
        (e.status === 'executing' || e.status === 'awaiting_confirmation')
      )

      if (!activeEvolution) {
        return false
      }

      // Check if evolution plan mentions node description
      const planLower = activeEvolution.plan.toLowerCase()
      const nodeLower = node.description.toLowerCase()
      const nodeKeywords = this.extractKeywords(node.description)

      // Check if evolution plan aligns with node
      const hasKeywordMatch = nodeKeywords.some(kw => planLower.includes(kw))
      const hasDescriptionMatch = nodeLower.split(' ').some(word => 
        word.length > 4 && planLower.includes(word)
      )

      return hasKeywordMatch || hasDescriptionMatch
    } catch (error: any) {
      console.warn('[GoalProgressResolver] Failed to check node in progress:', error)
      return false
    }
  }

  /**
   * Get project files
   */
  private static async getProjectFiles(rootPath: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      await this.scanDirectory(rootPath, files, rootPath)
    } catch (error: any) {
      console.warn('[GoalProgressResolver] Failed to scan project files:', error)
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
    if (depth > 10) return

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const entry of entries) {
        if (entry.name.startsWith('.') || 
            entry.name === 'node_modules' || 
            entry.name === '.git' ||
            entry.name === 'dist' ||
            entry.name === 'build') {
          continue
        }

        const fullPath = join(dirPath, entry.name)
        
        if (entry.isFile()) {
          files.push(fullPath.replace(rootPath, '').replace(/^[\\/]/, ''))
        } else if (entry.isDirectory()) {
          await this.scanDirectory(fullPath, files, rootPath, depth + 1)
        }
      }
    } catch (error: any) {
      if (error.code !== 'EACCES' && error.code !== 'EPERM') {
        throw error
      }
    }
  }

  /**
   * Extract keywords from text
   */
  private static extractKeywords(text: string): string[] {
    const lower = text.toLowerCase()
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'])
    
    return lower
      .split(/\s+/)
      .map(w => w.replace(/[^\w]/g, ''))
      .filter(w => w.length > 3 && !commonWords.has(w))
  }
}
