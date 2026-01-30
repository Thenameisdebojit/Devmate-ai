/**
 * PHASE F′-10: Product Planning Engine
 * 
 * Analyzes product-level goals and coordinates across projects.
 * NEVER executes anything. Advisory only.
 */

import { getProductMemoryStore, type ProductDescriptor, type ProductGoal } from './ProductMemoryStore'
import { getGoalTreeStore } from '../goals/GoalTreeStore'
import { getExecutionThreadStore } from '../autonomy/ExecutionThreadStore'
import { GoalResolver } from '../goals/GoalResolver'
import { getGoalMemoryStore } from '../goals/GoalMemoryStore'

/**
 * Product Recommendation
 * 
 * Advisory recommendation for product-level coordination.
 */
export type ProductRecommendation =
  | { type: 'advance_project'; projectId: string; reason: string; priority: number }
  | { type: 'align_goals'; projects: string[]; reason: string; priority: number }
  | { type: 'extract_shared_component'; projects: string[]; reason: string; priority: number }

/**
 * Product Plan
 * 
 * Product-level plan with recommendations.
 */
export type ProductPlan = {
  productId: string
  summary: string
  recommendations: ProductRecommendation[]
  confidence: number
  createdAt: number
}

/**
 * Product Planning Engine
 * 
 * Analyzes product ecosystem and provides recommendations.
 * Rules:
 * - Never executes
 * - Never creates files
 * - Never triggers evolutions
 * - Only recommends
 */
export class ProductPlanningEngine {
  /**
   * Generate product-level plan
   * 
   * Analyzes:
   * - ProductGoals
   * - ProjectGoalTrees (from F′-8)
   * - ExecutionThreads (from F′-9)
   * 
   * Answers:
   * - Which project should advance next?
   * - Are goals duplicated across projects?
   * - Is a shared component emerging?
   */
  static async generateProductPlan(productId: string): Promise<ProductPlan | null> {
    try {
      const productStore = getProductMemoryStore()
      const product = await productStore.getProduct(productId)

      if (!product) {
        return null
      }

      // Get product goals
      const productGoals = await productStore.getProductGoals(productId)
      const activeProductGoals = productGoals.filter(g => g.status === 'active')

      if (activeProductGoals.length === 0) {
        return {
          productId,
          summary: 'No active product goals. Set product goals to enable cross-project coordination.',
          recommendations: [],
          confidence: 0.5,
          createdAt: Date.now(),
        }
      }

      // Analyze each project in the product
      const projectAnalyses = await Promise.all(
        product.projectIds.map(async (projectId) => {
          return this.analyzeProject(projectId)
        })
      )

      // Generate recommendations
      const recommendations: ProductRecommendation[] = []

      // Recommendation 1: Which project should advance next?
      const advanceRecommendation = this.recommendProjectToAdvance(projectAnalyses, productGoals)
      if (advanceRecommendation) {
        recommendations.push(advanceRecommendation)
      }

      // Recommendation 2: Are goals duplicated across projects?
      const alignRecommendation = this.recommendGoalAlignment(projectAnalyses, productGoals)
      if (alignRecommendation) {
        recommendations.push(alignRecommendation)
      }

      // Recommendation 3: Is a shared component emerging?
      const sharedComponentRecommendation = this.recommendSharedComponent(projectAnalyses)
      if (sharedComponentRecommendation) {
        recommendations.push(sharedComponentRecommendation)
      }

      // Generate summary
      const summary = this.generateSummary(product, activeProductGoals, projectAnalyses, recommendations)

      // Calculate confidence
      const confidence = this.calculateConfidence(recommendations, projectAnalyses)

      return {
        productId,
        summary,
        recommendations: recommendations.sort((a, b) => b.priority - a.priority),
        confidence,
        createdAt: Date.now(),
      }
    } catch (error: any) {
      console.error('[ProductPlanningEngine] Failed to generate product plan:', error)
      return null
    }
  }

  /**
   * Analyze a single project
   */
  private static async analyzeProject(projectId: string): Promise<{
    projectId: string
    activeGoal: { id: string; description: string } | null
    goalTree: { nodeCount: number; completedNodes: number; pendingNodes: number } | null
    executionThread: { status: string } | null
    projectGoals: Array<{ id: string; description: string; status: string }>
  }> {
    try {
      // Get active goal
      const activeGoal = await GoalResolver.getActiveGoal(projectId)

      // Get goal tree
      let goalTree = null
      if (activeGoal) {
        const treeStore = getGoalTreeStore()
        const tree = await treeStore.getTree(projectId, activeGoal.id)
        if (tree) {
          const nodes = Object.values(tree.nodes)
          goalTree = {
            nodeCount: nodes.length,
            completedNodes: nodes.filter(n => n.status === 'completed').length,
            pendingNodes: nodes.filter(n => n.status === 'pending').length,
          }
        }
      }

      // Get execution thread
      const threadStore = getExecutionThreadStore()
      const thread = await threadStore.getThread(projectId)

      // Get all project goals
      const goalStore = getGoalMemoryStore()
      const projectGoals = await goalStore.getGoals(projectId)

      return {
        projectId,
        activeGoal: activeGoal ? { id: activeGoal.id, description: activeGoal.description } : null,
        goalTree,
        executionThread: thread ? { status: thread.status } : null,
        projectGoals: projectGoals.map(g => ({
          id: g.id,
          description: g.description,
          status: g.status,
        })),
      }
    } catch (error: any) {
      console.warn(`[ProductPlanningEngine] Failed to analyze project ${projectId}:`, error)
      return {
        projectId,
        activeGoal: null,
        goalTree: null,
        executionThread: null,
        projectGoals: [],
      }
    }
  }

  /**
   * Recommend which project should advance next
   */
  private static recommendProjectToAdvance(
    projectAnalyses: Array<Awaited<ReturnType<typeof this.analyzeProject>>>,
    productGoals: ProductGoal[]
  ): ProductRecommendation | null {
    // Find project with most pending work and active goal
    const projectsWithWork = projectAnalyses.filter(p => 
      p.activeGoal && 
      p.goalTree && 
      p.goalTree.pendingNodes > 0 &&
      (p.executionThread?.status === 'active' || !p.executionThread)
    )

    if (projectsWithWork.length === 0) {
      return null
    }

    // Sort by pending nodes (most work first)
    const sorted = projectsWithWork.sort((a, b) => 
      (b.goalTree?.pendingNodes || 0) - (a.goalTree?.pendingNodes || 0)
    )

    const nextProject = sorted[0]

    // Check if any product goal relates to this project
    const relatedProductGoal = productGoals.find(g => 
      g.status === 'active' && g.relatedProjects.includes(nextProject.projectId)
    )

    const reason = relatedProductGoal
      ? `Project has ${nextProject.goalTree?.pendingNodes} pending goal nodes and relates to active product goal: "${relatedProductGoal.description}"`
      : `Project has ${nextProject.goalTree?.pendingNodes} pending goal nodes and is ready to advance`

    return {
      type: 'advance_project',
      projectId: nextProject.projectId,
      reason,
      priority: nextProject.goalTree?.pendingNodes || 0,
    }
  }

  /**
   * Recommend goal alignment across projects
   */
  private static recommendGoalAlignment(
    projectAnalyses: Array<Awaited<ReturnType<typeof this.analyzeProject>>>,
    productGoals: ProductGoal[]
  ): ProductRecommendation | null {
    // Check for duplicate goal descriptions across projects
    const goalDescriptions = new Map<string, string[]>() // description -> projectIds

    for (const analysis of projectAnalyses) {
      for (const goal of analysis.projectGoals) {
        if (goal.status === 'active') {
          const key = goal.description.toLowerCase().trim()
          if (!goalDescriptions.has(key)) {
            goalDescriptions.set(key, [])
          }
          goalDescriptions.get(key)!.push(analysis.projectId)
        }
      }
    }

    // Find goals that appear in multiple projects
    const duplicateGoals = Array.from(goalDescriptions.entries()).filter(
      ([_, projectIds]) => projectIds.length > 1
    )

    if (duplicateGoals.length === 0) {
      return null
    }

    const [description, projectIds] = duplicateGoals[0]

    return {
      type: 'align_goals',
      projects: projectIds,
      reason: `Goal "${description}" appears in ${projectIds.length} projects. Consider aligning these goals or extracting shared functionality.`,
      priority: projectIds.length * 10, // Higher priority for more duplicates
    }
  }

  /**
   * Recommend shared component extraction
   */
  private static recommendSharedComponent(
    projectAnalyses: Array<Awaited<ReturnType<typeof this.analyzeProject>>>
  ): ProductRecommendation | null {
    // Heuristic: If multiple projects have similar goal descriptions, suggest shared component
    const projectsWithGoals = projectAnalyses.filter(p => p.projectGoals.length > 0)

    if (projectsWithGoals.length < 2) {
      return null
    }

    // Check for common keywords in goal descriptions
    const allGoalKeywords = new Map<string, Set<string>>() // keyword -> projectIds

    for (const analysis of projectsWithGoals) {
      for (const goal of analysis.projectGoals) {
        if (goal.status === 'active') {
          const keywords = this.extractKeywords(goal.description)
          for (const keyword of keywords) {
            if (!allGoalKeywords.has(keyword)) {
              allGoalKeywords.set(keyword, new Set())
            }
            allGoalKeywords.get(keyword)!.add(analysis.projectId)
          }
        }
      }
    }

    // Find keywords that appear in multiple projects
    const sharedKeywords = Array.from(allGoalKeywords.entries())
      .filter(([_, projectIds]) => projectIds.size >= 2)
      .sort((a, b) => b[1].size - a[1].size)

    if (sharedKeywords.length === 0) {
      return null
    }

    const [keyword, projectIds] = sharedKeywords[0]
    const projectIdsArray = Array.from(projectIds)

    return {
      type: 'extract_shared_component',
      projects: projectIdsArray,
      reason: `Multiple projects share "${keyword}" functionality. Consider extracting a shared component or library.`,
      priority: projectIds.size * 5,
    }
  }

  /**
   * Generate summary
   */
  private static generateSummary(
    product: ProductDescriptor,
    activeProductGoals: ProductGoal[],
    projectAnalyses: Array<Awaited<ReturnType<typeof this.analyzeProject>>>,
    recommendations: ProductRecommendation[]
  ): string {
    const parts: string[] = []

    parts.push(`Product "${product.name}" consists of ${product.projectIds.length} project(s).`)

    if (activeProductGoals.length > 0) {
      parts.push(`${activeProductGoals.length} active product goal(s).`)
    }

    const projectsWithActiveGoals = projectAnalyses.filter(p => p.activeGoal).length
    parts.push(`${projectsWithActiveGoals} project(s) have active goals.`)

    const totalPendingNodes = projectAnalyses.reduce((sum, p) => 
      sum + (p.goalTree?.pendingNodes || 0), 0
    )
    if (totalPendingNodes > 0) {
      parts.push(`${totalPendingNodes} total pending goal node(s) across all projects.`)
    }

    if (recommendations.length > 0) {
      parts.push(`${recommendations.length} recommendation(s) for coordination.`)
    }

    return parts.join(' ')
  }

  /**
   * Calculate confidence
   */
  private static calculateConfidence(
    recommendations: ProductRecommendation[],
    projectAnalyses: Array<Awaited<ReturnType<typeof this.analyzeProject>>>
  ): number {
    if (recommendations.length === 0) {
      return 0.5
    }

    let confidence = 0.5

    // More recommendations = higher confidence (more data)
    if (recommendations.length >= 2) {
      confidence += 0.2
    }

    // Projects with active goals = higher confidence
    const projectsWithGoals = projectAnalyses.filter(p => p.activeGoal).length
    if (projectsWithGoals >= 2) {
      confidence += 0.2
    }

    // High priority recommendations = higher confidence
    const highPriorityCount = recommendations.filter(r => r.priority >= 10).length
    if (highPriorityCount > 0) {
      confidence += 0.1
    }

    return Math.min(1.0, Math.max(0.0, confidence))
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
