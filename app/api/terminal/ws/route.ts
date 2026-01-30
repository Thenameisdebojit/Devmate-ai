/**
 * WebSocket Terminal API Route
 * 
 * Handles WebSocket connections for terminal communication.
 * Upgrades HTTP connections to WebSocket for bidirectional terminal I/O.
 * 
 * NOTE: Next.js doesn't natively support WebSocket in API routes.
 * This route handles the upgrade request and delegates to the WebSocket server.
 * For production, you may need a separate WebSocket server or use a service like Pusher.
 */

import { NextRequest } from 'next/server'
import { getWebSocketTerminalServer } from '@/lib/terminal/WebSocketTerminalServer'
import { WebSocket } from 'ws'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Handle WebSocket upgrade request
 * 
 * In Next.js, we need to handle this differently since API routes
 * don't support WebSocket upgrades directly. This implementation
 * works with a standalone WebSocket server or can be adapted
 * for services like Pusher, Socket.io, or a separate WebSocket server.
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return new Response('Project ID is required', { status: 400 })
  }

  // Check if this is a WebSocket upgrade request
  const upgradeHeader = req.headers.get('upgrade')
  if (upgradeHeader !== 'websocket') {
    return new Response('WebSocket upgrade required', { status: 426 })
  }

  // For Next.js, we need to return a response that indicates
  // WebSocket support. In practice, you'll need to:
  // 1. Use a separate WebSocket server (recommended)
  // 2. Use a service like Pusher/Socket.io
  // 3. Use Next.js middleware with a custom server

  // This is a placeholder that returns the WebSocket server URL
  // In production, you should set up a separate WebSocket server
  const wsUrl = process.env.WEBSOCKET_SERVER_URL || `ws://localhost:${process.env.WS_PORT || 5001}`
  
  return new Response(
    JSON.stringify({
      wsUrl: `${wsUrl}/terminal?projectId=${projectId}`,
      message: 'WebSocket connection required. Connect to the provided URL.',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * POST: Create terminal session (fallback for non-WebSocket clients)
 */
export async function POST(req: NextRequest) {
  try {
    const { projectId, options } = await req.json()

    if (!projectId) {
      return new Response(
        JSON.stringify({ error: 'Project ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Return WebSocket connection info
    const wsUrl = process.env.WEBSOCKET_SERVER_URL || `ws://localhost:${process.env.WS_PORT || 5001}`
    
    return new Response(
      JSON.stringify({
        wsUrl: `${wsUrl}/terminal?projectId=${projectId}`,
        sessionId: null, // Will be created on WebSocket connection
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create terminal session' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
