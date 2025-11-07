'use client'

import { useEffect, useRef } from 'react'
import { useChatStore } from '../store/useChatStore'
import MessageBubble from './MessageBubble'
import ShareChatButton from './ShareChatButton'

export default function ChatWindow() {
  const { messages } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div 
      ref={scrollRef}
      className="h-full overflow-y-auto"
    >
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-3xl mx-auto">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
            What can I help you build today?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md text-base leading-relaxed">
            Ask me to generate code, explain concepts, or help debug your projects.
          </p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex justify-end mb-4">
            <ShareChatButton messages={messages} />
          </div>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>
      )}
    </div>
  )
}
