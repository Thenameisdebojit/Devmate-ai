'use client'

import { useState, useEffect } from 'react'
import { FiUsers, FiPlus, FiEdit2, FiTrash2, FiX, FiCheck, FiUserPlus } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface Group {
  id: string
  name: string
  description?: string
  createdBy: string
  members: Array<{
    userId: string
    role: 'member' | 'admin'
    joinedAt: string
  }>
  assetIds: string[]
  isPublic: boolean
  createdAt: string
}

interface GroupManagerProps {
  userId: string
  userRole?: 'base_user' | 'super_user' | 'admin'
}

export default function GroupManager({ userId, userRole }: GroupManagerProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
  })

  const isSuperUser = userRole === 'super_user' || userRole === 'admin'

  useEffect(() => {
    if (isSuperUser) {
      loadGroups()
    }
  }, [isSuperUser])

  const loadGroups = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/rag/groups')
      if (response.ok) {
        const data = await response.json()
        setGroups(data.groups || [])
      } else {
        toast.error('Failed to load groups')
      }
    } catch (error) {
      console.error('Failed to load groups:', error)
      toast.error('Failed to load groups')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Group name is required')
      return
    }

    try {
      const response = await fetch('/api/rag/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Group created successfully')
        setShowCreateModal(false)
        setFormData({ name: '', description: '', isPublic: false })
        loadGroups()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to create group')
      }
    } catch (error) {
      console.error('Create group error:', error)
      toast.error('Failed to create group')
    }
  }

  const handleUpdate = async () => {
    if (!editingGroup || !formData.name.trim()) {
      toast.error('Group name is required')
      return
    }

    try {
      const response = await fetch('/api/rag/groups', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: editingGroup.id,
          ...formData,
        }),
      })

      if (response.ok) {
        toast.success('Group updated successfully')
        setEditingGroup(null)
        setFormData({ name: '', description: '', isPublic: false })
        loadGroups()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update group')
      }
    } catch (error) {
      console.error('Update group error:', error)
      toast.error('Failed to update group')
    }
  }

  const handleDelete = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group? This will remove access for all members.')) {
      return
    }

    try {
      const response = await fetch(`/api/rag/groups?id=${groupId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Group deleted successfully')
        loadGroups()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete group')
      }
    } catch (error) {
      console.error('Delete group error:', error)
      toast.error('Failed to delete group')
    }
  }

  const openEditModal = (group: Group) => {
    setEditingGroup(group)
    setFormData({
      name: group.name,
      description: group.description || '',
      isPublic: group.isPublic,
    })
  }

  if (!isSuperUser) {
    return null
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FiUsers className="w-5 h-5" />
            Group Management
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage groups to control access to knowledge base assets
          </p>
        </div>
        <button
          onClick={() => {
            setEditingGroup(null)
            setFormData({ name: '', description: '', isPublic: false })
            setShowCreateModal(true)
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <FiPlus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <FiUsers className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No groups created yet</p>
          <p className="text-sm mt-2">Create a group to manage access to your knowledge base assets</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                    {group.name}
                    {group.isPublic && (
                      <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                        Public
                      </span>
                    )}
                  </h4>
                  {group.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {group.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(group)}
                    className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(group.id)}
                    className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {group.assetIds.length} asset{group.assetIds.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(showCreateModal || editingGroup) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setShowCreateModal(false)
              setEditingGroup(null)
              setFormData({ name: '', description: '', isPublic: false })
            }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {editingGroup ? 'Edit Group' : 'Create Group'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingGroup(null)
                    setFormData({ name: '', description: '', isPublic: false })
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g., Engineering Team"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Optional description"
                    rows={3}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPublic"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <label htmlFor="isPublic" className="text-sm text-gray-700 dark:text-gray-300">
                    Public group (all base users can access)
                  </label>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={editingGroup ? handleUpdate : handleCreate}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                  >
                    {editingGroup ? 'Update' : 'Create'} Group
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setEditingGroup(null)
                      setFormData({ name: '', description: '', isPublic: false })
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
