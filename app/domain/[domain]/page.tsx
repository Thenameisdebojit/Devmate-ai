'use client'

/**
 * Domain Pages
 * 
 * Handles routing for different domains (General, Web Dev, ML, etc.)
 * Each domain has its own experience.
 */

import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, lazy, Suspense, useCallback, useRef, useMemo } from 'react'
import ChatWindow from '@/app/components/ChatWindow'
import InputSection from '@/app/components/InputSection'
import Sidebar from '@/app/components/Sidebar'
import DomainSwitcher from '@/components/ide/DomainSwitcher'
import IDEHeader from '@/components/ide/IDEHeader'
import ThemeToggle from '@/app/components/ThemeToggle'
import ResearchPanel from '@/app/components/ResearchPanel'
import GeneralDomainUpload from '@/app/components/GeneralDomainUpload'
import GeneralDomainKnowledgeBase from '@/app/components/GeneralDomainKnowledgeBase'
import GroupManager from '@/app/components/GroupManager'
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
  const { checkAuth, isAuthenticated, user } = useAuthStore()
  const domainId = params.domain as string
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false)
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
      // On first mount, check if we're switching from a different domain (route change creates new component)
      const storeDomain = useChatStore.getState().currentDomain
      const storeMessages = useChatStore.getState().messages
      
      if (storeDomain && storeDomain !== mappedDomain && storeMessages.length > 0) {
        // We're switching domains - clear messages immediately
        console.log(`[DomainSwitch] Route change detected: ${storeDomain} -> ${mappedDomain}`)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:115',message:'Domain switch on route change',data:{storeDomain,newDomain:mappedDomain,messagesCount:storeMessages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        
        // Mark that we're switching domains
        isDomainSwitchingRef.current = true
        setIsDomainSwitching(true)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:122',message:'isDomainSwitching set to true (route change)',data:{isDomainSwitching:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        
        // Save previous chat if authenticated (before clearing)
        if (isAuthenticated && storeMessages.length > 0) {
          (async () => {
            try {
              const validMessages = storeMessages.filter((m) => m.content && m.content.trim().length > 0)
              if (validMessages.length > 0) {
                const firstUserMessage = validMessages.find((m) => m.type === 'user')
                const title = firstUserMessage?.content.substring(0, 50) || 'New Chat'
                
                // Try to save with previous chatId if exists
                const prevChatId = currentChatId
                if (prevChatId) {
                  await fetch(`/api/chats/${prevChatId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, messages: validMessages, domain: storeDomain }),
                  })
                  console.log(`[DomainSwitch] Saved previous chat ${prevChatId} for domain: ${storeDomain}`)
                } else {
                  const response = await fetch('/api/chats', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, messages: validMessages, domain: storeDomain }),
                  })
                  if (response.ok) {
                    const data = await response.json()
                    console.log(`[DomainSwitch] Created new chat ${data.chat._id} for domain: ${storeDomain}`)
                  }
                }
              }
            } catch (error) {
              console.error('[DomainSwitch] Failed to save chat on route change:', error)
            }
          })()
        }
        
        // Clear messages and chat ID
        setCurrentChatId(null)
        clearMessages()
        setMessages([])
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:155',message:'Messages cleared on route change',data:{messagesCleared:true,chatIdCleared:true,messagesAfterClear:useChatStore.getState().messages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        
        // Update domain
        setDomain(mappedDomain)
        previousDomainRef.current = mappedDomain
        isInitialMount.current = false
        
        // Reset switching flag after delay
        setTimeout(() => {
          const finalMessagesCount = useChatStore.getState().messages.length
          isDomainSwitchingRef.current = false
          setIsDomainSwitching(false)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:165',message:'Domain switch complete (route change)',data:{finalMessagesCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
        }, 1000)
        return
      }
      
      previousDomainRef.current = mappedDomain
      setDomain(mappedDomain)
      isInitialMount.current = false
      return
    }
    
    // On domain change (navigation to different domain), IMMEDIATELY clear messages
    // Check both previousDomainRef AND currentDomain from store to catch route changes
    const storeDomain = useChatStore.getState().currentDomain
    if ((previousDomainRef.current && previousDomainRef.current !== mappedDomain) || 
        (storeDomain && storeDomain !== mappedDomain)) {
      console.log(`[DomainSwitch] IMMEDIATE CLEAR - switching from ${previousDomainRef.current} to ${mappedDomain}`)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:121',message:'Domain switch detected',data:{previousDomain:previousDomainRef.current,newDomain:mappedDomain,messagesCount:messages.length,currentChatId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      
      // Mark that we're switching domains to prevent chat reload and auto-save
      isDomainSwitchingRef.current = true
      setIsDomainSwitching(true) // Show blank page immediately
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:126',message:'isDomainSwitching set to true',data:{isDomainSwitching:true},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      
      // STEP 1: Capture messages BEFORE clearing (use ref to get current value)
      const previousMessages = [...messagesRef.current] // Copy messages array from ref before clearing
      const previousChatId = currentChatId
      const previousDomain = previousDomainRef.current
      
      // STEP 2: Save previous chat BEFORE clearing (to prevent duplicates)
      if (isAuthenticated && previousMessages.length > 0) {
        (async () => {
          try {
            const validMessages = previousMessages.filter((m) => m.content && m.content.trim().length > 0)
            if (validMessages.length > 0) {
              const firstUserMessage = validMessages.find((m) => m.type === 'user')
              const title = firstUserMessage?.content.substring(0, 50) || 'New Chat'

              if (previousChatId) {
                // Update existing chat with previous domain
                await fetch(`/api/chats/${previousChatId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title, messages: validMessages, domain: previousDomain || 'general' }),
                })
                console.log(`[DomainSwitch] Updated chat ${previousChatId} with domain: ${previousDomain}`)
              } else {
                // Create new chat for previous domain (if no chatId exists)
                const response = await fetch('/api/chats', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ title, messages: validMessages, domain: previousDomain || 'general' }),
                })
                if (response.ok) {
                  const data = await response.json()
                  console.log(`[DomainSwitch] Created new chat ${data.chat._id} for domain: ${previousDomain}`)
                }
              }
            }
          } catch (error) {
            console.error('[DomainSwitch] Failed to save chat on domain change:', error)
          }
        })()
      }
      
      // STEP 3: IMMEDIATELY clear messages and reset chat ID - start fresh session
      // Clear chat ID FIRST to prevent any chat loading
      setCurrentChatId(null) // Clear chat ID immediately - new domain gets new chat ID
      // Then clear messages - do both store and local state
      clearMessages() // Clear from store
      setMessages([]) // Force clear messages array to ensure immediate UI update
      // Double-check messages are cleared
      setTimeout(() => {
        const checkMessages = useChatStore.getState().messages
        if (checkMessages.length > 0) {
          console.warn('[DomainSwitch] Messages not cleared, forcing clear again')
          clearMessages()
          setMessages([])
        }
      }, 50)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:172',message:'Messages cleared and chatId reset',data:{messagesCleared:true,chatIdCleared:true,messagesAfterClear:useChatStore.getState().messages.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      
      // STEP 4: Remove chatId from URL if present (do this BEFORE updating domain)
      const currentChatIdParam = searchParams.get('chatId')
      if (currentChatIdParam) {
        // Use router.replace to remove chatId from URL immediately
        router.replace(`/domain/${domainId}`, { scroll: false })
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:179',message:'Removed chatId from URL',data:{removedChatId:currentChatIdParam,newUrl:`/domain/${domainId}`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      }
      
      // STEP 5: Update domain state and ref
      setDomain(mappedDomain)
      previousDomainRef.current = mappedDomain
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:186',message:'Domain state updated',data:{newDomain:mappedDomain,previousDomain:previousDomainRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      
      // STEP 6: Reset domain switching flag after a delay to allow router.replace to complete
      // Use a longer delay to ensure messages are cleared, URL is updated, and prevent chat reload
      setTimeout(() => {
        const finalMessagesCount = useChatStore.getState().messages.length
        const finalChatId = searchParams.get('chatId')
        isDomainSwitchingRef.current = false
        setIsDomainSwitching(false) // Hide blank page transition state
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:193',message:'isDomainSwitching reset to false',data:{isDomainSwitching:false,finalMessagesCount,finalChatId,currentChatId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      }, 1000) // Increased delay to ensure URL update and message clearing completes, and prevent chat reload
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
    if (isDomainSwitchingRef.current || isDomainSwitching) {
      console.log('[ChatLoad] Skipping chat load - domain switch in progress')
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:267',message:'Skipping chat load - domain switch',data:{isDomainSwitchingRef:isDomainSwitchingRef.current,isDomainSwitching},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      return
    }
    
    const chatId = searchParams.get('chatId')
    if (chatId && chatId !== currentChatId) {
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:273',message:'Attempting to load chat',data:{chatId,currentChatId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
      handleLoadChat(chatId)
    }
  }, [searchParams, currentChatId, handleLoadChat, isDomainSwitching])

  // Auto-save chat when messages change (but NOT during domain switch)
  useEffect(() => {
    // Don't auto-save during domain switch
    if (isDomainSwitchingRef.current || isDomainSwitching) {
      return
    }
    
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
  }, [messages, isAuthenticated, saveCurrentChat, isDomainSwitching])

  const handleNewChat = async () => {
    // Save current chat before clearing (with current domain)
    if (isAuthenticated && messages.length > 0) {
      await saveCurrentChat()
    }
    // Clear messages and chat ID to start fresh session
    clearMessages()
    setMessages([])
    setCurrentChatId(null)
    // Remove chatId from URL if present
    const currentChatIdParam = searchParams.get('chatId')
    if (currentChatIdParam) {
      router.replace(`/domain/${domainId}`, { scroll: false })
    }
  }

  // Map domain ID for display
  const displayDomainId = domainMap[domainId] || domainId
  const isAcademic = displayDomainId === 'academic'
  const isGeneral = displayDomainId === 'general'
  const isSuperUser = user?.role === 'super_user' || user?.role === 'admin'
  
  // Debug: Log render state
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:315',message:'Component render state',data:{domainId,displayDomainId,isDomainSwitching,messagesLength:messages.length,currentChatId,shouldShowBlank:isDomainSwitching || (messages.length === 0 && !currentChatId)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
  }, [domainId, displayDomainId, isDomainSwitching, messages.length, currentChatId])

  return (
    <>
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 overflow-hidden">
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
        <div className={`flex-1 flex flex-col transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'lg:ml-80' : 'lg:ml-0'}`}>
          {/* Header with Domain Switcher and Theme Toggle */}
          <div className="flex-shrink-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
              <DomainSwitcher currentDomain={displayDomainId} />
              <div className="flex items-center gap-3">
                {isGeneral && (
                  <button
                    onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    {showKnowledgeBase ? 'Hide' : 'Show'} Knowledge Base
                  </button>
                )}
                <ThemeToggle />
              </div>
            </div>
          </div>

          {/* Main Content - Scrollable Container */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto overflow-x-hidden">
              <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              {isGeneral && showKnowledgeBase ? (
                // General Domain Knowledge Base View
                <div className="space-y-6">
                  {isSuperUser && (
                    <>
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <GeneralDomainUpload 
                          userId={user?.id || ''}
                          userRole={user?.role}
                          onUploadComplete={() => {
                            // Refresh knowledge base after upload
                            setShowKnowledgeBase(true)
                          }}
                        />
                      </div>
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                        <GroupManager 
                          userId={user?.id || ''}
                          userRole={user?.role}
                        />
                      </div>
                    </>
                  )}
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                    <GeneralDomainKnowledgeBase 
                      userId={user?.id || ''} 
                      userRole={user?.role}
                    />
                  </div>
                </div>
              ) : isAcademic ? (
                // Academic domain always shows ResearchPanel with search bar
                <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>}>
                  <ResearchPanel />
                </Suspense>
              ) : (() => {
                const shouldShowBlank = isDomainSwitching || (messages.length === 0 && !currentChatId)
                // Log condition check (only log on render, not on every evaluation)
                if (typeof window !== 'undefined') {
                  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/domain/[domain]/page.tsx:444',message:'Blank page condition check',data:{isDomainSwitching,messagesLength:messages.length,currentChatId,shouldShowBlank},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                }
                return shouldShowBlank
              })() ? (
                // Show blank page during domain switch or when starting fresh (for non-academic domains)
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
              ) : (
                <ChatWindow />
              )}
              </div>
            </div>
          </div>

          {/* Input Section - Only show for non-academic domains */}
          {!isAcademic && (
            <div className="flex-shrink-0 z-30 border-t border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
              <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
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
