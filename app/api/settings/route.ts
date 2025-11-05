import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import Settings from '@/models/Settings'
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

    let settings = await Settings.findOne({ userId: currentUser.userId })
    
    if (!settings) {
      settings = await Settings.create({
        userId: currentUser.userId,
        notifications: {
          email: true,
          push: false,
          updates: true
        },
        privacy: {
          dataCollection: false,
          analytics: true,
          shareData: false
        },
        accessibility: {
          fontSize: 'medium',
          highContrast: false
        }
      })
    }

    return NextResponse.json({
      settings: {
        notifications: settings.notifications,
        privacy: settings.privacy,
        accessibility: settings.accessibility
      }
    })
  } catch (error: any) {
    console.error('Get settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get settings' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { notifications, privacy, accessibility } = body

    await connectDB()

    const settings = await Settings.findOneAndUpdate(
      { userId: currentUser.userId },
      {
        notifications,
        privacy,
        accessibility
      },
      { new: true, upsert: true }
    )

    return NextResponse.json({
      settings: {
        notifications: settings.notifications,
        privacy: settings.privacy,
        accessibility: settings.accessibility
      }
    })
  } catch (error: any) {
    console.error('Update settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update settings' },
      { status: 500 }
    )
  }
}
