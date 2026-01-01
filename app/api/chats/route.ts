import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Chat from '@/models/Chat'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    await connectDB()

    const chats = await Chat.find({ userId: currentUser.userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('title domain createdAt updatedAt')

    return NextResponse.json({ chats })
  } catch (error: any) {
    console.error('Get chats error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get chats' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { title, messages, domain } = await req.json()

    if (!title || !messages) {
      return NextResponse.json(
        { error: 'Title and messages are required' },
        { status: 400 }
      )
    }

    await connectDB()

    const chat = await Chat.create({
      userId: currentUser.userId,
      title,
      messages,
      domain: domain || 'general',
    })

    return NextResponse.json({ chat }, { status: 201 })
  } catch (error: any) {
    console.error('Create chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create chat' },
      { status: 500 }
    )
  }
}
