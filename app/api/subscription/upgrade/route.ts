import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { plan } = await req.json()

    if (!['pro', 'pro_plus'].includes(plan)) {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      )
    }

    await connectDB()

    const user = await User.findById(currentUser.userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const monthlyGenerations = plan === 'pro_plus' ? -1 : plan === 'pro' ? 100 : 10

    const updatedUser = await User.findByIdAndUpdate(
      currentUser.userId,
      {
        subscription: {
          plan,
          status: 'active',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        usageQuota: {
          monthlyGenerations,
          usedGenerations: 0,
          resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
      { new: true }
    )

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${plan === 'pro_plus' ? 'Pro Plus' : 'Pro'}!`,
      subscription: updatedUser.subscription,
      usageQuota: updatedUser.usageQuota,
    })
  } catch (error: any) {
    console.error('Upgrade error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upgrade subscription' },
      { status: 500 }
    )
  }
}
