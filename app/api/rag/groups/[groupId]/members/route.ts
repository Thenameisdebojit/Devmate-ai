import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * POST /api/rag/groups/[groupId]/members
 * Add a member to a group
 * Auth: Super users only (group admins)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()
    const User = (await import('@/models/User')).default
    const user = await User.findById(currentUser.userId)
    
    if (!user || (user.role !== 'super_user' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only super users can manage group members' },
        { status: 403 }
      )
    }

    const { userId, role } = await req.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const Group = (await import('@/models/Group')).default
    const group = await Group.findById(params.groupId)

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if user is group admin
    const isAdmin = user.role === 'admin' || 
                    group.createdBy === String(user._id) ||
                    group.members.some((m: any) => m.userId === String(user._id) && m.role === 'admin')

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only group admins can add members' },
        { status: 403 }
      )
    }

    // Check if user is already a member
    const existingMember = group.members.find((m: any) => m.userId === userId)
    if (existingMember) {
      return NextResponse.json(
        { error: 'User is already a member of this group' },
        { status: 409 }
      )
    }

    // Add member
    group.members.push({
      userId,
      role: role || 'member',
      joinedAt: new Date(),
    })

    await group.save()

    return NextResponse.json({
      success: true,
      message: 'Member added successfully',
      group: {
        id: String(group._id),
        members: group.members,
      },
    })
  } catch (error: any) {
    console.error('[RAG-Groups-Members] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add member' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rag/groups/[groupId]/members?userId=xxx
 * Remove a member from a group
 * Auth: Super users only (group admins)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()
    const User = (await import('@/models/User')).default
    const user = await User.findById(currentUser.userId)
    
    if (!user || (user.role !== 'super_user' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only super users can manage group members' },
        { status: 403 }
      )
    }

    const Group = (await import('@/models/Group')).default
    const group = await Group.findById(params.groupId)

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if user is group admin
    const isAdmin = user.role === 'admin' || 
                    group.createdBy === String(user._id) ||
                    group.members.some((m: any) => m.userId === String(user._id) && m.role === 'admin')

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only group admins can remove members' },
        { status: 403 }
      )
    }

    // Remove member (cannot remove creator)
    if (group.createdBy === userId) {
      return NextResponse.json(
        { error: 'Cannot remove group creator' },
        { status: 400 }
      )
    }

    group.members = group.members.filter((m: any) => m.userId !== userId)
    await group.save()

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
      group: {
        id: String(group._id),
        members: group.members,
      },
    })
  } catch (error: any) {
    console.error('[RAG-Groups-Members] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to remove member' },
      { status: 500 }
    )
  }
}
