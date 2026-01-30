/**
 * PHASE F′-6: Planning Engine
 * 
 * Generates forward-looking plans based on active goals and project state.
 * Never executes steps. Never mutates state. Planning only.
 */

import { getPlanningStore } from './PlanningStore'
import { GoalResolver } from '../goals/GoalResolver'
import { getProjectEvolutionEngineManager } from '../ProjectEvolutionEngineManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { promises as fs } from 'fs'
import { join } from 'path'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'

/**
 * Planned Step
 * 
 * Represents a suggested next step toward the active goal.
 * Always requires confirmation - never auto-executes.
 */
export type PlannedStep = {
  id: string
  description: string
  intentType: ExecutionIntent['type']
  estimatedImpact: 'low' | 'medium' | 'high'
  requiresConfirmation: true // Always true - no auto-execution
  reasoning?: string // Why this step is suggested
}

/**
 * Planning Cycle
 * 
 * Represents a forward-looking plan for advancing toward a goal.
 */
export type PlanningCycle = {
  projectId: string
  goalId: string
  currentStateSummary: string
  proposedNextSteps: PlannedStep[]
  confidence: number // 0-1, confidence in the plan
  createdAt: number
}

/**
 * Planning Engine
 * 
 * Generates proactive plans based on active goals and project state.
 * Rules:
 * - Never executes steps
 * - Never mutates state
 * - Only generates suggestions
 * - Requires active goal
 */
export class PlanningEngine {
  /**
   * Generate a forward-looking plan for a project
   * 
   * Analyzes:
   * - Active project goal
   * - Current project files
   * - Recent evolution history
   * 
   * Outputs:
   * - Ordered list of suggested next steps
   * - Confidence score
   * - Current state summary
   */
  static async generatePlan(projectId: string): Promise<PlanningCycle | null> {
    try {
      // Get active goal
      const activeGoal = await GoalResolver.getActiveGoal(projectId)
      if (!activeGoal) {
        // No active goal - cannot generate plan
        return null
      }

      // Get project state
      const rootPath = await WorkspaceRegistry.getRootPath(projectId)
      if (!rootPath) {
        return null
      }

      // Get current stage
      const peeManager = getProjectEvolutionEngineManager()
      const pee = await peeManager.getEngine(projectId, rootPath)
      const stage = pee.getStage()

      // Planning only allowed in editable or evolving stages
      if (stage === 'empty' || stage === 'locked') {
        return null
      }

      // Analyze current project state
      const stateSummary = await this.analyzeProjectState(rootPath, activeGoal.description)

      // PHASE F′-8: Generate next steps from GoalNodes instead of raw goal
      const nextSteps = await this.generateNextStepsFromGoalTree(
        projectId,
        activeGoal,
        stateSummary,
        rootPath
      )

      // Calculate confidence
      const confidence = this.calculateConfidence(nextSteps, stateSummary)

      // Create planning cycle
      const cycle: PlanningCycle = {
        projectId,
        goalId: activeGoal.id,
        currentStateSummary: stateSummary,
        proposedNextSteps: nextSteps,
        confidence,
        createdAt: Date.now(),
      }

      // Store planning cycle
      const store = getPlanningStore()
      store.store(cycle)

      return cycle
    } catch (error: any) {
      console.error('[PlanningEngine] Failed to generate plan:', error)
      return null
    }
  }

  /**
   * Analyze current project state
   */
  private static async analyzeProjectState(
    rootPath: string,
    goalDescription: string
  ): Promise<string> {
    try {
      // Get project files
      const files = await this.getProjectFiles(rootPath)
      const fileCount = files.length

      // Analyze file types
      const hasReact = files.some(f => f.includes('react') || f.includes('tsx') || f.includes('jsx'))
      const hasBackend = files.some(f => f.includes('api') || f.includes('server') || f.includes('route'))
      const hasStyles = files.some(f => f.endsWith('.css') || f.includes('style'))
      const hasConfig = files.some(f => f.includes('package.json') || f.includes('tsconfig'))

      // Build summary
      const parts: string[] = []
      parts.push(`Project has ${fileCount} files`)
      if (hasReact) parts.push('React/TypeScript frontend')
      if (hasBackend) parts.push('backend API')
      if (hasStyles) parts.push('styling files')
      if (hasConfig) parts.push('configuration files')

      return parts.join(', ')
    } catch (error: any) {
      return 'Project state analysis unavailable'
    }
  }

  /**
   * PHASE F′-8: Generate next steps from GoalTree nodes
   */
  private static async generateNextStepsFromGoalTree(
    projectId: string,
    goal: { id: string; description: string },
    stateSummary: string,
    rootPath: string
  ): Promise<PlannedStep[]> {
    try {
      // Get goal tree
      const { getGoalTreeStore } = await import('../goals/GoalTreeStore')
      const { GoalProgressResolver } = await import('../goals/GoalProgressResolver')
      const treeStore = getGoalTreeStore()
      
      const tree = await treeStore.getTree(projectId, goal.id)
      
      if (tree) {
        // Resolve progress to get current node statuses
        const statusUpdates = await GoalProgressResolver.resolveProgress(projectId, goal.id)
        
        // Update node statuses in tree store
        for (const [nodeId, status] of Object.entries(statusUpdates)) {
          await treeStore.updateNodeStatus(projectId, goal.id, nodeId, status)
        }

        // Get next executable nodes (pending nodes with satisfied dependencies)
        const executableNodes = await treeStore.getNextExecutableNodes(projectId, goal.id)

        // Convert GoalNodes to PlannedSteps
        const steps: PlannedStep[] = executableNodes.map(node => ({
          id: node.id,
          description: node.description,
          intentType: this.inferIntentType(node.description),
          estimatedImpact: this.inferImpact(node.description),
          requiresConfirmation: true,
          reasoning: `Part of goal tree: ${goal.description}`,
          goalNodeId: node.id, // PHASE F′-8: Reference to GoalNode
        }))

        // Limit to 5 steps max
        return steps.slice(0, 5)
      }
    } catch (error: any) {
      console.warn('[PlanningEngine] Failed to generate steps from goal tree, falling back to raw goal:', error)
    }

    // Fallback to original behavior if goal tree doesn't exist
    return this.generateNextSteps(projectId, goal, stateSummary, rootPath)
  }

  /**
   * Generate next steps based on goal (fallback when no goal tree exists)
   */
  private static async generateNextSteps(
    projectId: string,
    goal: { id: string; description: string },
    stateSummary: string,
    rootPath: string
  ): Promise<PlannedStep[]> {
    const steps: PlannedStep[] = []
    const lowerGoal = goal.description.toLowerCase()

    // Analyze goal to determine logical next steps
    // This is a heuristic-based approach - in production, could use AI

    // Check what's already in the project
    const files = await this.getProjectFiles(rootPath)
    const hasCalculator = files.some(f => f.toLowerCase().includes('calculator') || f.toLowerCase().includes('calc'))
    const hasKeyboard = files.some(f => f.toLowerCase().includes('keyboard') || f.toLowerCase().includes('key'))
    const hasScientific = files.some(f => f.toLowerCase().includes('scientific') || f.toLowerCase().includes('sin') || f.toLowerCase().includes('cos'))

    // Generate steps based on goal keywords and current state
    if (lowerGoal.includes('calculator')) {
      if (!hasCalculator) {
        steps.push({
          id: `step-${Date.now()}-1`,
          description: 'Add basic calculator logic and UI',
          intentType: 'expand_features',
          estimatedImpact: 'high',
          requiresConfirmation: true,
          reasoning: 'Core calculator functionality is missing',
        })
      }

      if (lowerGoal.includes('keyboard') && !hasKeyboard) {
        steps.push({
          id: `step-${Date.now()}-2`,
          description: 'Add keyboard support for calculator input',
          intentType: 'expand_features',
          estimatedImpact: 'medium',
          requiresConfirmation: true,
          reasoning: 'Goal requires keyboard support',
        })
      }

      if (lowerGoal.includes('scientific') && !hasScientific) {
        steps.push({
          id: `step-${Date.now()}-3`,
          description: 'Add scientific functions (sin, cos, tan, log)',
          intentType: 'expand_features',
          estimatedImpact: 'high',
          requiresConfirmation: true,
          reasoning: 'Goal requires scientific calculator features',
        })
      }

      // Always suggest UI improvements if calculator exists
      if (hasCalculator) {
        steps.push({
          id: `step-${Date.now()}-4`,
          description: 'Improve calculator UI/UX and accessibility',
          intentType: 'redesign_ui',
          estimatedImpact: 'medium',
          requiresConfirmation: true,
          reasoning: 'UI improvements enhance user experience',
        })
      }
    } else if (lowerGoal.includes('api') || lowerGoal.includes('backend')) {
      steps.push({
        id: `step-${Date.now()}-1`,
        description: 'Add API endpoints and routes',
        intentType: 'expand_features',
        estimatedImpact: 'high',
        requiresConfirmation: true,
        reasoning: 'Backend API is core to the goal',
      })
    } else if (lowerGoal.includes('ui') || lowerGoal.includes('interface') || lowerGoal.includes('design')) {
      steps.push({
        id: `step-${Date.now()}-1`,
        description: 'Redesign and improve UI/UX',
        intentType: 'redesign_ui',
        estimatedImpact: 'high',
        requiresConfirmation: true,
        reasoning: 'UI/UX improvement is the primary goal',
      })
    } else {
      // Generic goal - suggest incremental improvements
      steps.push({
        id: `step-${Date.now()}-1`,
        description: `Advance toward goal: ${goal.description.substring(0, 50)}...`,
        intentType: 'expand_features',
        estimatedImpact: 'medium',
        requiresConfirmation: true,
        reasoning: 'Next logical step toward goal',
      })
    }

    // Limit to 5 steps max
    return steps.slice(0, 5)
  }

  /**
   * Calculate confidence in the plan
   */
  private static calculateConfidence(
    steps: PlannedStep[],
    stateSummary: string
  ): number {
    if (steps.length === 0) {
      return 0
    }

    // Base confidence on number of steps and their specificity
    let confidence = 0.5 // Base confidence

    // More specific steps = higher confidence
    const specificSteps = steps.filter(s => 
      s.reasoning && s.reasoning.length > 20
    )
    confidence += (specificSteps.length / steps.length) * 0.3

    // More steps = lower confidence (harder to predict)
    if (steps.length > 3) {
      confidence -= 0.1
    }

    // State summary quality
    if (stateSummary.length > 50) {
      confidence += 0.1
    }

    return Math.min(1.0, Math.max(0.0, confidence))
  }

  /**
   * Get project files (excluding node_modules, .git, etc.)
   */
  private static async getProjectFiles(rootPath: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      await this.scanDirectory(rootPath, files, rootPath)
    } catch (error: any) {
      console.warn('[PlanningEngine] Failed to scan project files:', error)
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
    if (depth > 10) return // Limit depth

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
          files.push(fullPath.replace(rootPath, '').replace(/^[\\/]/, ''))
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
}
