/**
 * PHASE 2: Agent Execution API Route
 * 
 * HARDENED CONTRACT:
 * - REQUIRES: projectId, sessionId, executionIntent
 * - REJECTS: raw prompt execution
 * - FAILS LOUDLY: Clear error messages on invalid input
 * 
 * ARCHITECTURE:
 * - Routes by executionIntent.type
 * - Uses AgentSessionManager for session authority
 * - Streams structured execution events
 */

import { NextRequest, NextResponse } from 'next/server'
import { join } from 'path'
import { promises as fs } from 'fs'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'
import { getAgentExecutionRouter } from '@/core/agent/AgentExecutionRouter'
import { getAgentSessionManager } from '@/lib/agent/AgentSessionManager'
import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'
import { IntentBuilder } from '@/lib/ide/IntentBuilder'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, sessionId, executionIntent, domain } = body

    // PHASE 2: STRICT VALIDATION - Reject requests missing required fields
    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    if (!executionIntent) {
      return NextResponse.json(
        { error: 'Execution intent is required. Raw prompt execution is no longer supported.' },
        { status: 400 }
      )
    }

    // PHASE 2: Validate execution intent structure
    const validation = IntentBuilder.validate(executionIntent)
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Invalid execution intent: ${validation.error}` },
        { status: 400 }
      )
    }

    // PHASE 2: Default domain if not provided (for backward compatibility during transition)
    const sessionDomain = domain || 'app-generator'

    // PHASE 2: Get or create session
    const sessionManager = getAgentSessionManager()
    const session = sessionManager.getOrCreateSession(sessionId, projectId, sessionDomain)
    
    // PHASE 2: Update session intent
    sessionManager.updateIntent(sessionId, projectId, sessionDomain, executionIntent)

    // PHASE 2: Auto-initialize workspace if not registered
    let workspace
    let rootPath
    
    try {
      workspace = WorkspaceRegistry.get(projectId)
      rootPath = WorkspaceRegistry.getRootPath(projectId)
    } catch (error: any) {
      // Workspace not registered - auto-initialize it
      console.log('[api/agent/execute] Workspace not registered, initializing...', projectId)
      
      try {
        const { default: fs } = await import('fs/promises')
        const { join } = await import('path')
        
        rootPath = join(process.cwd(), 'runtime-projects', projectId)
        await fs.mkdir(rootPath, { recursive: true })
        
        workspace = WorkspaceRegistry.register(projectId, rootPath)
        console.log('[api/agent/execute] Workspace auto-initialized:', { projectId, rootPath })
      } catch (initError: any) {
        console.error('[api/agent/execute] Failed to auto-initialize workspace:', initError)
        return NextResponse.json(
          { 
            error: `Failed to initialize workspace for projectId: ${projectId}. ${initError.message}`,
            details: initError.message
          },
          { status: 500 }
        )
      }
    }

    if (!workspace) {
      return NextResponse.json(
        { 
          error: `Workspace not found for projectId: ${projectId}. Call /api/workspace/init first.`
        },
        { status: 400 }
      )
    }

    if (!rootPath) {
      return NextResponse.json(
        { 
          error: `Workspace root path not found for projectId: ${projectId}.`
        },
        { status: 400 }
      )
    }

    console.log('[api/agent/execute] Execution context:', {
      projectId,
      sessionId,
      intentType: executionIntent.type,
      rootPath,
      workspaceRegistered: true,
    })

    // PHASE 7: Create readable stream for SSE with batching optimization
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let eventBuffer: Array<{ type: string; payload: any }> = []
        let flushTimer: NodeJS.Timeout | null = null

        // PHASE 7: Batch events for faster rendering (flush every 50ms or when buffer reaches 5 events)
        const flushEvents = () => {
          if (eventBuffer.length === 0) return
          
          // Send batched events
          for (const event of eventBuffer) {
            const data = JSON.stringify(event)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
          eventBuffer = []
          
          if (flushTimer) {
            clearTimeout(flushTimer)
            flushTimer = null
          }
        }

        const sendEvent = (event: { type: string; payload: any }) => {
          // PHASE 7: Filter out noisy events
          const noisyEvents = ['EDITOR_CURSOR_MOVED', 'CURSOR_IDLE']
          if (noisyEvents.includes(event.type)) {
            return // Skip noisy events
          }

          eventBuffer.push(event)
          
          // Flush immediately if buffer is full or for critical events
          const criticalEvents = ['AGENT_ERROR', 'AGENT_DONE', 'FILE_CHANGED', 'RUNTIME_EVENT']
          if (eventBuffer.length >= 5 || criticalEvents.includes(event.type)) {
            flushEvents()
          } else {
            // Schedule flush after 50ms
            if (!flushTimer) {
              flushTimer = setTimeout(flushEvents, 50)
            }
          }
        }

        try {
          const router = getAgentExecutionRouter()

          // PHASE 2: Route by executionIntent.type (not prompt)
          await router.run(
            {
              executionIntent,
              workspace,
              projectId,
              rootPath,
              agentSession: session,
            },
            (event) => {
              sendEvent(event)
            }
          )

          // PHASE 7: Flush any remaining events before closing
          flushEvents()
          
          // Stream complete
          controller.close()
        } catch (error: any) {
          // Flush buffer before sending error
          flushEvents()
          
          // Provide detailed error message
          let errorMessage = error.message || 'Execution failed'
          
          // Add context for common errors
          if (error.message?.includes('Workspace not initialized')) {
            errorMessage = 'Workspace not initialized. Please refresh the page.'
          } else if (error.message?.includes('empty')) {
            errorMessage = `${error.message}. Use "Generate" to create a starter project first.`
          } else if (error.message?.includes('Invalid execution intent')) {
            errorMessage = `${error.message}. Please choose an action (Generate / Run / Fix / Explain).`
          }
          
          sendEvent({
            type: 'EXECUTION_ERROR',
            payload: { error: errorMessage },
          })
          flushEvents()
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

