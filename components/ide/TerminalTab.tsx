/**
 * Terminal Tab Component
 * 
 * Individual terminal tab with session management.
 */

'use client'

import { useState, useEffect, useRef } from 'react'
import { FiX } from 'react-icons/fi'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import '@xterm/xterm/css/xterm.css'

interface TerminalTabProps {
  tabId: string
  projectId: string
  profile?: string
  theme?: string
  onReady?: () => void
  onClose?: () => void
}

export default function TerminalTab({
  tabId,
  projectId,
  profile = 'powershell',
  theme = 'dark-plus',
  onReady,
  onClose,
}: TerminalTabProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isSearchVisible, setIsSearchVisible] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const historyIndexRef = useRef<number>(-1)
  const currentInputRef = useRef<string>('')

  useEffect(() => {
    if (!terminalRef.current || !projectId) return

    let mounted = true

    const initTerminal = async () => {
      try {
        // Initialize xterm.js with default settings
        const xterm = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Consolas, "Courier New", monospace',
          lineHeight: 1.2,
          cursorStyle: 'block',
          scrollback: 10000,
          bellStyle: 'none',
          wordWrap: false,
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#aeafad',
            cursorAccent: '#000000',
            selection: '#264f78',
            selectionForeground: '#ffffff',
          },
          allowProposedApi: true,
        })

        // Load addons
        const fitAddon = new FitAddon()
        const searchAddon = new SearchAddon()
        const webLinksAddon = new WebLinksAddon()
        const unicode11Addon = new Unicode11Addon()

        xterm.loadAddon(fitAddon)
        xterm.loadAddon(searchAddon)
        xterm.loadAddon(webLinksAddon)
        xterm.loadAddon(unicode11Addon)

        xterm.unicode.activeVersion = '11'

        xterm.open(terminalRef.current!)
        fitAddon.fit()

        xtermRef.current = xterm
        fitAddonRef.current = fitAddon
        searchAddonRef.current = searchAddon

        // Connect to WebSocket (fallback to SSE if WebSocket not available)
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || `ws://localhost:${process.env.WS_PORT || 5001}`
        let ws: WebSocket | null = null
        let eventSource: EventSource | null = null
        let useSSE = false

        // Try WebSocket first, fallback to SSE
        const tryWebSocket = () => {
          try {
            // Check if we're in browser and WebSocket is available
            if (typeof WebSocket === 'undefined') {
              throw new Error('WebSocket not available')
            }

            ws = new WebSocket(`${wsUrl}/terminal?projectId=${projectId}`)
            wsRef.current = ws

            const wsTimeout = setTimeout(() => {
              if (ws && ws.readyState !== WebSocket.OPEN) {
                console.warn('[TerminalTab] WebSocket connection timeout, falling back to SSE')
                ws.close()
                connectSSE()
              }
            }, 3000)

            ws.onopen = () => {
              clearTimeout(wsTimeout)
              setIsConnected(true)
              // Create PTY session
              ws!.send(JSON.stringify({
                type: 'create-session',
                options: {
                  projectId,
                  shell: profile === 'powershell' ? 'powershell.exe' : undefined,
                },
              }))
              onReady?.()
            }

            ws.onmessage = (event) => {
              try {
                const data = JSON.parse(event.data)
                if (data.type === 'output') {
                  xterm.write(data.data)
                } else if (data.type === 'connected') {
                  setIsConnected(true)
                } else if (data.type === 'error') {
                  xterm.write(`\x1b[31m${data.error}\x1b[0m\r\n`)
                }
              } catch (error) {
                console.error('[TerminalTab] Error parsing WebSocket message:', error)
              }
            }

            ws.onerror = (error) => {
              clearTimeout(wsTimeout)
              console.warn('[TerminalTab] WebSocket error, falling back to SSE:', error)
              if (ws) {
                ws.close()
              }
              connectSSE()
            }

            ws.onclose = () => {
              clearTimeout(wsTimeout)
              setIsConnected(false)
              // Only reconnect with SSE if we weren't already using SSE
              if (!useSSE && mounted) {
                console.warn('[TerminalTab] WebSocket closed, falling back to SSE')
                connectSSE()
              }
            }
          } catch (error) {
            console.warn('[TerminalTab] WebSocket not available, using SSE fallback:', error)
            connectSSE()
          }
        }

        // SSE fallback function
        function connectSSE() {
          if (useSSE && eventSource && eventSource.readyState === EventSource.OPEN) {
            console.log('[TerminalTab] SSE already connected, skipping')
            return
          }
          useSSE = true

          if (eventSource) {
            eventSource.close()
            eventSource = null
          }

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:173',message:'Connecting to SSE',data:{projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
          // #endregion
          console.log('[TerminalTab] Connecting to SSE:', { projectId })

          eventSource = new EventSource(`/api/terminal/local?projectId=${projectId}`)
          
          // Set a timeout to close SSE if it doesn't connect within 10 seconds
          const sseTimeout = setTimeout(() => {
            if (eventSource && eventSource.readyState !== EventSource.OPEN) {
              console.warn('[TerminalTab] SSE connection timeout, closing')
              eventSource.close()
              setIsConnected(false)
            }
          }, 10000)

          eventSource.onopen = () => {
            clearTimeout(sseTimeout)
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:188',message:'SSE connection opened',data:{projectId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
            // #endregion
            console.log('[TerminalTab] SSE connection opened')
            setIsConnected(true)
            onReady?.()
          }
          
          eventSource.onmessage = (event) => {
            try {
              // Handle heartbeat comments
              if (event.data.trim() === '' || event.data.startsWith(':')) {
                return
              }
              
              const data = JSON.parse(event.data)
              if (data.type === 'output') {
                xterm.write(data.data)
              } else if (data.type === 'connected') {
                clearTimeout(sseTimeout)
                setIsConnected(true)
                onReady?.()
              } else if (data.type === 'error') {
                xterm.write(`\x1b[31m${data.data}\x1b[0m\r\n`)
              }
            } catch (error) {
              console.error('[TerminalTab] Error parsing SSE message:', error)
            }
          }

          eventSource.onerror = (error) => {
            clearTimeout(sseTimeout)
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:210',message:'SSE connection error',data:{projectId,readyState:eventSource?.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
            // #endregion
            console.error('[TerminalTab] SSE connection error:', { readyState: eventSource?.readyState })
            setIsConnected(false)
            
            // Close and cleanup
            if (eventSource) {
              eventSource.close()
              eventSource = null
            }
            
            // Only reconnect if component is still mounted and we haven't exceeded retry limit
            if (mounted) {
              // Don't auto-reconnect - let user manually retry or use WebSocket
              console.warn('[TerminalTab] SSE connection failed, not auto-reconnecting')
            }
          }
        }

        // Try WebSocket first
        tryWebSocket()

        // Handle terminal input
        xterm.onData(async (data: string) => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'input',
              data,
            }))
          } else if (useSSE) {
            // Use POST for SSE fallback
            fetch('/api/terminal/local', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId, input: data }),
            }).catch(console.error)
          }

          // Handle history navigation (basic implementation)
          // Full history will be managed server-side
          if (data === '\r') { // Enter
            // Save current input for history (will be saved server-side)
            if (currentInputRef.current.trim()) {
              // History is managed server-side via PTYManager
            }
            historyIndexRef.current = -1
            currentInputRef.current = ''
          } else if (data.length === 1 && data >= ' ') {
            // Regular character input
            currentInputRef.current += data
          }
        })

        // Handle terminal commands from Run button
        const handleTerminalCommand = (event: CustomEvent) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:247',message:'terminal-command event received',data:{hasDetail:!!event.detail,projectId:event.detail?.projectId||'null',expectedProjectId:projectId,command:event.detail?.command||'null',commandLength:event.detail?.command?.length||0,isConnected,useSSE,wsReady:ws?.readyState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
          // #endregion
          console.log('[TerminalTab] terminal-command event received:', { 
            hasDetail: !!event.detail,
            projectId: event.detail?.projectId,
            expectedProjectId: projectId,
            command: event.detail?.command,
            commandLength: event.detail?.command?.length,
            isConnected,
            useSSE,
            wsReady: ws?.readyState
          })
          
          if (event.detail?.projectId === projectId && event.detail?.command) {
            let cmd = event.detail.command.trim()
            
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:262',message:'Processing command',data:{cmd,cmdLength:cmd.length,hasAnd:cmd.includes('&&')},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
            
            if (!cmd || cmd.length === 0) {
              console.error('[TerminalTab] Received empty command after trim')
              return
            }
            
            // Clean up command: replace any && with PowerShell syntax (safety check)
            if (cmd.includes('&&')) {
              console.warn('[TerminalTab] Command contains &&, converting to PowerShell syntax')
              cmd = cmd.replace(/ && /g, '; if ($?) { ')
              const openBraces = (cmd.match(/if \(\$?\) \{/g) || []).length
              const closeBraces = (cmd.match(/\}/g) || []).length
              if (openBraces > closeBraces) {
                cmd += ' }'.repeat(openBraces - closeBraces)
              }
            }

            // Send command to terminal with retry logic
            const sendCommand = () => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:280',message:'Sending command via WebSocket',data:{cmd,cmdLength:cmd.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
                // #endregion
                console.log('[TerminalTab] Sending command via WebSocket:', cmd)
                ws.send(JSON.stringify({
                  type: 'input',
                  data: cmd + '\r\n',
                }))
              } else if (useSSE && isConnected) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:288',message:'Sending command via SSE',data:{cmd,cmdLength:cmd.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
                // #endregion
                console.log('[TerminalTab] Sending command via SSE:', cmd)
                fetch('/api/terminal/local', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ projectId, input: cmd + '\r\n' }),
                })
                .then(res => {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:295',message:'SSE command response',data:{ok:res.ok,status:res.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
                  // #endregion
                  console.log('[TerminalTab] SSE command response:', { ok: res.ok, status: res.status })
                })
                .catch(err => {
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:300',message:'SSE command error',data:{error:err.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
                  // #endregion
                  console.error('[TerminalTab] SSE command error:', err)
                })
              } else {
                // Terminal not ready, wait and retry (up to 5 times)
                console.warn('[TerminalTab] Terminal not ready, will retry:', { isConnected, useSSE, wsReady: ws?.readyState })
                let retries = 0
                const maxRetries = 5
                const retryInterval = setInterval(() => {
                  retries++
                  if (retries > maxRetries) {
                    clearInterval(retryInterval)
                    console.error('[TerminalTab] Failed to send command after retries')
                    return
                  }
                  
                  if ((ws && ws.readyState === WebSocket.OPEN) || (useSSE && isConnected)) {
                    clearInterval(retryInterval)
                    sendCommand()
                  }
                }, 500)
              }
            }
            
            sendCommand()
          } else {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'TerminalTab.tsx:320',message:'Command rejected',data:{projectIdMatch:event.detail?.projectId===projectId,hasCommand:!!event.detail?.command},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
            // #endregion
            console.warn('[TerminalTab] Command rejected:', { 
              projectIdMatch: event.detail?.projectId === projectId,
              hasCommand: !!event.detail?.command 
            })
          }
        }

        window.addEventListener('terminal-command', handleTerminalCommand as EventListener)

        // Handle resize
        const handleResize = () => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit()
            const dimensions = fitAddonRef.current.proposeDimensions()
            if (dimensions) {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'resize',
                  cols: dimensions.cols,
                  rows: dimensions.rows,
                }))
              } else if (useSSE) {
                fetch('/api/terminal/local', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    projectId,
                    resize: { cols: dimensions.cols, rows: dimensions.rows },
                  }),
                }).catch(console.error)
              }
            }
          }
        }

        window.addEventListener('resize', handleResize)
        const resizeObserver = new ResizeObserver(handleResize)
        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current)
        }

        return () => {
          mounted = false
          if (ws) {
            ws.close()
            ws = null
          }
          if (eventSource) {
            eventSource.close()
            eventSource = null
          }
          window.removeEventListener('terminal-command', handleTerminalCommand as EventListener)
          window.removeEventListener('resize', handleResize)
          resizeObserver.disconnect()
          if (xtermRef.current) {
            xtermRef.current.dispose()
          }
        }
      } catch (error) {
        console.error('[TerminalTab] Failed to initialize terminal:', error)
      }
    }

    initTerminal()
  }, [tabId, projectId, profile, theme, onReady])

  // Search functionality
  const handleSearch = (query: string, next: boolean = true) => {
    if (searchAddonRef.current && xtermRef.current) {
      if (next) {
        searchAddonRef.current.findNext(query)
      } else {
        searchAddonRef.current.findPrevious(query)
      }
    }
  }

  return (
    <div className="h-full w-full flex flex-col">
      <div ref={terminalRef} className="flex-1 w-full bg-gray-900 p-2" />
      
      {/* Search Overlay */}
      {isSearchVisible && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 border border-gray-700 rounded px-4 py-2 flex items-center gap-2 z-10">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              handleSearch(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSearch(searchQuery, !e.shiftKey)
              } else if (e.key === 'Escape') {
                setIsSearchVisible(false)
                setSearchQuery('')
              }
            }}
            placeholder="Search..."
            className="bg-gray-900 text-white px-2 py-1 rounded text-sm"
            autoFocus
          />
          <button
            onClick={() => handleSearch(searchQuery, false)}
            className="px-2 py-1 text-xs text-gray-400 hover:text-white"
          >
            ↑
          </button>
          <button
            onClick={() => handleSearch(searchQuery, true)}
            className="px-2 py-1 text-xs text-gray-400 hover:text-white"
          >
            ↓
          </button>
          <button
            onClick={() => {
              setIsSearchVisible(false)
              setSearchQuery('')
            }}
            className="px-2 py-1 text-gray-400 hover:text-white"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
