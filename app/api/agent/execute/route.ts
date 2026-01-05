/**
 * Agent Execution API Route
 * 
 * Orchestrates agent execution by routing prompts to appropriate handlers.
 * 
 * ARCHITECTURE:
 * - Routes empty workspace → GenerationController (via /api/generate-app)
 * - Routes existing workspace → AgentPlanExecutor (for mutations)
 * - Auto-starts runtime after successful generation/mutation
 * - Streams execution events to client
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { promises as fs } from 'fs'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { getAgentExecutionRouter } from '@/core/agent/AgentExecutionRouter'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const { prompt, projectId } = await req.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    // STRICT: Resolve workspace ONLY via WorkspaceRegistry.get(projectId)
    // If missing → return 400 with clear error
    let workspace
    let rootPath
    let fileCount = 0
    
    try {
      workspace = WorkspaceRegistry.get(projectId)
      rootPath = WorkspaceRegistry.getRootPath(projectId)
      
      // Count files in workspace (server-side only)
      try {
        const entries = await fs.readdir(rootPath, { withFileTypes: true })
        fileCount = entries.filter(
          (entry) => entry.isFile() && !entry.name.startsWith('.')
        ).length
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          fileCount = 0
        } else {
          throw error
        }
      }
    } catch (error: any) {
      console.error('[api/agent/execute] Workspace not registered:', error.message)
      return NextResponse.json(
        { 
          error: `Workspace not initialized for projectId: ${projectId}. Call /api/workspace/init first.`,
          details: error.message
        },
        { status: 400 }
      )
    }

    console.log('[api/agent/execute] Workspace state:', {
      projectId,
      rootPath,
      fileCount,
      workspaceRegistered: true,
    })

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendEvent = (event: { type: string; payload: any }) => {
          const data = JSON.stringify(event)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }

        try {
          const router = getAgentExecutionRouter()

          // Route the prompt with workspace from registry
          await router.run(
            {
              prompt,
              workspace,
              projectId,
              rootPath,
            },
            (event) => {
              sendEvent(event)
            }
          )

          // Stream complete
          controller.close()
        } catch (error: any) {
          sendEvent({
            type: 'EXECUTION_ERROR',
            payload: { error: error.message || 'Execution failed' },
          })
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error: any) {
    console.error('Agent execution error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute agent' },
      { status: 500 }
    )
  }
}

