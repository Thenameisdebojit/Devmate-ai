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

    // PHASE C: Reject empty generate intents - these are handled by UI-level bootstrap
    if (executionIntent.type === 'generate') {
      const isEmptyIntent = (executionIntent as any).isEmptyIntent === true
      
      // Check if workspace is empty
      let fileCount = 0
      try {
        const { BootstrapGenerator } = await import('@/lib/bootstrap/BootstrapGenerator')
        const rootPath = await WorkspaceRegistry.getRootPath(projectId)
        fileCount = await BootstrapGenerator.getFileCount(rootPath)
      } catch (error) {
        // If workspace not registered, assume empty
        fileCount = 0
      }

      if (isEmptyIntent || fileCount === 0) {
        return NextResponse.json(
          { error: 'Project creation is handled by the IDE, not the agent. Use the UI to create a new project.' },
          { status: 400 }
        )
      }
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
      workspace = await WorkspaceRegistry.get(projectId)
      rootPath = await WorkspaceRegistry.getRootPath(projectId)
      // PHASE E: Invariant check
      if (!rootPath) {
        throw new Error(`Invariant violation: rootPath is missing for projectId: ${projectId}`)
      }
    } catch (error: any) {
      // Workspace not registered - auto-initialize it
      console.log('[api/agent/execute] Workspace not registered, initializing...', projectId)
      
      try {
        const { default: fs } = await import('fs/promises')
        const { join } = await import('path')
        
        // PHASE F: Use ProjectRootManager for persistent roots
        const { getProjectRootManager } = await import('@/lib/workspace/ProjectRootManager')
        const rootManager = getProjectRootManager()
        rootPath = await rootManager.getProjectRoot(projectId)
        
        workspace = await WorkspaceRegistry.register(projectId, rootPath)
        // PHASE E: Verify registration succeeded
        if (!workspace) {
          throw new Error(`Invariant violation: Workspace registration failed for projectId: ${projectId}, rootPath: ${rootPath}`)
        }
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

          // PHASE E: Prevent duplicate AGENT_DONE and ASSISTANT_MESSAGE events
          const eventId = `${event.type}-${JSON.stringify(event.payload)}`
          if (sentEventIds.has(eventId)) {
            console.warn(`[SSE] Duplicate event prevented: ${event.type}`, { projectId, sessionId })
            return
          }
          sentEventIds.add(eventId)

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
        
        // PHASE E: Track sent events to prevent duplicates
        const sentEventIds = new Set<string>()

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
          
          // PHASE E: Provide detailed error message with context (dev-readable, user-friendly)
          let errorMessage = error.message || 'Execution failed'
          
          // Add context for common errors (user-friendly)
          if (error.message?.includes('Workspace not initialized')) {
            errorMessage = 'Workspace not initialized. Please refresh the page.'
          } else if (error.message?.includes('empty')) {
            errorMessage = `${error.message}. Use "Generate" to create a starter project first.`
          } else if (error.message?.includes('Invalid execution intent')) {
            errorMessage = `${error.message}. Please choose an action (Generate / Run / Fix / Explain).`
          }
          
          // PHASE E: Log detailed error context (dev-only, not user-visible)
          console.error('[EXECUTION_ERROR]', {
            projectId,
            sessionId,
            intentType: executionIntent?.type,
            rootPath,
            error: error.message,
            stack: error.stack,
          })
          
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

