/**
 * PHASE F′-8: Goal Tree Store
 * 
 * Persists goal trees to disk.
 * No AI calls. Pure storage.
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { getProjectRootManager } from '@/lib/workspace/ProjectRootManager'
import type { GoalTree, GoalNode } from './GoalDecompositionEngine'

/**
 * Goal trees file structure
 */
interface GoalTreesFile {
  projectId: string
  trees: Record<string, GoalTree> // goalId -> GoalTree
  version: number
}

/**
 * Goal Tree Store
 * 
 * Persists GoalTrees to disk (JSON under .devmate/goal-trees.json).
 */
class GoalTreeStoreImpl {
  private treesCache: Map<string, Record<string, GoalTree>> = new Map() // projectId -> { goalId -> GoalTree }
  private readonly TREES_FILE = '.devmate/goal-trees.json'

  /**
   * Get goal trees file path for a project
   */
  private async getTreesFilePath(projectId: string): Promise<string> {
    const rootManager = getProjectRootManager()
    const rootPath = await rootManager.getProjectRoot(projectId)
    return join(rootPath, this.TREES_FILE)
  }

  /**
   * Load goal trees from disk
   */
  private async loadTrees(projectId: string): Promise<Record<string, GoalTree>> {
    // Check cache first
    if (this.treesCache.has(projectId)) {
      return this.treesCache.get(projectId)!
    }

    try {
      const filePath = await this.getTreesFilePath(projectId)
      const content = await fs.readFile(filePath, 'utf-8')
      const data: GoalTreesFile = JSON.parse(content)

      if (data.projectId !== projectId) {
        console.warn(`[GoalTreeStore] Trees file projectId mismatch: expected ${projectId}, got ${data.projectId}`)
        return {}
      }

      this.treesCache.set(projectId, data.trees || {})
      return data.trees || {}
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist - return empty object
        this.treesCache.set(projectId, {})
        return {}
      }
      console.error(`[GoalTreeStore] Failed to load trees for ${projectId}:`, error)
      return {}
    }
  }

  /**
   * Save goal trees to disk
   */
  private async saveTrees(projectId: string, trees: Record<string, GoalTree>): Promise<void> {
    try {
      const filePath = await this.getTreesFilePath(projectId)
      const dir = join(filePath, '..')
      
      // Ensure .devmate directory exists
      await fs.mkdir(dir, { recursive: true })

      const data: GoalTreesFile = {
        projectId,
        trees,
        version: 1,
      }

      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
      this.treesCache.set(projectId, trees)
    } catch (error: any) {
      console.error(`[GoalTreeStore] Failed to save trees for ${projectId}:`, error)
      throw new Error(`Failed to save goal trees: ${error.message}`)
    }
  }

  /**
   * Get goal tree for a goal
   */
  async getTree(projectId: string, goalId: string): Promise<GoalTree | null> {
    const trees = await this.loadTrees(projectId)
    return trees[goalId] || null
  }

  /**
   * Save goal tree
   */
  async saveTree(projectId: string, tree: GoalTree): Promise<void> {
    const trees = await this.loadTrees(projectId)
    trees[tree.goalId] = {
      ...tree,
      updatedAt: Date.now(),
    }
    await this.saveTrees(projectId, trees)
  }

  /**
   * Update node status
   */
  async updateNodeStatus(
    projectId: string,
    goalId: string,
    nodeId: string,
    status: GoalNode['status']
  ): Promise<void> {
    const trees = await this.loadTrees(projectId)
    const tree = trees[goalId]

    if (!tree) {
      throw new Error(`Goal tree not found for goal ${goalId}`)
    }

    if (!tree.nodes[nodeId]) {
      throw new Error(`Node ${nodeId} not found in goal tree`)
    }

    tree.nodes[nodeId] = {
      ...tree.nodes[nodeId],
      status,
    }
    tree.updatedAt = Date.now()

    await this.saveTrees(projectId, trees)
  }

  /**
   * Get next executable nodes (pending nodes with satisfied dependencies)
   */
  async getNextExecutableNodes(projectId: string, goalId: string): Promise<GoalNode[]> {
    const tree = await this.getTree(projectId, goalId)
    if (!tree) {
      return []
    }

    const executable: GoalNode[] = []

    for (const node of Object.values(tree.nodes)) {
      if (node.status !== 'pending') {
        continue
      }

      // Check if dependencies are satisfied
      const dependenciesSatisfied = node.dependencies.every(depId => {
        const depNode = tree.nodes[depId]
        return depNode && depNode.status === 'completed'
      })

      if (dependenciesSatisfied) {
        executable.push(node)
      }
    }

    return executable
  }

  /**
   * Clear cache for a project
   */
  clearCache(projectId: string): void {
    this.treesCache.delete(projectId)
  }
}

// Singleton instance
let storeInstance: GoalTreeStoreImpl | null = null

export function getGoalTreeStore(): GoalTreeStoreImpl {
  if (!storeInstance) {
    storeInstance = new GoalTreeStoreImpl()
  }
  return storeInstance
}
