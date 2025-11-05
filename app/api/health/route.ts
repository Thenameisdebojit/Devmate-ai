import { NextResponse } from 'next/server'

export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: 'Service unavailable: OpenAI API key not configured' },
      { status: 503 }
    )
  }
  
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: 'Service unavailable: MongoDB URI not configured' },
      { status: 503 }
    )
  }
  
  return NextResponse.json({ status: 'ok' })
}
