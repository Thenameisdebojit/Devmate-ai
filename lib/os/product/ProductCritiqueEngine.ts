/**
 * PHASE F′-10: Product Critique Engine
 * 
 * Detects product-level issues across multiple projects.
 * Produces advisory findings only. No fixes. No execution. No mutation.
 */

import { getProductMemoryStore, type ProductDescriptor } from './ProductMemoryStore'
import { getGoalMemoryStore } from '../goals/GoalMemoryStore'
import { getGoalTreeStore } from '../goals/GoalTreeStore'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Product Finding
 * 
 * Advisory finding about product-level issues.
 */
export type ProductFinding = {
  severity: 'high' | 'medium' | 'low'
  description: string
  affectedProjects: string[]
  suggestion?: string
  type: 'duplicate_logic' | 'diverging_architecture' | 'inconsistent_completion' | 'goal_conflict'
}

/**
 * Product Critique Report
 * 
 * Product-level critique with findings.
 */
export type ProductCritiqueReport = {
  productId: string
  findings: ProductFinding[]
  summary: string
  confidence: number
  createdAt: number
}

/**
 * Product Critique Engine
 * 
 * Analyzes product ecosystem for issues.
 * Rules:
 * - No fixes
 * - No execution
 * - No mutation
 * - Only advisory findings
 */
export class ProductCritiqueEngine {
  /**
   * Generate product critique report
   * 
   * Detects:
   * - Duplicate logic across projects
   * - Diverging architectures
   * - Inconsistent goal completion
   */
  static async generateProductCritique(productId: string): Promise<ProductCritiqueReport | null> {
    try {
      const productStore = getProductMemoryStore()
      const product = await productStore.getProduct(productId)

      if (!product) {
        return null
      }

      const findings: ProductFinding[] = []

      // Analyze for duplicate logic
      const duplicateFindings = await this.detectDuplicateLogic(product)
      findings.push(...duplicateFindings)

      // Analyze for diverging architectures
      const architectureFindings = await this.detectDivergingArchitecture(product)
      findings.push(...architectureFindings)

      // Analyze for inconsistent goal completion
      const completionFindings = await this.detectInconsistentCompletion(product)
      findings.push(...completionFindings)

      // Analyze for goal conflicts
      const conflictFindings = await this.detectGoalConflicts(product)
      findings.push(...conflictFindings)

      // Generate summary
      const summary = this.generateSummary(findings, product)

      // Calculate confidence
      const confidence = this.calculateConfidence(findings)

      return {
        productId,
        findings,
        summary,
        confidence,
        createdAt: Date.now(),
      }
    } catch (error: any) {
      console.error('[ProductCritiqueEngine] Failed to generate product critique:', error)
      return null
    }
  }

  /**
   * Detect duplicate logic across projects
   */
  private static async detectDuplicateLogic(product: ProductDescriptor): Promise<ProductFinding[]> {
    const findings: ProductFinding[] = []

    try {
      // Get goal descriptions from all projects
      const goalStore = getGoalMemoryStore()
      const allProjectGoals: Array<{ projectId: string; goals: Array<{ description: string }> }> = []

      for (const projectId of product.projectIds) {
        try {
          const goals = await goalStore.getGoals(projectId)
          allProjectGoals.push({
            projectId,
            goals: goals.map(g => ({ description: g.description })),
          })
        } catch (error: any) {
          // Skip projects we can't analyze
          console.warn(`[ProductCritiqueEngine] Failed to get goals for project ${projectId}:`, error)
        }
      }

      // Check for duplicate goal descriptions
      const goalDescriptions = new Map<string, string[]>() // description -> projectIds

      for (const { projectId, goals } of allProjectGoals) {
        for (const goal of goals) {
          const key = goal.description.toLowerCase().trim()
          if (!goalDescriptions.has(key)) {
            goalDescriptions.set(key, [])
          }
          goalDescriptions.get(key)!.push(projectId)
        }
      }

      // Find duplicates
      for (const [description, projectIds] of goalDescriptions.entries()) {
        if (projectIds.length > 1) {
          findings.push({
            severity: 'medium',
            description: `Duplicate goal "${description}" exists in ${projectIds.length} projects`,
            affectedProjects: projectIds,
            suggestion: 'Consider consolidating this goal or extracting shared functionality',
            type: 'duplicate_logic',
          })
        }
      }
    } catch (error: any) {
      console.warn('[ProductCritiqueEngine] Failed to detect duplicate logic:', error)
    }

    return findings
  }

  /**
   * Detect diverging architectures
   */
  private static async detectDivergingArchitecture(product: ProductDescriptor): Promise<ProductFinding[]> {
    const findings: ProductFinding[] = []

    try {
      // Analyze project file structures
      const projectStructures: Array<{ projectId: string; hasReact: boolean; hasBackend: boolean; hasPython: boolean }> = []

      for (const projectId of product.projectIds) {
        try {
          const rootPath = await WorkspaceRegistry.getRootPath(projectId)
          if (!rootPath) continue

          const files = await this.getProjectFiles(rootPath)
          projectStructures.push({
            projectId,
            hasReact: files.some(f => f.includes('react') || f.endsWith('.tsx') || f.endsWith('.jsx')),
            hasBackend: files.some(f => f.includes('api') || f.includes('server') || f.includes('route')),
            hasPython: files.some(f => f.endsWith('.py')),
          })
        } catch (error: any) {
          // Skip projects we can't analyze
        }
      }

      // Check for architectural divergence
      const hasReactProjects = projectStructures.filter(p => p.hasReact).length
      const hasBackendProjects = projectStructures.filter(p => p.hasBackend).length
      const hasPythonProjects = projectStructures.filter(p => p.hasPython).length

      if (hasReactProjects > 0 && hasBackendProjects > 0 && hasReactProjects + hasBackendProjects < product.projectIds.length) {
        findings.push({
          severity: 'low',
          description: `Product has mixed architectures: ${hasReactProjects} React project(s), ${hasBackendProjects} backend project(s)`,
          affectedProjects: product.projectIds,
          suggestion: 'Consider standardizing architecture or documenting the architectural split',
          type: 'diverging_architecture',
        })
      }
    } catch (error: any) {
      console.warn('[ProductCritiqueEngine] Failed to detect diverging architecture:', error)
    }

    return findings
  }

  /**
   * Detect inconsistent goal completion
   */
  private static async detectInconsistentCompletion(product: ProductDescriptor): Promise<ProductFinding[]> {
    const findings: ProductFinding[] = []

    try {
      // Get goal trees for all projects
      const treeStore = getGoalTreeStore()
      const goalStore = getGoalMemoryStore()
      const projectCompletions: Array<{ projectId: string; completionRate: number }> = []

      for (const projectId of product.projectIds) {
        try {
          const goals = await goalStore.getGoals(projectId)
          const activeGoal = goals.find(g => g.status === 'active')

          if (activeGoal) {
            const tree = await treeStore.getTree(projectId, activeGoal.id)
            if (tree) {
              const nodes = Object.values(tree.nodes)
              const completed = nodes.filter(n => n.status === 'completed').length
              const total = nodes.length
              const completionRate = total > 0 ? completed / total : 0

              projectCompletions.push({ projectId, completionRate })
            }
          }
        } catch (error: any) {
          // Skip projects we can't analyze
        }
      }

      // Check for significant completion rate differences
      if (projectCompletions.length >= 2) {
        const rates = projectCompletions.map(p => p.completionRate)
        const maxRate = Math.max(...rates)
        const minRate = Math.min(...rates)

        if (maxRate - minRate > 0.5) {
          const laggingProjects = projectCompletions
            .filter(p => p.completionRate < maxRate - 0.3)
            .map(p => p.projectId)

          if (laggingProjects.length > 0) {
            findings.push({
              severity: 'medium',
              description: `Significant completion rate differences detected. Some projects are lagging behind.`,
              affectedProjects: laggingProjects,
              suggestion: 'Consider prioritizing lagging projects or rebalancing work',
              type: 'inconsistent_completion',
            })
          }
        }
      }
    } catch (error: any) {
      console.warn('[ProductCritiqueEngine] Failed to detect inconsistent completion:', error)
    }

    return findings
  }

  /**
   * Detect goal conflicts
   */
  private static async detectGoalConflicts(product: ProductDescriptor): Promise<ProductFinding[]> {
    const findings: ProductFinding[] = []

    try {
      const productStore = getProductMemoryStore()
      const productGoals = await productStore.getProductGoals(product.productId)
      const activeProductGoals = productGoals.filter(g => g.status === 'active')

      // Check if multiple product goals target the same projects
      const projectGoalCounts = new Map<string, number>() // projectId -> goal count

      for (const goal of activeProductGoals) {
        for (const projectId of goal.relatedProjects) {
          projectGoalCounts.set(projectId, (projectGoalCounts.get(projectId) || 0) + 1)
        }
      }

      // Find projects with multiple conflicting goals
      const conflictedProjects = Array.from(projectGoalCounts.entries())
        .filter(([_, count]) => count > 1)
        .map(([projectId]) => projectId)

      if (conflictedProjects.length > 0) {
        findings.push({
          severity: 'high',
          description: `${conflictedProjects.length} project(s) have multiple active product goals, which may conflict`,
          affectedProjects: conflictedProjects,
          suggestion: 'Review and prioritize product goals to avoid conflicts',
          type: 'goal_conflict',
        })
      }
    } catch (error: any) {
      console.warn('[ProductCritiqueEngine] Failed to detect goal conflicts:', error)
    }

    return findings
  }

  /**
   * Generate summary
   */
  private static generateSummary(findings: ProductFinding[], product: ProductDescriptor): string {
    if (findings.length === 0) {
      return `Product "${product.name}" appears well-coordinated. No issues detected across ${product.projectIds.length} project(s).`
    }

    const highSeverity = findings.filter(f => f.severity === 'high').length
    const mediumSeverity = findings.filter(f => f.severity === 'medium').length
    const lowSeverity = findings.filter(f => f.severity === 'low').length

    const parts: string[] = []
    parts.push(`Found ${findings.length} product-level issue(s)`)
    if (highSeverity > 0) parts.push(`${highSeverity} high priority`)
    if (mediumSeverity > 0) parts.push(`${mediumSeverity} medium priority`)
    if (lowSeverity > 0) parts.push(`${lowSeverity} low priority`)

    return parts.join(', ') + '.'
  }

  /**
   * Calculate confidence
   */
  private static calculateConfidence(findings: ProductFinding[]): number {
    if (findings.length === 0) {
      return 0.8
    }

    let confidence = 0.5

    // More findings = higher confidence (more evidence)
    if (findings.length >= 3) {
      confidence += 0.2
    }

    // High severity findings = higher confidence
    const highSeverityCount = findings.filter(f => f.severity === 'high').length
    if (highSeverityCount > 0) {
      confidence += 0.2
    }

    return Math.min(1.0, Math.max(0.0, confidence))
  }

  /**
   * Get project files
   */
  private static async getProjectFiles(rootPath: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      await this.scanDirectory(rootPath, files, rootPath)
    } catch (error: any) {
      console.warn('[ProductCritiqueEngine] Failed to scan project files:', error)
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
