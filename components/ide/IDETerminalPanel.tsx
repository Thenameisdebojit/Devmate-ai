'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { FiTerminal, FiX, FiPlus, FiChevronDown, FiMaximize2, FiMinimize2, FiTrash2 } from 'react-icons/fi'

interface TerminalTab {
  id: string
  name: string
  projectId: string
  createdAt: number
}

interface IDETerminalPanelProps {
  projectId?: string
  isVisible: boolean
  onClose: () => void
}

export default function IDETerminalPanel({ projectId, isVisible, onClose }: IDETerminalPanelProps) {
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [isMinimized, setIsMinimized] = useState(false)
  const terminalContainerRef = useRef<HTMLDivElement>(null)

  // Listen for new terminal requests
  useEffect(() => {
    const handleNewTerminal = (event: CustomEvent) => {
      if (event.detail.projectId === projectId && projectId) {
        const newTab: TerminalTab = {
          id: `terminal-${Date.now()}`,
          name: 'powershell',
          projectId: projectId,
          createdAt: Date.now(),
        }
        setTabs((prev) => [...prev, newTab])
        setActiveTabId(newTab.id)
        setIsMinimized(false)
      }
    }

    window.addEventListener('terminal-new', handleNewTerminal as EventListener)
    return () => window.removeEventListener('terminal-new', handleNewTerminal as EventListener)
  }, [projectId])

  const handleCloseTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id)
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
        onClose()
      }
      return newTabs
    })
  }, [activeTabId, onClose])

  const handleNewTerminal = useCallback(() => {
    if (!projectId) return
    const newTab: TerminalTab = {
      id: `terminal-${Date.now()}`,
      name: 'powershell',
      projectId: projectId,
      createdAt: Date.now(),
    }
    setTabs((prev) => [...prev, newTab])
    setActiveTabId(newTab.id)
    setIsMinimized(false)
  }, [projectId])

  if (!isVisible && tabs.length === 0) return null

  return (
    <div className={`flex flex-col border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 transition-all ${
      isMinimized ? 'h-8' : 'h-64'
    }`}>
      {/* Terminal Header */}
      <div className="h-8 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 flex items-center">
        {/* Tabs */}
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`h-full px-4 flex items-center gap-2 text-xs border-r border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${
                activeTabId === tab.id
                  ? 'bg-gray-200 dark:bg-gray-700 font-medium'
                  : 'bg-gray-100 dark:bg-gray-800'
              }`}
            >
              <FiTerminal className="w-3 h-3" />
              <span>{tab.name}</span>
              <button
                onClick={(e) => handleCloseTab(tab.id, e)}
                className="ml-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded p-0.5"
              >
                <FiX className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 px-2">
          <button
            onClick={handleNewTerminal}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="New Terminal"
          >
            <FiPlus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? <FiMaximize2 className="w-4 h-4" /> : <FiMinimize2 className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            title="Close Panel"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      {!isMinimized && (
        <div ref={terminalContainerRef} className="flex-1 min-h-0 relative">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`absolute inset-0 ${activeTabId === tab.id ? 'block' : 'hidden'}`}
            >
              <TerminalInstance
                projectId={tab.projectId}
                terminalId={tab.id}
                containerRef={terminalContainerRef}
              />
            </div>
          ))}
          {tabs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <FiTerminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No terminal open</p>
                <p className="text-sm mt-1">Click the + button or use Terminal → New Terminal</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Optimized Terminal Instance Component
function TerminalInstance({
  projectId,
  terminalId,
  containerRef,
}: {
  projectId: string
  terminalId: string
  containerRef: React.RefObject<HTMLDivElement>
}) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermInstanceRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const inputBufferRef = useRef<string>('')
  const outputBufferRef = useRef<string>('')
  const flushTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!terminalRef.current || !projectId) return

    let mounted = true

    const initTerminal = async () => {
      try {
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
        ])
        await import('@xterm/xterm/css/xterm.css')

        if (!mounted || !terminalRef.current) return

        // Initialize xterm.js with performance optimizations
        const xterm = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Consolas, "Courier New", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#aeafad',
            cursorAccent: '#000000',
            selection: '#264f78',
            selectionForeground: '#ffffff',
          },
          allowProposedApi: true,
          scrollback: 10000,
          tabStopWidth: 4,
          bellStyle: 'none',
          convertEol: true,
          disableStdin: false,
        })

        const fitAddon = new FitAddon()
        
        xterm.loadAddon(fitAddon)

        xterm.open(terminalRef.current)
        fitAddon.fit()

        xtermInstanceRef.current = xterm
        fitAddonRef.current = fitAddon

        // Connect to local terminal stream
        const eventSource = new EventSource(`/api/terminal/local?projectId=${projectId}`)
        eventSourceRef.current = eventSource

        // Buffered output handler for performance
        const flushOutput = () => {
          if (outputBufferRef.current && xtermInstanceRef.current) {
            xtermInstanceRef.current.write(outputBufferRef.current)
            outputBufferRef.current = ''
          }
          if (flushTimerRef.current) {
            clearTimeout(flushTimerRef.current)
            flushTimerRef.current = null
          }
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'output') {
              // Buffer output for performance
              outputBufferRef.current += data.data
              if (!flushTimerRef.current) {
                flushTimerRef.current = setTimeout(flushOutput, 16) // ~60fps
              }
            } else if (data.type === 'error') {
              xterm.write(`\x1b[31m${data.data}\x1b[0m`)
            } else if (data.type === 'connected') {
              setIsConnected(true)
              xterm.write('\x1b[32mConnected to PowerShell terminal\x1b[0m\r\n')
            }
          } catch (error) {
            console.error('Terminal message error:', error)
          }
        }

        eventSource.onerror = () => {
          setIsConnected(false)
          xterm.write('\r\n\x1b[31mConnection lost. Reconnecting...\x1b[0m\r\n')
        }

        // Handle terminal input - send immediately for responsiveness (no debounce)
        xterm.onData((data: string) => {
          fetch('/api/terminal/local', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, input: data }),
          }).catch((error) => {
            console.error('Failed to send terminal input:', error)
          })
        })

        // Listen for terminal commands (from run/debug buttons)
        const handleTerminalCommand = (event: CustomEvent) => {
          if (event.detail.projectId === projectId && event.detail.command) {
            // Write command to terminal
            xterm.write('\r\n') // New line
            xterm.write(`\x1b[33m> ${event.detail.command}\x1b[0m\r\n`) // Show command in yellow
            fetch('/api/terminal/local', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ projectId, input: event.detail.command + '\r\n' }),
            }).catch((error) => {
              console.error('Failed to send terminal command:', error)
            })
          }
        }
        window.addEventListener('terminal-command', handleTerminalCommand as EventListener)

        // Handle resize with debouncing
        let resizeTimer: NodeJS.Timeout | null = null
        const handleResize = () => {
          if (resizeTimer) clearTimeout(resizeTimer)
          resizeTimer = setTimeout(() => {
            fitAddon.fit()
            const dimensions = fitAddon.proposeDimensions()
            if (dimensions) {
              fetch('/api/terminal/local', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  projectId,
                  resize: { cols: dimensions.cols, rows: dimensions.rows },
                }),
              }).catch((error) => {
                console.error('Failed to send resize:', error)
              })
            }
            resizeTimer = null
          }, 150)
        }

        // Use ResizeObserver for better performance
        let resizeObserver: ResizeObserver | null = null
        if (containerRef.current) {
          resizeObserver = new ResizeObserver(handleResize)
          resizeObserver.observe(containerRef.current)
        }

        window.addEventListener('resize', handleResize)
        
        return () => {
          if (resizeObserver) {
            resizeObserver.disconnect()
          }
          window.removeEventListener('resize', handleResize)
          window.removeEventListener('terminal-command', handleTerminalCommand as EventListener)
          if (resizeTimer) clearTimeout(resizeTimer)
          if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
          eventSource.close()
          xterm.dispose()
        }
      } catch (error) {
        console.error('Failed to load terminal:', error)
      }
    }

    initTerminal()

    return () => {
      mounted = false
      eventSourceRef.current?.close()
      if (xtermInstanceRef.current) {
        xtermInstanceRef.current.dispose()
      }
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
      }
    }
  }, [projectId, terminalId, containerRef])

  return (
    <div ref={terminalRef} className="h-full w-full bg-gray-900 p-2" />
  )
}
