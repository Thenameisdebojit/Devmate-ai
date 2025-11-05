import { NextResponse } from 'next/server'

export async function GET() {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'Service unavailable: API key not configured' },
      { status: 503 }
    )
  }
  
  return NextResponse.json({ status: 'ok' })
}
