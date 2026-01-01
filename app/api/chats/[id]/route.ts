import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Chat from '@/models/Chat'
import { getCurrentUser } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { id } = await params
    await connectDB()

    const chat = await Chat.findOne({
      _id: id,
      userId: currentUser.userId,
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ chat })
  } catch (error: any) {
    console.error('Get chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get chat' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { id } = await params
    await connectDB()

    const chat = await Chat.findOneAndDelete({
      _id: id,
      userId: currentUser.userId,
    })

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete chat' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { id } = await params
    const { messages, domain } = await req.json()

    await connectDB()

    const updateData: any = { messages }
    if (domain) {
      updateData.domain = domain
    }

    const chat = await Chat.findOneAndUpdate(
      {
        _id: id,
        userId: currentUser.userId,
      },
      updateData,
      { new: true }
    )

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ chat })
  } catch (error: any) {
    console.error('Update chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update chat' },
      { status: 500 }
    )
  }
}
