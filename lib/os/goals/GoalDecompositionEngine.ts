/**
 * PHASE F′-8: Goal Decomposition Engine
 * 
 * Transforms flat project goals into structured goal trees.
 * Pure reasoning - never executes, never mutates project state.
 */

import { getGoalMemoryStore, type ProjectGoal } from './GoalMemoryStore'
import { getProjectEvolutionEngineManager } from '../ProjectEvolutionEngineManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Goal Node
 * 
 * Atomic unit of a goal tree.
 */
export type GoalNode = {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  dependencies: string[] // Other GoalNode ids
  parentId?: string
  confidence: number // 0-1, how confident the system is in this decomposition
}

/**
 * Goal Tree
 * 
 * Structured representation of a goal with sub-goals.
 */
export type GoalTree = {
  goalId: string // Links to GoalMemoryStore goal
  rootNodeId: string
  nodes: Record<string, GoalNode>
  createdAt: number
  updatedAt: number
}

/**
 * Goal Decomposition Engine
 * 
 * Analyzes goals and produces structured goal trees.
 * Rules:
 * - Never executes
 * - Never mutates project state
 * - Only generates structure
 */
export class GoalDecompositionEngine {
  /**
   * Decompose a goal into a structured goal tree
   * 
   * Analyzes:
   * - Goal description
   * - Project descriptor (template, language, runtime)
   * - Project file structure
   * 
   * Produces:
   * - GoalTree with 3-7 sub-goals
   * - Explicit dependencies
   * - Confidence scores
   */
  static async decomposeGoal(
    projectId: string,
    goalId: string
  ): Promise<GoalTree | null> {
    try {
      // Get goal from GoalMemoryStore
      const goalStore = getGoalMemoryStore()
      const goals = await goalStore.getGoals(projectId)
      const goal = goals.find(g => g.id === goalId)

      if (!goal) {
        return null
      }

      // Get project descriptor
      const rootPath = await WorkspaceRegistry.getRootPath(projectId)
      if (!rootPath) {
        return null
      }

      const peeManager = getProjectEvolutionEngineManager()
      const pee = await peeManager.getEngine(projectId, rootPath)
      const descriptor = (pee as any).descriptor // Access descriptor from PEE

      // Analyze project structure
      const projectFiles = await this.getProjectFiles(rootPath)
      const projectType = this.inferProjectType(projectFiles, descriptor)

      // Generate sub-goals based on goal description
      const subGoals = this.generateSubGoals(goal.description, projectType, projectFiles)

      // Create root node
      const rootNodeId = `node-${goalId}-root`
      const rootNode: GoalNode = {
        id: rootNodeId,
        description: goal.description,
        status: goal.status === 'completed' ? 'completed' : 'pending',
        dependencies: [],
        confidence: 1.0,
      }

      // Create child nodes
      const nodes: Record<string, GoalNode> = {
        [rootNodeId]: rootNode,
      }

      subGoals.forEach((subGoal, index) => {
        const nodeId = `node-${goalId}-${index + 1}`
        const node: GoalNode = {
          id: nodeId,
          description: subGoal.description,
          status: 'pending',
          dependencies: subGoal.dependencies || [],
          parentId: rootNodeId,
          confidence: subGoal.confidence,
        }
        nodes[nodeId] = node
      })

      // Create goal tree
      const tree: GoalTree = {
        goalId,
        rootNodeId,
        nodes,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      return tree
    } catch (error: any) {
      console.error('[GoalDecompositionEngine] Failed to decompose goal:', error)
      return null
    }
  }

  /**
   * Generate sub-goals from goal description
   * 
   * Produces 3-7 incremental, achievable sub-goals.
   */
  private static generateSubGoals(
    goalDescription: string,
    projectType: { type: string; hasUI: boolean; hasBackend: boolean },
    projectFiles: string[]
  ): Array<{ description: string; dependencies?: string[]; confidence: number }> {
    const lowerGoal = goalDescription.toLowerCase()
    const subGoals: Array<{ description: string; dependencies?: string[]; confidence: number }> = []

    // Heuristic-based decomposition
    // In production, this could use AI to generate more sophisticated decompositions

    if (lowerGoal.includes('calculator')) {
      // Calculator-specific decomposition
      const hasBasicCalc = projectFiles.some(f => 
        f.toLowerCase().includes('calculator') || f.toLowerCase().includes('calc')
      )
      const hasScientific = projectFiles.some(f => 
        f.toLowerCase().includes('scientific') || f.toLowerCase().includes('sin')
      )
      const hasKeyboard = projectFiles.some(f => 
        f.toLowerCase().includes('keyboard') || f.toLowerCase().includes('key')
      )

      if (!hasBasicCalc) {
        subGoals.push({
          description: 'Implement basic calculator logic (addition, subtraction, multiplication, division)',
          confidence: 0.9,
        })
      }

      if (lowerGoal.includes('scientific') && !hasScientific) {
        subGoals.push({
          description: 'Add scientific functions (sin, cos, tan, log, sqrt)',
          dependencies: hasBasicCalc ? [] : [subGoals.length > 0 ? `node-*-${subGoals.length}` : undefined].filter(Boolean) as string[],
          confidence: 0.85,
        })
      }

      if (lowerGoal.includes('keyboard') && !hasKeyboard) {
        subGoals.push({
          description: 'Add keyboard support for calculator input',
          dependencies: hasBasicCalc ? [] : [subGoals.length > 0 ? `node-*-${subGoals.length}` : undefined].filter(Boolean) as string[],
          confidence: 0.8,
        })
      }

      if (projectType.hasUI) {
        subGoals.push({
          description: 'Improve calculator UI/UX and accessibility',
          dependencies: hasBasicCalc ? [] : [subGoals.length > 0 ? `node-*-${subGoals.length}` : undefined].filter(Boolean) as string[],
          confidence: 0.75,
        })
      }

      subGoals.push({
        description: 'Add error handling and input validation',
        confidence: 0.7,
      })
    } else if (lowerGoal.includes('api') || lowerGoal.includes('backend')) {
      // Backend-specific decomposition
      subGoals.push({
        description: 'Set up API server and routing structure',
        confidence: 0.9,
      })
      subGoals.push({
        description: 'Implement core API endpoints',
        dependencies: ['node-*-1'],
        confidence: 0.85,
      })
      subGoals.push({
        description: 'Add request validation and error handling',
        dependencies: ['node-*-2'],
        confidence: 0.8,
      })
      subGoals.push({
        description: 'Add authentication and authorization',
        dependencies: ['node-*-2'],
        confidence: 0.75,
      })
    } else if (lowerGoal.includes('ui') || lowerGoal.includes('interface') || lowerGoal.includes('design')) {
      // UI-specific decomposition
      subGoals.push({
        description: 'Design and implement core UI components',
        confidence: 0.9,
      })
      subGoals.push({
        description: 'Add responsive design and mobile support',
        dependencies: ['node-*-1'],
        confidence: 0.85,
      })
      subGoals.push({
        description: 'Improve accessibility and keyboard navigation',
        dependencies: ['node-*-1'],
        confidence: 0.8,
      })
      subGoals.push({
        description: 'Add animations and transitions',
        dependencies: ['node-*-1'],
        confidence: 0.7,
      })
    } else {
      // Generic goal decomposition
      subGoals.push({
        description: `Implement core functionality for: ${goalDescription.substring(0, 40)}...`,
        confidence: 0.8,
      })
      subGoals.push({
        description: 'Add error handling and edge cases',
        dependencies: ['node-*-1'],
        confidence: 0.75,
      })
      subGoals.push({
        description: 'Improve user experience and polish',
        dependencies: ['node-*-1'],
        confidence: 0.7,
      })
    }

    // Limit to 7 sub-goals max
    return subGoals.slice(0, 7)
  }

  /**
   * Infer project type from files
   */
  private static inferProjectType(
    files: string[],
    descriptor?: any
  ): { type: string; hasUI: boolean; hasBackend: boolean } {
    const hasReact = files.some(f => f.includes('react') || f.endsWith('.tsx') || f.endsWith('.jsx'))
    const hasBackend = files.some(f => f.includes('api') || f.includes('server') || f.includes('route'))
    const hasUI = hasReact || files.some(f => f.endsWith('.html') || f.endsWith('.css'))

    return {
      type: hasReact ? 'react' : hasBackend ? 'backend' : 'static',
      hasUI,
      hasBackend,
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
      console.warn('[GoalDecompositionEngine] Failed to scan project files:', error)
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
}
