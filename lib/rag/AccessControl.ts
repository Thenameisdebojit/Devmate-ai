import { connectDB } from '@/lib/mongodb'
import Group from '@/models/Group'
import RAGAsset from '@/models/RAGAsset'

/**
 * Access control middleware for RAG assets
 */
export class AccessControl {
  /**
   * Get all group IDs a user belongs to
   */
  async getUserGroups(userId: string): Promise<string[]> {
    try {
      await connectDB()
      
      const groups = await Group.find({
        $or: [
          { 'members.userId': userId },
          { isPublic: true }, // Public groups are accessible to all
        ],
      })

      return groups.map(g => String(g._id))
    } catch (error: any) {
      console.error('[AccessControl] Error getting user groups:', error)
      return []
    }
  }

  /**
   * Check if user can access a specific asset
   */
  async canAccessAsset(
    userId: string,
    assetId: string,
    userRole: 'base_user' | 'super_user' | 'admin'
  ): Promise<boolean> {
    try {
      await connectDB()

      // Admins can access everything
      if (userRole === 'admin') {
        return true
      }

      // Get asset
      const asset = await RAGAsset.findOne({ assetId })
      if (!asset) {
        return false
      }

      // Super users can access their own assets + public assets
      if (userRole === 'super_user') {
        return asset.userId === userId || asset.groupIds.length === 0
      }

      // Base users can only access assets from their groups or public assets
      if (asset.groupIds.length === 0) {
        return true // Public asset
      }

      // Check if user belongs to any of the asset's groups
      const userGroupIds = await this.getUserGroups(userId)
      return asset.groupIds.some(groupId => userGroupIds.includes(groupId))
    } catch (error: any) {
      console.error('[AccessControl] Error checking asset access:', error)
      return false
    }
  }

  /**
   * Filter assets by access control
   */
  async filterByAccess(
    assets: Array<{ assetId: string; userId: string; groupIds: string[] }>,
    userId: string,
    userRole: 'base_user' | 'super_user' | 'admin'
  ): Promise<Array<{ assetId: string; userId: string; groupIds: string[] }>> {
    if (userRole === 'admin') {
      return assets // Admins can see everything
    }

    const userGroupIds = await this.getUserGroups(userId)
    const accessibleAssets: Array<{ assetId: string; userId: string; groupIds: string[] }> = []

    for (const asset of assets) {
      // Super users can see their own assets + public assets
      if (userRole === 'super_user') {
        if (asset.userId === userId || asset.groupIds.length === 0) {
          accessibleAssets.push(asset)
        }
      } else {
        // Base users can only see assets from their groups or public assets
        if (asset.groupIds.length === 0 || asset.groupIds.some(gid => userGroupIds.includes(gid))) {
          accessibleAssets.push(asset)
        }
      }
    }

    return accessibleAssets
  }
}
