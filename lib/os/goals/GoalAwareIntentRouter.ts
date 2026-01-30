/**
 * PHASE F′-5: Goal-Aware Intent Router
 * 
 * Attaches goal context to AI requests and rewrites system prompts
 * to include active goals, completed goals, and pending goals.
 * Never bypasses role or stage constraints.
 */

import { GoalResolver } from './GoalResolver'
import type { ProjectGoal } from './GoalMemoryStore'
import type { AIRole } from '../ProjectEvolutionEngine'

/**
 * Goal context for AI prompts
 */
export interface GoalContext {
  activeGoal: ProjectGoal | null
  completedGoals: ProjectGoal[]
  pendingGoals: ProjectGoal[]
}

/**
 * Goal-Aware Intent Router
 * 
 * Enhances AI system prompts with goal context.
 */
export class GoalAwareIntentRouter {
  /**
   * Get goal context for a project
   */
  static async getGoalContext(projectId: string): Promise<GoalContext> {
    const activeGoal = await GoalResolver.getActiveGoal(projectId)
    const completedGoals = await GoalResolver.getCompletedGoals(projectId)
    const activeGoals = await GoalResolver.getActiveGoals(projectId)
    
    // Pending goals are active goals that are not the primary active goal
    const pendingGoals = activeGoals.filter(g => g.id !== activeGoal?.id)

    return {
      activeGoal,
      completedGoals,
      pendingGoals,
    }
  }

  /**
   * Enhance system prompt with goal context
   * 
   * Adds goal information to the system prompt without modifying
   * role-specific prompts or stage constraints.
   */
  static enhanceSystemPromptWithGoals(
    baseSystemPrompt: string,
    goalContext: GoalContext,
    aiRole: AIRole
  ): string {
    // Don't add goal context for observer role (read-only)
    if (aiRole === 'observer') {
      return baseSystemPrompt
    }

    const goalSection = this.buildGoalSection(goalContext)
    
    if (!goalSection) {
      // No goals - return base prompt
      return baseSystemPrompt
    }

    // Inject goal context at the beginning of the prompt
    // This ensures goals are considered before role-specific instructions
    return `${goalSection}\n\n${baseSystemPrompt}`
  }

  /**
   * Build goal section for system prompt
   */
  private static buildGoalSection(context: GoalContext): string | null {
    const sections: string[] = []

    if (context.activeGoal) {
      sections.push(`PROJECT GOAL:\nYou are building: "${context.activeGoal.description}"`)
      sections.push(`\nACTIVE GOAL:\n- ${context.activeGoal.description} (Priority: ${context.activeGoal.priority})`)
      sections.push(`\nYour response must advance the ACTIVE GOAL only.`)
    } else {
      // No active goal - suggest user define one
      sections.push(`PROJECT GOAL:\nNo active goal is set for this project.`)
      sections.push(`\nBefore making changes, ask the user to define a project goal.`)
      sections.push(`Do NOT execute changes without a clear goal.`)
    }

    if (context.completedGoals.length > 0) {
      sections.push(`\n\nCOMPLETED GOALS:`)
      context.completedGoals.slice(0, 5).forEach(goal => {
        sections.push(`- ${goal.description}`)
      })
    }

    if (context.pendingGoals.length > 0) {
      sections.push(`\n\nPENDING GOALS (will be addressed after active goal):`)
      context.pendingGoals.slice(0, 3).forEach(goal => {
        sections.push(`- ${goal.description} (Priority: ${goal.priority})`)
      })
    }

    return sections.join('\n')
  }

  /**
   * Validate that an AI response aligns with the active goal
   * 
   * Returns true if response is aligned, false otherwise.
   */
  static validateResponseAlignment(
    response: string,
    goalContext: GoalContext
  ): { aligned: boolean; reason?: string } {
    if (!goalContext.activeGoal) {
      // No active goal - allow response but suggest goal definition
      return { aligned: true }
    }

    const lowerResponse = response.toLowerCase()
    const goalKeywords = this.extractKeywords(goalContext.activeGoal.description)

    // Check if response mentions goal-related terms
    const hasGoalKeywords = goalKeywords.some(keyword => 
      lowerResponse.includes(keyword)
    )

    // Check if response explicitly mentions the goal
    const mentionsGoal = lowerResponse.includes(
      goalContext.activeGoal.description.toLowerCase().substring(0, 20)
    )

    if (hasGoalKeywords || mentionsGoal) {
      return { aligned: true }
    }

    // Check if response is about something completely unrelated
    const unrelatedPatterns = [
      /create.*new.*project/i,
      /start.*from.*scratch/i,
      /completely.*different/i,
    ]

    const isUnrelated = unrelatedPatterns.some(pattern => pattern.test(response))

    if (isUnrelated) {
      return {
        aligned: false,
        reason: `Response does not align with active goal: "${goalContext.activeGoal.description}". Please focus on the active goal.`,
      }
    }

    // Default: allow but warn
    return { aligned: true }
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
