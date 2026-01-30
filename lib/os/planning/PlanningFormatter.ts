/**
 * PHASE F′-6: Planning Formatter
 * 
 * Formats planning cycles into user-friendly messages.
 */

import type { PlanningCycle, PlannedStep } from './PlanningEngine'

/**
 * Format planning cycle as ASSISTANT_MESSAGE content
 */
export function formatPlanningCycleAsMessage(cycle: PlanningCycle): string {
  const { proposedNextSteps, currentStateSummary, confidence, goalId } = cycle

  if (proposedNextSteps.length === 0) {
    return 'No next steps suggested at this time. The project may be complete or needs more context.'
  }

  // Build message
  const parts: string[] = []

  parts.push('**Next Steps Toward Your Goal:**\n')
  parts.push(`Current state: ${currentStateSummary}\n`)

  // List suggested steps
  proposedNextSteps.forEach((step, index) => {
    const impactEmoji = step.estimatedImpact === 'high' ? '🔴' : step.estimatedImpact === 'medium' ? '🟡' : '🟢'
    parts.push(`${index + 1}. ${impactEmoji} **${step.description}**`)
    if (step.reasoning) {
      parts.push(`   *${step.reasoning}*`)
    }
  })

  // Add confidence indicator
  if (confidence < 0.6) {
    parts.push(`\n*Note: Confidence is moderate. You may want to refine the goal or provide more context.*`)
  }

  parts.push(`\n**Which step should I take next?**`)

  return parts.join('\n')
}

/**
 * Format planning cycle metadata for ASSISTANT_MESSAGE
 */
export function formatPlanningCycleMetadata(cycle: PlanningCycle): Record<string, any> {
  return {
    type: 'planning_suggestions',
    planningCycleId: `${cycle.projectId}-${cycle.createdAt}`,
    goalId: cycle.goalId,
    stepCount: cycle.proposedNextSteps.length,
    confidence: cycle.confidence,
    steps: cycle.proposedNextSteps.map(step => ({
      id: step.id,
      description: step.description,
      intentType: step.intentType,
      estimatedImpact: step.estimatedImpact,
    })),
  }
}
