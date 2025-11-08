import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import SharedChat from '@/models/SharedChat'
import { nanoid } from 'nanoid'

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const decoded = await verifyToken(token)
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }
    const userId = decoded.userId

    const { title, messages, chatId } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json(
        { error: 'No messages to share' },
        { status: 400 }
      )
    }

    await connectDB()

    const shareId = nanoid(10)

    const sharedChat = await SharedChat.create({
      shareId,
      chatId: chatId || null,
      title: title || 'Shared Conversation',
      messages,
      userId,
      isPublic: true,
    })

    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/share/${shareId}`

    return NextResponse.json({
      success: true,
      shareId,
      shareUrl,
      sharedChat,
    })
  } catch (error) {
    console.error('Share error:', error)
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const shareId = req.nextUrl.searchParams.get('shareId')

    if (!shareId) {
      return NextResponse.json(
        { error: 'Share ID is required' },
        { status: 400 }
      )
    }

    await connectDB()

    const sharedChat = await SharedChat.findOne({ shareId })

    if (!sharedChat) {
      return NextResponse.json(
        { error: 'Shared chat not found' },
        { status: 404 }
      )
    }

    sharedChat.viewCount += 1
    await sharedChat.save()

    return NextResponse.json({
      success: true,
      sharedChat,
    })
  } catch (error) {
    console.error('Get shared chat error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve shared chat' },
      { status: 500 }
    )
  }
}
