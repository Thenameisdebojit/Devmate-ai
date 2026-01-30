/**
 * PHASE F′-4: Evolution Confirmation API
 * 
 * Confirms and executes a pending evolution plan.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPendingEvolutionStore } from '@/lib/os/evolution/PendingEvolutionStore'
import { EvolutionExecutor } from '@/lib/os/evolution/EvolutionExecutor'
import { getProjectEvolutionEngineManager } from '@/lib/os/ProjectEvolutionEngineManager'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export const runtime = 'nodejs'
export const maxDuration = 600 // 10 minutes for evolution execution

export async function POST(req: NextRequest) {
  try {
    const { evolutionId, projectId } = await req.json()

    if (!evolutionId) {
      return NextResponse.json(
        { error: 'Evolution ID is required' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    const store = getPendingEvolutionStore()
    const evolution = store.getById(evolutionId)

    if (!evolution) {
      return NextResponse.json(
        { error: `Evolution ${evolutionId} not found` },
        { status: 404 }
      )
    }

    if (evolution.projectId !== projectId) {
      return NextResponse.json(
        { error: 'Evolution does not belong to this project' },
        { status: 403 }
      )
    }

    if (evolution.status !== 'awaiting_confirmation') {
      return NextResponse.json(
        { error: `Evolution is not awaiting confirmation (status: ${evolution.status})` },
        { status: 400 }
      )
    }

    // Confirm evolution
    const confirmed = store.confirm(evolutionId)

    // Transition project to evolving stage
    const rootPath = await WorkspaceRegistry.getRootPath(projectId)
    if (!rootPath) {
      return NextResponse.json(
        { error: 'Project root path not found' },
        { status: 500 }
      )
    }

    const peeManager = getProjectEvolutionEngineManager()
    await peeManager.getEngine(projectId, rootPath) // Ensure engine exists
    // PHASE A: Transition via Manager to persist to disk
    await peeManager.setStage(projectId, 'evolving', 'evolution')

    // Execute evolution
    const result = await EvolutionExecutor.execute(evolutionId, (step, total, message) => {
      // Progress callback - could be used for SSE streaming in the future
      console.log(`[EvolutionExecutor] Step ${step}/${total}: ${message}`)
    })

    if (result.success) {
      // PHASE F′-6: Format planning cycle message
      let planningMessage = null
      if (result.planningCycle) {
        try {
          const { formatPlanningCycleAsMessage, formatPlanningCycleMetadata } = await import('@/lib/os/planning/PlanningFormatter')
          planningMessage = {
            content: formatPlanningCycleAsMessage(result.planningCycle),
            metadata: formatPlanningCycleMetadata(result.planningCycle),
          }
        } catch (error: any) {
          console.warn('[evolution/confirm] Failed to format planning cycle:', error)
        }
      }

      // PHASE F′-7: Format critique report message
      let critiqueMessage = null
      if (result.critiqueReport) {
        try {
          const { formatCritiqueReportAsMessage, formatCritiqueReportMetadata } = await import('@/lib/os/critique/CritiqueFormatter')
          critiqueMessage = {
            content: formatCritiqueReportAsMessage(result.critiqueReport),
            metadata: formatCritiqueReportMetadata(result.critiqueReport),
          }
        } catch (error: any) {
          console.warn('[evolution/confirm] Failed to format critique report:', error)
        }
      }

      // PHASE F′-9: Format thread proposal message if available
      let threadProposalMessage = null
      if (result.threadProposal) {
        threadProposalMessage = {
          content: result.threadProposal.message,
          metadata: {
            type: 'thread_continuation',
            goalNodeId: result.threadProposal.goalNodeId,
            goalNodeDescription: result.threadProposal.goalNodeDescription,
            plannedStep: result.threadProposal.plannedStep,
          },
        }
      }

      return NextResponse.json({
        success: true,
        evolutionId: result.evolutionId,
        stepsCompleted: result.stepsCompleted,
        totalSteps: result.totalSteps,
        filesChanged: result.filesChanged,
        checkpointId: result.checkpointId,
        message: 'Evolution completed successfully. Project is now stable and editable.',
        planningCycle: result.planningCycle, // PHASE F′-6: Include planning cycle in response
        planningMessage, // PHASE F′-6: Include formatted planning message
        critiqueReport: result.critiqueReport, // PHASE F′-7: Include critique report in response
        critiqueMessage, // PHASE F′-7: Include formatted critique message
        threadProposal: result.threadProposal, // PHASE F′-9: Include thread continuation proposal
        threadProposalMessage, // PHASE F′-9: Include formatted thread proposal message
      })
    } else {
      return NextResponse.json({
        success: false,
        evolutionId: result.evolutionId,
        stepsCompleted: result.stepsCompleted,
        totalSteps: result.totalSteps,
        error: result.error,
        message: 'Evolution failed and was rolled back. Project is stable and editable.',
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('[evolution/confirm] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to confirm and execute evolution' },
      { status: 500 }
    )
  }
}
