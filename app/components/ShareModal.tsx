'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { FiCopy, FiCheck, FiX } from 'react-icons/fi'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  messages: any[]
  chatId?: string | null
  title: string
}

export default function ShareModal({ isOpen, onClose, messages, chatId, title }: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const generateShareLink = async () => {
    if (messages.length === 0) {
      toast.error('No messages to share')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || 'Shared Conversation',
          messages,
          chatId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create share link')
      }

      const data = await response.json()
      setShareUrl(data.shareUrl)
      toast.success('Share link created!')
    } catch (error) {
      console.error('Share error:', error)
      toast.error('Failed to create share link')
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = async () => {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setIsCopied(true)
      toast.success('Link copied to clipboard!')
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  const handleClose = () => {
    setShareUrl(null)
    setIsCopied(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <FiX className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>

          <div className="mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Share Conversation
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              Create a shareable link that anyone can view
            </p>
          </div>

          {!shareUrl ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 Anyone with the link will be able to view this conversation
                </p>
              </div>

              <button
                onClick={generateShareLink}
                disabled={isGenerating}
                className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </span>
                ) : (
                  'Create Share Link'
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  ✓ Share link created successfully!
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                    title="Copy link"
                  >
                    {isCopied ? (
                      <FiCheck className="w-5 h-5" />
                    ) : (
                      <FiCopy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
