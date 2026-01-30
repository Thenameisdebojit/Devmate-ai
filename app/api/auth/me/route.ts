import { NextResponse } from 'next/server'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Auth check timeout')), 3000)
    )
    
    const authCheck = async () => {
      const currentUser = await getCurrentUser()
      
      if (!currentUser) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        )
      }

      // Try to connect to DB with timeout
      try {
        await Promise.race([
          connectDB(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB connection timeout')), 2000))
        ])
      } catch (dbError: any) {
        console.warn('DB connection failed or timed out, proceeding without DB:', dbError.message)
        // Return user info from session even if DB is unavailable
      return NextResponse.json({
        user: {
          id: currentUser.userId,
          name: currentUser.name || 'User',
          email: currentUser.email || '',
          avatar: currentUser.avatar,
          role: 'base_user', // Default if DB unavailable
        },
      })
      }

      const user = await User.findById(currentUser.userId)
      if (!user) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role || 'base_user',
        },
      })
    }
    
    return await Promise.race([authCheck(), timeoutPromise]) as NextResponse
  } catch (error: any) {
    console.error('Get user error:', error)
    // Return 401 on timeout so client knows to proceed as unauthenticated
    if (error.message?.includes('timeout')) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { error: error.message || 'Failed to get user' },
      { status: 500 }
    )
  }
}
