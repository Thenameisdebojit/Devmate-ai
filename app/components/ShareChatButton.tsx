'use client'

import { useState } from 'react'
import { FiShare2, FiCopy, FiCheck, FiX } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface ShareChatButtonProps {
  chatId?: string
  messages: any[]
}

export default function ShareChatButton({ chatId, messages }: ShareChatButtonProps) {
  const [showModal, setShowModal] = useState(false)
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
      const title = messages.find((m) => m.type === 'user')?.content.substring(0, 50) || 'Shared Conversation'
      
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
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
    setShowModal(false)
  }

  const handleShare = () => {
    setShowModal(true)
    if (messages.length > 0) {
      generateShareLink()
    }
  }

  if (messages.length === 0) return null

  return (
    <>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors border border-gray-300 dark:border-gray-600"
        title="Share conversation"
      >
        <FiShare2 className="w-4 h-4" />
        Share
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Share Conversation
                </h3>
                <button
                  onClick={handleClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {isGenerating && !shareUrl ? (
                <div className="py-8 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">Creating share link...</p>
                </div>
              ) : shareUrl ? (
                <>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Anyone with this link can view your conversation.
                  </p>

                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                    <p className="text-sm text-green-800 dark:text-green-200 mb-3 font-medium">
                      ✓ Share link created successfully!
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={shareUrl}
                        readOnly
                        className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white font-mono"
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
                </>
              ) : (
                <div className="py-4 text-center text-gray-600 dark:text-gray-400">
                  <p>Unable to create share link. Please try again.</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
