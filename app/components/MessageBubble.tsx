'use client'

import { Message } from '../store/useChatStore'
import CopyButton from './CopyButton'
import { FiUser, FiEdit2 } from 'react-icons/fi'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/cjs/styles/prism'
import { useState } from 'react'

interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.type === 'user'
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div
      className={`group mb-6 ${
        isUser 
          ? 'bg-transparent' 
          : 'bg-gradient-to-r from-gray-50/80 to-gray-100/50 dark:from-gray-800/50 dark:to-gray-900/30 backdrop-blur-sm'
      } py-6 px-4 rounded-2xl transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-4 hover:shadow-lg dark:hover:shadow-indigo-500/5`}
    >
      <div className="max-w-full flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {isUser ? (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-md">
              <FiUser className="w-5 h-5 text-white" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-sm text-white font-bold">D</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {isUser ? 'You' : 'Devmate'}
            </span>
            {!isUser && message.modelUsed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">
                {message.modelUsed.includes('gpt-5') ? '⚡ GPT-5' : 
                 message.modelUsed.includes('gpt-4') ? '⚡ GPT-4o' :
                 message.modelUsed.includes('grok-4') ? '🚀 Grok 4' :
                 message.modelUsed.includes('grok-2') ? '🤖 Grok 2' :
                 message.modelUsed.includes('grok-vision') ? '👁️ Grok Vision' :
                 message.modelUsed.includes('gemini-2.5-pro') ? '🔮 Gemini Pro' :
                 message.modelUsed.includes('gemini-2.5-flash') ? '⚡ Gemini Flash' : 
                 '🤖 AI'}
              </span>
            )}
          </div>
          
          <div className="prose prose-sm dark:prose-invert max-w-none">
            {message.content ? (
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const codeString = String(children).replace(/\n$/, '')
                    const isInline = !className
                    
                    return !isInline && match ? (
                      <div className="relative group/code my-4 rounded-xl overflow-hidden shadow-xl border border-gray-200 dark:border-gray-700">
                        <div className="sticky top-2 right-2 float-right z-10 mb-[-2rem]">
                          <CopyButton text={codeString} />
                        </div>
                        <SyntaxHighlighter
                          style={vscDarkPlus as any}
                          language={match[1]}
                          PreTag="div"
                          className="!bg-gray-900 dark:!bg-gray-950 !m-0 !p-4"
                          customStyle={{
                            background: 'transparent',
                            fontSize: '0.875rem',
                            lineHeight: '1.5'
                          }}
                        >
                          {codeString}
                        </SyntaxHighlighter>
                      </div>
                    ) : (
                      <code
                        className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-sm font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    )
                  },
                  p: ({ children }) => (
                    <p className="mb-3 text-gray-800 dark:text-gray-200 leading-relaxed">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside mb-3 space-y-1 text-gray-800 dark:text-gray-200">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-inside mb-3 space-y-1 text-gray-800 dark:text-gray-200">
                      {children}
                    </ol>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span className="text-sm">Thinking...</span>
              </div>
            )}
          </div>
          
          {message.content && (
            <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={message.content} />
              {isUser && (
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded-lg text-sm transition-colors"
                  title="Edit message (coming soon)"
                >
                  <FiEdit2 className="w-4 h-4" />
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
