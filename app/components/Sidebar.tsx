'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useChatStore } from '../store/useChatStore'
import { motion, AnimatePresence } from 'framer-motion'
import { FiPlus, FiMessageSquare, FiUser, FiSettings, FiLogOut, FiMenu, FiX, FiTrash2, FiBook, FiSidebar } from 'react-icons/fi'
import Tooltip from './Tooltip'
import UserGuide from './UserGuide'
import toast from 'react-hot-toast'

interface SidebarProps {
  onOpenAuth: () => void
  onNewChat: () => void
  onOpenSettings: () => void
  onLoadChat: (chatId: string) => void
  currentChatId: string | null
  isOpen?: boolean
  onToggle?: () => void
}

export default function Sidebar({ onOpenAuth, onNewChat, onOpenSettings, onLoadChat, currentChatId, isOpen: isOpenProp = true, onToggle }: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [showUserGuide, setShowUserGuide] = useState(false)
  const [chatHistories, setChatHistories] = useState<any[]>([])
  const [isMounted, setIsMounted] = useState(false)
  const { user, isAuthenticated, logout } = useAuthStore()
  const { messages, clearMessages } = useChatStore()

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      loadChatHistories()
    }
  }, [isAuthenticated, messages])

  const loadChatHistories = async () => {
    try {
      const response = await fetch('/api/chats')
      if (response.ok) {
        const data = await response.json()
        setChatHistories(data.chats || [])
      }
    } catch (error) {
      console.error('Failed to load chat histories:', error)
    }
  }

  const handleNewChat = () => {
    onNewChat()
    if (window.innerWidth < 1024) {
      setIsMobileOpen(false)
    }
  }

  const handleLoadChat = (chatId: string) => {
    onLoadChat(chatId)
    if (window.innerWidth < 1024) {
      setIsMobileOpen(false)
    }
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this chat?')) return

    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setChatHistories(prev => prev.filter(chat => chat._id !== chatId))
        if (currentChatId === chatId) {
          onNewChat()
        }
        toast.success('Chat deleted')
      }
    } catch (error) {
      toast.error('Failed to delete chat')
    }
  }

  const handleLogout = async () => {
    await logout()
    clearMessages()
    setChatHistories([])
  }

  const getAvatarInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
      >
        {isMobileOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
      </button>

      {/* Desktop Toggle */}
      {!isOpenProp && (
        <button
          onClick={onToggle}
          className="hidden lg:block fixed top-4 left-4 z-50 p-2 rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm"
          title="Open sidebar"
        >
          <FiSidebar className="w-5 h-5" />
        </button>
      )}

      <AnimatePresence>
        {isMounted && ((isMobileOpen && window.innerWidth < 1024) || (isOpenProp && window.innerWidth >= 1024)) && (
          <>
            {isMobileOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                onClick={() => setIsMobileOpen(false)}
              />
            )}
            
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed top-0 left-0 h-screen w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col z-40 overflow-hidden"
            >
              <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Devmate v2.1
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Powered by OpenAI GPT-4</p>
                </div>
                {/* Desktop Close Button */}
                <button
                  onClick={onToggle}
                  className="hidden lg:block p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                  title="Close sidebar"
                >
                  <FiSidebar className="w-5 h-5" />
                </button>
              </div>

              {isAuthenticated ? (
                <>
                  <div className="p-4">
                    <button
                      onClick={handleNewChat}
                      className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium"
                    >
                      <FiPlus className="w-5 h-5" />
                      New Chat
                    </button>
                  </div>

                  <div className="flex-1 overflow-hidden flex flex-col px-4 pb-4">
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-3 flex-shrink-0">
                      Chats
                    </h3>
                    <div 
                      className="flex-1 overflow-y-auto min-h-0"
                      style={{ 
                        maxHeight: 'calc(100vh - 400px)',
                        scrollbarWidth: 'thin',
                        scrollbarColor: 'rgba(156, 163, 175, 0.3) transparent'
                      }}
                      onScroll={(e) => {
                        const target = e.target as HTMLElement
                        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/components/Sidebar.tsx:175',message:'Chat history scroll event',data:{scrollTop:target.scrollTop,scrollHeight:target.scrollHeight,clientHeight:target.clientHeight,chatCount:chatHistories.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
                      }}
                    >
                      {chatHistories.length === 0 ? (
                        <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                          No chat history yet
                        </p>
                      ) : (
                        <div className="space-y-1.5 pr-2">
                          {chatHistories.map((chat) => {
                            const chatDate = chat.updatedAt || chat.createdAt
                            const dateStr = chatDate ? new Date(chatDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
                            return (
                              <div
                                key={chat._id}
                                onClick={() => handleLoadChat(chat._id)}
                                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all group ${
                                  currentChatId === chat._id
                                    ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 shadow-sm'
                                    : 'hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700'
                                }`}
                              >
                                <FiMessageSquare className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                                  currentChatId === chat._id
                                    ? 'text-indigo-600 dark:text-indigo-400'
                                    : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                                }`} />
                                <div className="flex-1 min-w-0">
                                  <span className={`block text-sm font-medium truncate leading-tight ${
                                    currentChatId === chat._id
                                      ? 'text-indigo-900 dark:text-indigo-100'
                                      : 'text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {chat.title}
                                  </span>
                                  {dateStr && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block leading-tight">
                                      {dateStr}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => handleDeleteChat(chat._id, e)}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 -mr-1"
                                  title="Delete chat"
                                >
                                  <FiTrash2 className="w-4 h-4 text-gray-400 hover:text-red-500 dark:hover:text-red-400" />
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-800 p-4 space-y-2">
                    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                        {getAvatarInitials(user?.name || 'U')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {user?.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {user?.email}
                        </p>
                      </div>
                    </div>
                    
                    <Tooltip content="View Complete User Guide" position="right">
                      <button
                        onClick={() => {
                          setShowUserGuide(true)
                          if (window.innerWidth < 1024) {
                            setIsMobileOpen(false)
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <FiBook className="w-5 h-5" />
                        <span className="text-sm font-medium">User Guide</span>
                      </button>
                    </Tooltip>
                    
                    <Tooltip content="Manage Profile Settings" position="right">
                      <button
                        onClick={() => {
                          onOpenSettings()
                          if (window.innerWidth < 1024) {
                            setIsMobileOpen(false)
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-700 dark:text-gray-300"
                      >
                        <FiSettings className="w-5 h-5" />
                        <span className="text-sm font-medium">Settings</span>
                      </button>
                    </Tooltip>
                    
                    <Tooltip content="Sign Out" position="right">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-red-600 dark:text-red-400"
                      >
                        <FiLogOut className="w-5 h-5" />
                        <span className="text-sm font-medium">Logout</span>
                      </button>
                    </Tooltip>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center mb-4">
                    <FiUser className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Welcome to Devmate
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6">
                    Sign in to save your chat history and access your conversations from anywhere.
                  </p>
                  <button
                    onClick={() => {
                      onOpenAuth()
                      if (window.innerWidth < 1024) {
                        setIsMobileOpen(false)
                      }
                    }}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all font-medium"
                  >
                    Sign In / Sign Up
                  </button>
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <UserGuide isOpen={showUserGuide} onClose={() => setShowUserGuide(false)} />
    </>
  )
}
