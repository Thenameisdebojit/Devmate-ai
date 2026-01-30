import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export const runtime = 'nodejs'

/**
 * GET /api/rag/groups
 * List user's groups
 * Auth: All authenticated users
 */
export async function GET(req: NextRequest) {
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
    const Group = (await import('@/models/Group')).default

    // Get groups user belongs to or created
    const groups = await Group.find({
      $or: [
        { 'members.userId': currentUser.userId },
        { createdBy: currentUser.userId },
        { isPublic: true },
      ],
    }).sort({ createdAt: -1 })

    return NextResponse.json({
      success: true,
      groups: groups.map(g => ({
        id: String(g._id),
        name: g.name,
        description: g.description,
        createdBy: g.createdBy,
        members: g.members,
        assetIds: g.assetIds,
        isPublic: g.isPublic,
        createdAt: g.createdAt.toISOString(),
      })),
      count: groups.length,
    })
  } catch (error: any) {
    console.error('[RAG-Groups] GET Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list groups' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/rag/groups
 * Create a new group
 * Auth: Super users only
 */
export async function POST(req: NextRequest) {
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
        { error: 'Only super users can create groups' },
        { status: 403 }
      )
    }

    const { name, description, isPublic } = await req.json()

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Group name is required' },
        { status: 400 }
      )
    }

    const Group = (await import('@/models/Group')).default

    // Check if group name already exists for this user
    const existingGroup = await Group.findOne({
      name: name.trim(),
      createdBy: String(user._id),
    })

    if (existingGroup) {
      return NextResponse.json(
        { error: 'Group with this name already exists' },
        { status: 409 }
      )
    }

    // Create group
    const group = await Group.create({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: String(user._id),
      members: [
        {
          userId: String(user._id),
          role: 'admin',
          joinedAt: new Date(),
        },
      ],
      assetIds: [],
      isPublic: isPublic || false,
    })

    return NextResponse.json({
      success: true,
      group: {
        id: String(group._id),
        name: group.name,
        description: group.description,
        createdBy: group.createdBy,
        members: group.members,
        assetIds: group.assetIds,
        isPublic: group.isPublic,
        createdAt: group.createdAt.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[RAG-Groups] POST Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create group' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/rag/groups
 * Update a group
 * Auth: Super users only (group admins)
 */
export async function PUT(req: NextRequest) {
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
        { error: 'Only super users can update groups' },
        { status: 403 }
      )
    }

    const { groupId, name, description, isPublic, assetIds } = await req.json()

    if (!groupId) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      )
    }

    const Group = (await import('@/models/Group')).default
    const group = await Group.findById(groupId)

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if user is group admin or creator
    const isAdmin = user.role === 'admin' || 
                    group.createdBy === String(user._id) ||
                    group.members.some((m: any) => m.userId === String(user._id) && m.role === 'admin')

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only group admins can update groups' },
        { status: 403 }
      )
    }

    // Update group
    if (name !== undefined) group.name = name.trim()
    if (description !== undefined) group.description = description?.trim() || ''
    if (isPublic !== undefined) group.isPublic = isPublic
    if (assetIds !== undefined) group.assetIds = assetIds

    await group.save()

    return NextResponse.json({
      success: true,
      group: {
        id: String(group._id),
        name: group.name,
        description: group.description,
        createdBy: group.createdBy,
        members: group.members,
        assetIds: group.assetIds,
        isPublic: group.isPublic,
        createdAt: group.createdAt.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('[RAG-Groups] PUT Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update group' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/rag/groups
 * Delete a group
 * Auth: Super users only (group creator or admin)
 */
export async function DELETE(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const groupId = searchParams.get('id')

    if (!groupId) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      )
    }

    const { connectDB } = await import('@/lib/mongodb')
    await connectDB()
    const User = (await import('@/models/User')).default
    const user = await User.findById(currentUser.userId)
    
    if (!user || (user.role !== 'super_user' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only super users can delete groups' },
        { status: 403 }
      )
    }

    const Group = (await import('@/models/Group')).default
    const group = await Group.findById(groupId)

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      )
    }

    // Check if user is group creator or admin
    const canDelete = user.role === 'admin' || group.createdBy === String(user._id)

    if (!canDelete) {
      return NextResponse.json(
        { error: 'Only group creators can delete groups' },
        { status: 403 }
      )
    }

    await Group.deleteOne({ _id: groupId })

    return NextResponse.json({
      success: true,
      message: 'Group deleted successfully',
    })
  } catch (error: any) {
    console.error('[RAG-Groups] DELETE Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete group' },
      { status: 500 }
    )
  }
}
