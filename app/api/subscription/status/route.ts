import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

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

    const user = await User.findById(currentUser.userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const subscription = user.subscription || {
      plan: 'free',
      status: 'active',
    }

    const usageQuota = user.usageQuota || {
      monthlyGenerations: 10,
      usedGenerations: 0,
      resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }

    if (new Date() > usageQuota.resetDate) {
      const planLimit = subscription.plan === 'pro_plus' ? 999999 : subscription.plan === 'pro' ? 100 : 10
      usageQuota.usedGenerations = 0
      usageQuota.monthlyGenerations = planLimit
      usageQuota.resetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      user.usageQuota = usageQuota
      await user.save()
    }

    const remainingGenerations = subscription.plan === 'pro_plus' 
      ? 999999 
      : usageQuota.monthlyGenerations - usageQuota.usedGenerations

    return NextResponse.json({
      subscription,
      usageQuota,
      remainingGenerations,
      canGenerate: subscription.plan === 'pro_plus' || remainingGenerations > 0,
    })
  } catch (error: any) {
    console.error('Subscription status error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get subscription status' },
      { status: 500 }
    )
  }
}
