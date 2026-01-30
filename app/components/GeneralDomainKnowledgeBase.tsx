'use client'

import { useState, useEffect } from 'react'
import { FiSearch, FiTrash2, FiEye, FiX, FiFileText, FiImage, FiUsers } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface Asset {
  id: string
  modality: 'image' | 'pdf' | 'text'
  filename: string
  caption?: string
  extracted_text?: string
  tags?: string[]
  groupIds?: string[]
  uploadedAt: string
  size: number
}

interface GeneralDomainKnowledgeBaseProps {
  userId: string
  userRole?: 'base_user' | 'super_user' | 'admin'
}

export default function GeneralDomainKnowledgeBase({ userId, userRole }: GeneralDomainKnowledgeBaseProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [filteredAssets, setFilteredAssets] = useState<Asset[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isSuperUser = userRole === 'super_user' || userRole === 'admin'

  useEffect(() => {
    loadAssets()
  }, [userId])

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAssets(assets)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredAssets(assets.filter(asset =>
        asset.filename.toLowerCase().includes(query) ||
        asset.caption?.toLowerCase().includes(query) ||
        asset.extracted_text?.toLowerCase().includes(query) ||
        asset.tags?.some(tag => tag.toLowerCase().includes(query))
      ))
    }
  }, [searchQuery, assets])

  const loadAssets = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/rag/assets')
      if (response.ok) {
        const data = await response.json()
        setAssets(data.assets || [])
      } else {
        toast.error('Failed to load assets')
      }
    } catch (error) {
      console.error('Failed to load assets:', error)
      toast.error('Failed to load assets')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return

    try {
      const response = await fetch(`/api/rag/assets?id=${assetId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Asset deleted successfully')
        setAssets(prev => prev.filter(a => a.id !== assetId))
        if (selectedAsset?.id === assetId) {
          setSelectedAsset(null)
        }
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete asset')
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete asset')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Knowledge Base
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isSuperUser ? 'Manage your uploaded assets' : 'Browse available knowledge base assets'}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Search assets by name, caption, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
      </div>

      {/* Asset List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No assets found</p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="mt-2 text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssets.map((asset) => (
            <motion.div
              key={asset.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedAsset(asset)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {asset.modality === 'image' ? (
                    <FiImage className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <FiFileText className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  )}
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {asset.modality}
                  </span>
                </div>
                {isSuperUser && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(asset.id)
                    }}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <h4 className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                {asset.filename}
              </h4>

              {asset.caption && (
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                  {asset.caption}
                </p>
              )}

              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>{formatFileSize(asset.size)}</span>
                <span>{formatDate(asset.uploadedAt)}</span>
              </div>

              {asset.tags && asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {asset.tags.slice(0, 3).map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {asset.tags.length > 3 && (
                    <span className="px-2 py-0.5 text-gray-500 dark:text-gray-400 text-xs">
                      +{asset.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Asset Detail Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedAsset(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {selectedAsset.filename}
                </h3>
                <button
                  onClick={() => setSelectedAsset(null)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <FiX className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Type:</span>
                    <span className="ml-2 text-gray-900 dark:text-white capitalize">
                      {selectedAsset.modality}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Size:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {formatFileSize(selectedAsset.size)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Uploaded:</span>
                    <span className="ml-2 text-gray-900 dark:text-white">
                      {formatDate(selectedAsset.uploadedAt)}
                    </span>
                  </div>
                </div>

                {selectedAsset.caption && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Caption
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedAsset.caption}
                    </p>
                  </div>
                )}

                {selectedAsset.extracted_text && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Extracted Text
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {selectedAsset.extracted_text}
                    </p>
                  </div>
                )}

                {selectedAsset.tags && selectedAsset.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAsset.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAsset.groupIds && selectedAsset.groupIds.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                      <FiUsers className="w-4 h-4" />
                      Access Groups
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedAsset.groupIds.map((groupId, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        >
                          {groupId}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
