'use client'

import { useState, useEffect } from 'react'
import { FiUsers, FiCheck, FiX } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'

interface Group {
  id: string
  name: string
  description?: string
  isPublic: boolean
}

interface GroupSelectorProps {
  selectedGroupIds: string[]
  onChange: (groupIds: string[]) => void
  userId: string
  userRole?: 'base_user' | 'super_user' | 'admin'
}

export default function GroupSelector({ selectedGroupIds, onChange, userId, userRole }: GroupSelectorProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(false)

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
      }
    } catch (error) {
      console.error('Failed to load groups:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const toggleGroup = (groupId: string) => {
    if (selectedGroupIds.includes(groupId)) {
      onChange(selectedGroupIds.filter(id => id !== groupId))
    } else {
      onChange([...selectedGroupIds, groupId])
    }
  }

  if (!isSuperUser) {
    return null
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <FiUsers className="w-4 h-4" />
          <span className="text-sm">
            {selectedGroupIds.length === 0
              ? 'Select groups (optional)'
              : `${selectedGroupIds.length} group${selectedGroupIds.length !== 1 ? 's' : ''} selected`}
          </span>
        </div>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {isLoading ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                Loading groups...
              </div>
            ) : groups.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No groups available. Create a group first.
              </div>
            ) : (
              <div className="p-2">
                {groups.map((group) => {
                  const isSelected = selectedGroupIds.includes(group.id)
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className={`w-full px-3 py-2 rounded-lg text-left text-sm transition-colors flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected ? (
                          <FiCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <div className="w-4 h-4 border border-gray-300 dark:border-gray-600 rounded" />
                        )}
                        <span className="font-medium">{group.name}</span>
                        {group.isPublic && (
                          <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                            Public
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}
