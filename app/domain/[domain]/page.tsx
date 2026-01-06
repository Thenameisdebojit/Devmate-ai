'use client'

/**
 * Domain Pages
 * 
 * Handles routing for different domains (General, Web Dev, ML, etc.)
 * Each domain has its own experience.
 */

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, lazy, Suspense, useCallback, useRef } from 'react'
import ChatWindow from '@/app/components/ChatWindow'
import InputSection from '@/app/components/InputSection'
import Sidebar from '@/app/components/Sidebar'
import DomainSwitcher from '@/components/ide/DomainSwitcher'
import IDEHeader from '@/components/ide/IDEHeader'
import ThemeToggle from '@/app/components/ThemeToggle'
import ResearchPanel from '@/app/components/ResearchPanel'
import { useChatStore } from '@/app/store/useChatStore'
import { useAuthStore } from '@/app/store/useAuthStore'
import toast from 'react-hot-toast'

const AuthModal = lazy(() => import('@/app/components/AuthModal'))
const SettingsModal = lazy(() => import('@/app/components/SettingsModal'))

// Map route domain IDs to store domain IDs
const domainMap: Record<string, string> = {
  'general': 'general',
  'web-dev': 'web-dev',
  'ml-ai': 'ml-ai',
  'data-science': 'data-science',
  'academic': 'academic',
  'prompt-eng': 'prompt-eng',
}

export default function DomainPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setDomain, clearMessages, setMessages, messages, currentDomain } = useChatStore()
  const { checkAuth, isAuthenticated } = useAuthStore()
  const domainId = params.domain as string
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(searchParams.get('chatId'))
  const [isDomainSwitching, setIsDomainSwitching] = useState(false) // Track domain switching state for UI
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousDomainRef = useRef<string | null>(null)
  const isInitialMount = useRef(true)
  const messagesRef = useRef<typeof messages>(messages) // Keep ref to messages for capturing before clear
  const isDomainSwitchingRef = useRef(false) // Track if we're in the middle of a domain switch

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  // Define saveCurrentChat before useEffect that uses it
  const saveCurrentChat = useCallback(async () => {
    if (!isAuthenticated || messages.length === 0) return

    try {
      // Filter out messages with empty content to avoid validation errors
      const validMessages = messages.filter((m) => m.content && m.content.trim().length > 0)
      
      // Don't save if there are no valid messages
      if (validMessages.length === 0) return

      const firstUserMessage = validMessages.find((m) => m.type === 'user')
      const title = firstUserMessage?.content.substring(0, 50) || 'New Chat'

      const endpoint = currentChatId ? `/api/chats/${currentChatId}` : '/api/chats'
      const method = currentChatId ? 'PUT' : 'POST'

      // ALWAYS save with the current domain ID to ensure chats are saved with their respective domain
      const mappedDomain = domainMap[domainId] || domainId
      console.log(`[ChatSave] Saving chat with domain: ${mappedDomain} (route domain: ${domainId})`)

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          messages: validMessages, 
          domain: mappedDomain // Always include domain ID with chat
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (!currentChatId) {
          setCurrentChatId(data.chat._id)
          console.log(`[ChatSave] Created new chat with ID: ${data.chat._id} and domain: ${mappedDomain}`)
        } else {
          console.log(`[ChatSave] Updated chat ${currentChatId} with domain: ${mappedDomain}`)
        }
      }
    } catch (error) {
      console.error('[ChatSave] Failed to save chat:', error)
    }
  }, [isAuthenticated, messages, currentChatId, domainId])

  // Keep messagesRef in sync with messages
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  // CRITICAL: Effect that runs when domainId changes - ensures immediate message clearing
  useEffect(() => {
    const mappedDomain = domainMap[domainId] || domainId
    
    // Initialize on first mount
    if (isInitialMount.current) {
      previousDomainRef.current = mappedDomain
      setDomain(mappedDomain)
      isInitialMount.current = false
      return
    }
    
    // On domain change (navigation to different domain), IMMEDIATELY clear messages
    if (previousDomainRef.current && previousDomainRef.current !== mappedDomain) {
      console.log(`[DomainSwitch] IMMEDIATE CLEAR - switching from ${previousDomainRef.current} to ${mappedDomain}`)
      
      // Mark that we're switching domains to prevent chat reload
      isDomainSwitchingRef.current = true
      setIsDomainSwitching(true) // Show blank page immediately
      
      // STEP 1: Capture messages BEFORE clearing (use ref to get current value)
      const previousMessages = [...messagesRef.current] // Copy messages array from ref before clearing
      const previousChatId = currentChatId
      const previousDomain = previousDomainRef.current
      
      // STEP 2: IMMEDIATELY clear messages and reset chat ID - start fresh session
      clearMessages()
      setMessages([]) // Force clear messages array
      setCurrentChatId(null) // Clear chat ID immediately
      
      // STEP 3: Remove chatId from URL if present (do this BEFORE updating domain)
      const currentChatIdParam = searchParams.get('chatId')
      if (currentChatIdParam) {
        // Use router.replace to remove chatId from URL immediately
        router.replace(`/domain/${domainId}`)
      }
      
      // STEP 4: Update domain state and ref
      setDomain(mappedDomain)
      previousDomainRef.current = mappedDomain
      
      // STEP 5: Save previous chat in background (after clearing)
      if (isAuthenticated && previousMessages.length > 0) {
        // Save asynchronously without blocking UI
        (async () => {
          try {
            const validMessages = previousMessages.filter((m) => m.content && m.content.trim().length > 0)
            if (validMessages.length > 0) {
              const firstUserMessage = validMessages.find((m) => m.type === 'user')
              const title = firstUserMessage?.content.substring(0, 50) || 'New Chat'
              const endpoint = previousChatId ? `/api/chats/${previousChatId}` : '/api/chats'
              const method = previousChatId ? 'PUT' : 'POST'

              await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, messages: validMessages, domain: previousDomain || 'general' }),
              })
              console.log(`[DomainSwitch] Saved chat from previous domain: ${previousDomain}`)
            }
          } catch (error) {
            console.error('[DomainSwitch] Failed to save chat on domain change:', error)
          }
        })()
      }
      
      // STEP 6: Reset domain switching flag after a short delay to allow router.replace to complete
      setTimeout(() => {
        isDomainSwitchingRef.current = false
        setIsDomainSwitching(false) // Hide blank page transition state
      }, 100)
    } else {
      // Domain didn't change, just update domain state
      setDomain(mappedDomain)
      previousDomainRef.current = mappedDomain
    }
  }, [domainId, setDomain, clearMessages, setMessages, router, searchParams, isAuthenticated, currentChatId])

  const handleLoadChat = useCallback(async (chatId: string) => {
    try {
      console.log(`[ChatLoad] Loading chat: ${chatId}`)
      const response = await fetch(`/api/chats/${chatId}`)
      if (response.ok) {
        const data = await response.json()
        const chat = data.chat
        
        if (!chat) {
          toast.error('Chat not found')
          return
        }
        
        // Get the domain ID from the saved chat
        const chatDomain = chat.domain || 'general'
        const mappedDomain = domainMap[domainId] || domainId
        
        console.log(`[ChatLoad] Chat domain: ${chatDomain}, Current domain: ${mappedDomain} (route: ${domainId})`)
        
        // Map chat domain to route domain ID (reverse lookup)
        const chatRouteDomain = Object.keys(domainMap).find(
          key => domainMap[key] === chatDomain
        ) || chatDomain
        
        // IMPORTANT: If chat belongs to a different domain, navigate to that domain
        if (chatDomain !== mappedDomain) {
          console.log(`[ChatLoad] Chat belongs to different domain. Navigating from ${mappedDomain} to ${chatDomain}`)
          // Navigate to the correct domain for this chat
          if (chatDomain === 'app-generator') {
            router.push(`/ide/app-generator?chatId=${chatId}`)
          } else {
            router.push(`/domain/${chatRouteDomain}?chatId=${chatId}`)
          }
          return
        }

        // Chat belongs to current domain - load it
        console.log(`[ChatLoad] Loading chat in current domain: ${mappedDomain}`)
        if (chat.messages && Array.isArray(chat.messages)) {
          setMessages(chat.messages)
        }
        setCurrentChatId(chatId)
        
        // Update URL with chatId if not already present
        const currentChatIdParam = searchParams.get('chatId')
        if (currentChatIdParam !== chatId) {
          const currentPath = `/domain/${domainId}`
          router.replace(`${currentPath}?chatId=${chatId}`)
        }
        
        toast.success('Chat loaded')
      } else {
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to load chat')
      }
    } catch (error) {
      console.error('[ChatLoad] Failed to load chat:', error)
      toast.error('Failed to load chat')
    }
  }, [domainId, router, setMessages, searchParams])

  // Load chat if chatId is provided (but NOT during domain switch)
  useEffect(() => {
    // Don't load chat if we're in the middle of switching domains
    if (isDomainSwitchingRef.current) {
      console.log('[ChatLoad] Skipping chat load - domain switch in progress')
      return
    }
    
    const chatId = searchParams.get('chatId')
    if (chatId && chatId !== currentChatId) {
      handleLoadChat(chatId)
    }
  }, [searchParams, currentChatId, handleLoadChat])

  // Auto-save chat when messages change
  useEffect(() => {
    if (isAuthenticated && messages.length > 0) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      const timeout = setTimeout(() => {
        saveCurrentChat()
      }, 2000)
      saveTimeoutRef.current = timeout
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [messages, isAuthenticated, saveCurrentChat])

  const handleNewChat = async () => {
    // Save current chat before clearing
    if (isAuthenticated && messages.length > 0 && !currentChatId) {
      await saveCurrentChat()
    }
    clearMessages()
    setCurrentChatId(null)
    router.push(`/domain/${domainId}`)
  }

  // Map domain ID for display
  const displayDomainId = domainMap[domainId] || domainId
  const isAcademic = displayDomainId === 'academic'

  return (
    <>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Sidebar */}
        <Sidebar 
          isOpen={isSidebarOpen} 
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          onOpenAuth={() => setShowAuthModal(true)}
          onNewChat={handleNewChat}
          onOpenSettings={() => setShowSettingsModal(true)}
          onLoadChat={handleLoadChat}
          currentChatId={currentChatId}
        />

        {/* Main Content Area */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'lg:ml-80' : 'lg:ml-0'}`}>
          {/* Header with Domain Switcher and Theme Toggle */}
          <div className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <DomainSwitcher currentDomain={displayDomainId} />
              <ThemeToggle />
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-4 py-6">
              {isDomainSwitching || (messages.length === 0 && !currentChatId) ? (
                // Show blank page during domain switch or when starting fresh
                <div className="flex flex-col items-center justify-center h-full text-center px-4 max-w-3xl mx-auto min-h-[60vh]">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-3">
                    {isDomainSwitching ? 'Switching domain...' : 'What can I help you build today?'}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md text-base leading-relaxed">
                    {isDomainSwitching ? 'Starting a new chat session...' : 'Ask me to generate code, explain concepts, or help debug your projects.'}
                  </p>
                </div>
              ) : isAcademic ? (
                <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
                  <ResearchPanel />
                </Suspense>
              ) : (
                <ChatWindow />
              )}
            </div>
          </div>

          {/* Input Section - Only show for non-academic domains */}
          {!isAcademic && (
            <div className="sticky bottom-0 z-30 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto px-4 py-4">
                <InputSection onNewChat={handleNewChat} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <Suspense fallback={null}>
        {showAuthModal && (
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        )}
        {showSettingsModal && (
          <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
        )}
      </Suspense>
    </>
  )
}
