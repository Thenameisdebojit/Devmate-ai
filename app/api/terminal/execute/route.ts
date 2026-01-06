/**
 * Terminal Execute API Route
 * 
 * Executes a command in the terminal session
 */

import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const { projectId, command, cwd } = await req.json()

    if (!projectId || !command) {
      return NextResponse.json(
        { error: 'Project ID and command are required' },
        { status: 400 }
      )
    }

    // Send command to terminal session
    const response = await fetch(`${req.nextUrl.origin}/api/terminal/local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        input: command + '\r\n', // Add newline to execute
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to execute command')
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to execute command' },
      { status: 500 }
    )
  }
}
