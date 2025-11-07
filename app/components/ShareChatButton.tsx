'use client'

import { useState } from 'react'
import { FiShare2, FiDownload, FiX } from 'react-icons/fi'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

interface ShareChatButtonProps {
  chatId?: string
  messages: any[]
}

export default function ShareChatButton({ chatId, messages }: ShareChatButtonProps) {
  const [showModal, setShowModal] = useState(false)

  const exportAsText = () => {
    try {
      const text = messages
        .map((msg) => {
          const prefix = msg.type === 'user' ? 'You' : 'Devmate'
          const model = msg.modelUsed ? ` (${msg.modelUsed})` : ''
          const timestamp = new Date(msg.timestamp).toLocaleString()
          return `${prefix}${model} - ${timestamp}:\n${msg.content}\n`
        })
        .join('\n---\n\n')
      
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `devmate-conversation-${Date.now()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Conversation exported!')
      setShowModal(false)
    } catch (error) {
      toast.error('Failed to export conversation')
    }
  }

  const exportAsMarkdown = () => {
    try {
      const markdown = messages
        .map((msg) => {
          const prefix = msg.type === 'user' ? '## You' : '## Devmate'
          const model = msg.modelUsed ? ` *(${msg.modelUsed})*` : ''
          const timestamp = new Date(msg.timestamp).toLocaleString()
          return `${prefix}${model}\n*${timestamp}*\n\n${msg.content}\n`
        })
        .join('\n---\n\n')
      
      const fullMarkdown = `# DevMate Conversation\n\n${markdown}`
      
      const blob = new Blob([fullMarkdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `devmate-conversation-${Date.now()}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Conversation exported as Markdown!')
      setShowModal(false)
    } catch (error) {
      toast.error('Failed to export conversation')
    }
  }

  const handleShare = () => {
    setShowModal(true)
  }

  return (
    <>
      <button
        onClick={handleShare}
        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors border border-gray-300 dark:border-gray-600"
        title="Export conversation"
      >
        <FiDownload className="w-4 h-4" />
        Export
      </button>

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={() => setShowModal(false)}
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
                  Export Conversation
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Download this conversation in your preferred format.
              </p>

              <div className="space-y-3">
                <button
                  onClick={exportAsMarkdown}
                  className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FiDownload className="w-4 h-4" />
                  Export as Markdown
                </button>
                
                <button
                  onClick={exportAsText}
                  className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <FiDownload className="w-4 h-4" />
                  Export as Text
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
