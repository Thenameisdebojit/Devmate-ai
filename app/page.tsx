'use client'

import { useState, useEffect, lazy, Suspense, useMemo } from 'react'
import ChatWindow from './components/ChatWindow'
import InputSection from './components/InputSection'
import Sidebar from './components/Sidebar'
import LoadingBar from './components/LoadingBar'
import WelcomePage from './components/WelcomePage'
import DomainSelector from './components/DomainSelector'
import ThemeToggle from './components/ThemeToggle'
import AppGeneratorPanel from './components/AppGeneratorPanel'
import { useChatStore } from './store/useChatStore'
import { useAuthStore } from './store/useAuthStore'
import { useTheme } from './components/ThemeProvider'
import toast from 'react-hot-toast'

const AuthModal = lazy(() => import('./components/AuthModal'))
const SettingsModal = lazy(() => import('./components/SettingsModal'))
const OnboardingModal = lazy(() => import('./components/OnboardingModal'))
const HelpModal = lazy(() => import('./components/HelpModal'))

export default function Home() {
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null)

  const { clearMessages, messages, setMessages, currentDomain, setDomain } = useChatStore()
  const { checkAuth, isAuthenticated, isLoading: authLoading } = useAuthStore()
  const { theme } = useTheme()

  // ✅ Move all hooks ABOVE conditional returns
  const isLoading = useMemo(() => {
    if (!messages || messages.length === 0) return false
    return useChatStore
      .getState()
      .messages.some((m) => m.content === '' && m.type === 'assistant')
  }, [messages])

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    const onboardingCompleted = localStorage.getItem('onboardingCompleted')
    if (isAuthenticated && !onboardingCompleted) {
      setTimeout(() => setShowOnboarding(true), 1000)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const checkApiKey = async () => {
      try {
        const response = await fetch('/api/health')
        if (!response.ok) {
          toast.error(
            'API key not configured! Add OPENAI_API_KEY and MONGODB_URI to Secrets',
            { duration: 6000 }
          )
        }
      } catch (err) {
        console.error('Health check failed:', err)
      }
    }
    checkApiKey()
  }, [])

  useEffect(() => {
    if (isAuthenticated && messages.length > 0) {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
      const timeout = setTimeout(() => {
        saveCurrentChat()
      }, 2000)
      setSaveTimeout(timeout)
    }
  }, [messages, isAuthenticated])

  const saveCurrentChat = async () => {
    if (!isAuthenticated || messages.length === 0) return

    try {
      const firstUserMessage = messages.find((m) => m.type === 'user')
      const title = firstUserMessage?.content.substring(0, 50) || 'New Chat'

      const endpoint = currentChatId ? `/api/chats/${currentChatId}` : '/api/chats'
      const method = currentChatId ? 'PUT' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, messages }),
      })

      if (response.ok) {
        const data = await response.json()
        if (!currentChatId) {
          setCurrentChatId(data.chat._id)
        }
      }
    } catch (error) {
      console.error('Failed to save chat:', error)
    }
  }

  const handleNewChat = async () => {
    if (isAuthenticated && messages.length > 0 && !currentChatId) {
      await saveCurrentChat()
    }
    clearMessages()
    setCurrentChatId(null)
  }

  const handleLoadChat = async (chatId: string) => {
    try {
      const response = await fetch(`/api/chats/${chatId}`)
      if (response.ok) {
        const data = await response.json()
        setMessages(data.chat.messages)
        setCurrentChatId(chatId)
      }
    } catch (error) {
      console.error('Failed to load chat:', error)
      toast.error('Failed to load chat')
    }
  }

  // ✅ Hooks above, now safe to use conditionals
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoadingBar isLoading={authLoading} />
        <WelcomePage onGetStarted={() => setShowAuthModal(true)} />
        <Suspense fallback={null}>
          {showAuthModal && (
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
          )}
        </Suspense>
      </>
    )
  }

  return (
    <>
      <LoadingBar isLoading={isLoading} />
      <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900">
        <Sidebar
          onOpenAuth={() => setShowAuthModal(true)}
          onNewChat={handleNewChat}
          onOpenSettings={() => setShowSettingsModal(true)}
          onLoadChat={handleLoadChat}
          currentChatId={currentChatId}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <Suspense fallback={null}>
          {showAuthModal && (
            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
          )}
          {showSettingsModal && (
            <SettingsModal
              isOpen={showSettingsModal}
              onClose={() => setShowSettingsModal(false)}
            />
          )}
          {showOnboarding && (
            <OnboardingModal
              isOpen={showOnboarding}
              onClose={() => setShowOnboarding(false)}
            />
          )}
          {showHelpModal && (
            <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />
          )}
        </Suspense>

        {/* Main Chat Area */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'lg:ml-80' : 'lg:ml-0'}`}>
          <div className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <DomainSelector value={currentDomain} onChange={setDomain} />
              <ThemeToggle />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 py-6">
              {currentDomain === 'Web Development' && (
                <div className="mb-6">
                  <AppGeneratorPanel />
                </div>
              )}
              <ChatWindow />
            </div>
          </div>

          <div className="sticky bottom-0 z-30 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-4 py-4">
              <InputSection onNewChat={handleNewChat} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
