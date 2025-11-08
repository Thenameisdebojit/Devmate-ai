'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import MessageBubble from '@/app/components/MessageBubble'
import { FiCopy, FiCheck } from 'react-icons/fi'
import toast from 'react-hot-toast'

export default function SharedChatPage() {
  const params = useParams()
  const shareId = params.shareId as string
  const [sharedChat, setSharedChat] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCopied, setIsCopied] = useState(false)

  useEffect(() => {
    const fetchSharedChat = async () => {
      try {
        const response = await fetch(`/api/share?shareId=${shareId}`)
        
        if (!response.ok) {
          throw new Error('Shared chat not found')
        }

        const data = await response.json()
        setSharedChat(data.sharedChat)
      } catch (err: any) {
        setError(err.message || 'Failed to load shared chat')
      } finally {
        setLoading(false)
      }
    }

    if (shareId) {
      fetchSharedChat()
    }
  }, [shareId])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setIsCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setIsCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading shared conversation...</p>
        </div>
      </div>
    )
  }

  if (error || !sharedChat) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🔗</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Chat Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            This shared conversation doesn't exist or has been removed.
          </p>
          <a
            href="/"
            className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
          >
            Go to Devmate
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="sticky top-0 z-10 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {sharedChat.title}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Shared on {new Date(sharedChat.createdAt).toLocaleDateString()}
                {sharedChat.viewCount > 1 && ` • ${sharedChat.viewCount} views`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={copyLink}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
              >
                {isCopied ? (
                  <>
                    <FiCheck className="w-4 h-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <FiCopy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>
              <a
                href="/"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Open in Devmate
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            📌 This is a shared conversation. The author has made this publicly viewable.
          </p>
        </div>

        <div className="space-y-4">
          {sharedChat.messages.map((message: any, index: number) => (
            <MessageBubble
              key={message.id || index}
              message={message}
            />
          ))}
        </div>
      </main>

      <footer className="mt-12 py-6 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Powered by <span className="font-semibold text-indigo-600 dark:text-indigo-400">Devmate</span>
          </p>
        </div>
      </footer>
    </div>
  )
}
