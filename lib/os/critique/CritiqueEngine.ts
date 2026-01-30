/**
 * PHASE F′-7: Critique Engine
 * 
 * Evaluates executed changes and proposes repairs.
 * Never mutates state. Never executes fixes. Evaluation only.
 */

import { getPendingEvolutionStore } from '../evolution/PendingEvolutionStore'
import { GoalResolver } from '../goals/GoalResolver'
import { getProjectEvolutionEngineManager } from '../ProjectEvolutionEngineManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { RuntimeKernel } from '@/lib/runtime/runtimeKernel'
import type { PlannedStep } from '../planning/PlanningEngine'
import { promises as fs } from 'fs'
import { join } from 'path'

/**
 * Finding Type
 * 
 * Categories of issues detected in critique.
 */
export type FindingType = 'bug' | 'incomplete' | 'ui_issue' | 'performance' | 'goal_gap'

/**
 * Finding
 * 
 * Represents an issue detected in the executed evolution.
 */
export type Finding = {
  type: FindingType
  description: string
  severity: 'low' | 'medium' | 'high'
  suggestedFix: PlannedStep & { goalNodeId?: string } // PHASE F′-8: Reference to GoalNode
  evidence?: string // What led to this finding
}

/**
 * Critique Report
 * 
 * Comprehensive evaluation of an executed evolution.
 */
export type CritiqueReport = {
  evolutionId: string
  projectId: string
  goalId: string | null
  findings: Finding[]
  confidence: number // 0-1, confidence in the critique
  summary: string
  createdAt: number
}

/**
 * Critique Engine
 * 
 * Analyzes executed evolutions and proposes repairs.
 * Rules:
 * - Never mutates state
 * - Never executes fixes
 * - Only generates findings and suggestions
 */
export class CritiqueEngine {
  /**
   * Generate critique report for a completed evolution
   * 
   * Analyzes:
   * - Runtime results (success/failure, errors)
   * - Project files modified in evolution
   * - Active goal alignment
   * - Code quality heuristics
   * 
   * Outputs:
   * - Findings with suggested fixes
   * - Confidence score
   */
  static async generateCritique(
    projectId: string,
    evolutionId: string
  ): Promise<CritiqueReport | null> {
    try {
      // Get evolution details
      const evolutionStore = getPendingEvolutionStore()
      const evolution = evolutionStore.getById(evolutionId)

      if (!evolution || evolution.status !== 'completed') {
        // Can only critique completed evolutions
        return null
      }

      // Get active goal
      const activeGoal = await GoalResolver.getActiveGoal(projectId)
      const goalId = activeGoal?.id || null

      // Get project state
      const rootPath = await WorkspaceRegistry.getRootPath(projectId)
      if (!rootPath) {
        return null
      }

      // Analyze runtime state
      const runtimeFindings = await this.analyzeRuntime(projectId)

      // Analyze file changes
      const fileFindings = await this.analyzeFileChanges(projectId, evolutionId, rootPath)

      // Analyze goal alignment
      const goalFindings = await this.analyzeGoalAlignment(
        projectId,
        activeGoal,
        evolution,
        rootPath
      )

      // Combine all findings
      const allFindingsRaw = [...runtimeFindings, ...fileFindings, ...goalFindings]

      // PHASE F′-8: Map findings to GoalNodes when possible
      const allFindings = await this.mapFindingsToGoalNodes(
        projectId,
        goalId,
        allFindingsRaw
      )

      // Calculate confidence
      const confidence = this.calculateConfidence(allFindings, runtimeFindings.length > 0)

      // Generate summary
      const summary = this.generateSummary(allFindings, activeGoal)

      // Create critique report
      const report: CritiqueReport = {
        evolutionId,
        projectId,
        goalId,
        findings: allFindings,
        confidence,
        summary,
        createdAt: Date.now(),
      }

      return report
    } catch (error: any) {
      console.error('[CritiqueEngine] Failed to generate critique:', error)
      return null
    }
  }

  /**
   * Analyze runtime state for issues
   */
  private static async analyzeRuntime(projectId: string): Promise<Finding[]> {
    const findings: Finding[] = []

    try {
      const kernel = RuntimeKernel.get(projectId)
      const state = kernel.getState()

      // Check for runtime errors
      if (state.status === 'crashed' || state.status === 'error') {
        findings.push({
          type: 'bug',
          description: `Runtime is in ${state.status} state. The application may have errors preventing it from running.`,
          severity: 'high',
          suggestedFix: {
            id: `fix-${Date.now()}-runtime`,
            description: 'Fix runtime errors and restore application stability',
            intentType: 'fix',
            estimatedImpact: 'high',
            requiresConfirmation: true,
            reasoning: 'Runtime errors prevent the application from functioning',
          },
          evidence: `Runtime status: ${state.status}`,
        })
      }

      // Check for build errors (if available in state)
      if ((state as any).buildErrors && (state as any).buildErrors.length > 0) {
        findings.push({
          type: 'bug',
          description: `Build errors detected: ${(state as any).buildErrors.length} error(s)`,
          severity: 'high',
          suggestedFix: {
            id: `fix-${Date.now()}-build`,
            description: 'Fix build errors and compilation issues',
            intentType: 'fix',
            estimatedImpact: 'high',
            requiresConfirmation: true,
            reasoning: 'Build errors prevent the application from compiling',
          },
          evidence: `Build errors: ${(state as any).buildErrors.join(', ')}`,
        })
      }
    } catch (error: any) {
      // Runtime kernel may not be available - that's okay
      // Don't add findings if we can't analyze runtime
    }

    return findings
  }

  /**
   * Analyze file changes for issues
   */
  private static async analyzeFileChanges(
    projectId: string,
    evolutionId: string,
    rootPath: string
  ): Promise<Finding[]> {
    const findings: Finding[] = []

    try {
      // Get evolution to see what files were changed
      const evolutionStore = getPendingEvolutionStore()
      const evolution = evolutionStore.getById(evolutionId)

      if (!evolution) {
        return findings
      }

      // Analyze modified files for common issues
      // This is a heuristic-based approach
      const files = await this.getProjectFiles(rootPath)
      
      // Check for incomplete implementations (files with TODO, FIXME, etc.)
      const incompleteFiles: string[] = []
      for (const file of files.slice(0, 10)) { // Limit to avoid performance issues
        try {
          const content = await fs.readFile(join(rootPath, file), 'utf-8')
          const lowerContent = content.toLowerCase()
          
          if (lowerContent.includes('todo') || lowerContent.includes('fixme') || 
              lowerContent.includes('xxx') || lowerContent.includes('hack')) {
            incompleteFiles.push(file)
          }
        } catch {
          // Skip files we can't read
        }
      }

      if (incompleteFiles.length > 0) {
        findings.push({
          type: 'incomplete',
          description: `Found ${incompleteFiles.length} file(s) with TODO/FIXME markers indicating incomplete implementation`,
          severity: 'medium',
          suggestedFix: {
            id: `fix-${Date.now()}-incomplete`,
            description: 'Complete incomplete implementations marked with TODO/FIXME',
            intentType: 'mutate',
            estimatedImpact: 'medium',
            requiresConfirmation: true,
            reasoning: 'Incomplete code may cause unexpected behavior',
          },
          evidence: `Files: ${incompleteFiles.slice(0, 3).join(', ')}${incompleteFiles.length > 3 ? '...' : ''}`,
        })
      }

      // Check for missing error handling (heuristic: try-catch blocks)
      const filesWithoutErrorHandling: string[] = []
      for (const file of files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')).slice(0, 10)) {
        try {
          const content = await fs.readFile(join(rootPath, file), 'utf-8')
          // Simple heuristic: if file has async/await or promises but no try-catch
          if ((content.includes('async') || content.includes('Promise')) && 
              !content.includes('try') && !content.includes('catch')) {
            filesWithoutErrorHandling.push(file)
          }
        } catch {
          // Skip
        }
      }

      if (filesWithoutErrorHandling.length > 0) {
        findings.push({
          type: 'incomplete',
          description: `Found ${filesWithoutErrorHandling.length} file(s) with async operations that may lack error handling`,
          severity: 'low',
          suggestedFix: {
            id: `fix-${Date.now()}-error-handling`,
            description: 'Add error handling to async operations',
            intentType: 'mutate',
            estimatedImpact: 'low',
            requiresConfirmation: true,
            reasoning: 'Error handling improves application robustness',
          },
          evidence: `Files: ${filesWithoutErrorHandling.slice(0, 3).join(', ')}${filesWithoutErrorHandling.length > 3 ? '...' : ''}`,
        })
      }
    } catch (error: any) {
      console.warn('[CritiqueEngine] Failed to analyze file changes:', error)
    }

    return findings
  }

  /**
   * Analyze goal alignment
   */
  private static async analyzeGoalAlignment(
    projectId: string,
    activeGoal: { id: string; description: string } | null,
    evolution: { plan: string; intents: any[] },
    rootPath: string
  ): Promise<Finding[]> {
    const findings: Finding[] = []

    if (!activeGoal) {
      return findings
    }

    try {
      const goalLower = activeGoal.description.toLowerCase()
      const evolutionPlanLower = evolution.plan.toLowerCase()

      // Check if evolution plan mentions goal keywords
      const goalKeywords = this.extractKeywords(activeGoal.description)
      const planKeywords = this.extractKeywords(evolution.plan)

      // Calculate overlap
      const matchingKeywords = goalKeywords.filter(kw => 
        planKeywords.some(pk => pk.includes(kw) || kw.includes(pk))
      )

      // If low overlap, goal may not have been fully addressed
      if (matchingKeywords.length < goalKeywords.length * 0.5) {
        findings.push({
          type: 'goal_gap',
          description: `Evolution may not fully address the active goal: "${activeGoal.description}"`,
          severity: 'medium',
          suggestedFix: {
            id: `fix-${Date.now()}-goal`,
            description: `Refine implementation to better align with goal: ${activeGoal.description.substring(0, 50)}...`,
            intentType: 'expand_features',
            estimatedImpact: 'medium',
            requiresConfirmation: true,
            reasoning: 'Current implementation may not fully satisfy the project goal',
          },
          evidence: `Goal keywords: ${goalKeywords.slice(0, 3).join(', ')}, Plan keywords: ${planKeywords.slice(0, 3).join(', ')}`,
        })
      }

      // Check for specific goal requirements
      if (goalLower.includes('keyboard') && !evolutionPlanLower.includes('keyboard')) {
        findings.push({
          type: 'goal_gap',
          description: 'Goal requires keyboard support, but evolution may not have addressed it',
          severity: 'high',
          suggestedFix: {
            id: `fix-${Date.now()}-keyboard`,
            description: 'Add keyboard support as required by the active goal',
            intentType: 'expand_features',
            estimatedImpact: 'high',
            requiresConfirmation: true,
            reasoning: 'Keyboard support is explicitly required by the project goal',
          },
        })
      }

      if (goalLower.includes('scientific') && !evolutionPlanLower.includes('scientific') && 
          !evolutionPlanLower.includes('sin') && !evolutionPlanLower.includes('cos')) {
        findings.push({
          type: 'goal_gap',
          description: 'Goal requires scientific functions, but evolution may not have added them',
          severity: 'high',
          suggestedFix: {
            id: `fix-${Date.now()}-scientific`,
            description: 'Add scientific calculator functions (sin, cos, tan, log)',
            intentType: 'expand_features',
            estimatedImpact: 'high',
            requiresConfirmation: true,
            reasoning: 'Scientific functions are explicitly required by the project goal',
          },
        })
      }
    } catch (error: any) {
      console.warn('[CritiqueEngine] Failed to analyze goal alignment:', error)
    }

    return findings
  }

  /**
   * Calculate confidence in critique
   */
  private static calculateConfidence(
    findings: Finding[],
    hasRuntimeData: boolean
  ): number {
    if (findings.length === 0) {
      return 0.8 // High confidence if no issues found
    }

    let confidence = 0.5 // Base confidence

    // More findings = higher confidence (more evidence)
    if (findings.length >= 3) {
      confidence += 0.2
    }

    // Runtime data increases confidence
    if (hasRuntimeData) {
      confidence += 0.2
    }

    // High severity findings increase confidence
    const highSeverityCount = findings.filter(f => f.severity === 'high').length
    if (highSeverityCount > 0) {
      confidence += 0.1
    }

    return Math.min(1.0, Math.max(0.0, confidence))
  }

  /**
   * Generate summary of critique
   */
  private static generateSummary(
    findings: Finding[],
    activeGoal: { description: string } | null
  ): string {
    if (findings.length === 0) {
      return activeGoal
        ? `Evolution appears to have successfully advanced toward the goal: "${activeGoal.description}". No issues detected.`
        : 'Evolution completed successfully. No issues detected.'
    }

    const highSeverity = findings.filter(f => f.severity === 'high').length
    const mediumSeverity = findings.filter(f => f.severity === 'medium').length
    const lowSeverity = findings.filter(f => f.severity === 'low').length

    const parts: string[] = []
    parts.push(`Found ${findings.length} issue(s)`)
    if (highSeverity > 0) parts.push(`${highSeverity} high priority`)
    if (mediumSeverity > 0) parts.push(`${mediumSeverity} medium priority`)
    if (lowSeverity > 0) parts.push(`${lowSeverity} low priority`)

    return parts.join(', ') + '.'
  }

  /**
   * Get project files
   */
  private static async getProjectFiles(rootPath: string): Promise<string[]> {
    const files: string[] = []
    
    try {
      await this.scanDirectory(rootPath, files, rootPath)
    } catch (error: any) {
      console.warn('[CritiqueEngine] Failed to scan project files:', error)
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
