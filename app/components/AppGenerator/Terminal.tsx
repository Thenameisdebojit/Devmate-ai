'use client'

import { useEffect, useRef, useState } from 'react'
import { FiTerminal } from 'react-icons/fi'

interface TerminalProps {
  projectId?: string
  onReady?: () => void
}

export default function Terminal({ projectId, onReady }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const xtermInstanceRef = useRef<any>(null)
  const fitAddonRef = useRef<any>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!terminalRef.current || !projectId) return

    let mounted = true

    // Dynamically load xterm.js
    let cleanupFn: (() => void) | null = null

    const initTerminal = async () => {
      try {
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import('@xterm/xterm'),
          import('@xterm/addon-fit'),
        ])
        await import('@xterm/xterm/css/xterm.css')

        if (!mounted || !terminalRef.current) return

        // Initialize xterm.js
        const xterm = new Terminal({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Monaco, Courier New, monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#aeafad',
            selection: '#264f78',
          },
        })

        const fitAddon = new FitAddon()
        xterm.loadAddon(fitAddon)

        xterm.open(terminalRef.current)
        fitAddon.fit()

        xtermInstanceRef.current = xterm
        fitAddonRef.current = fitAddon
        setIsLoading(false)

        // Connect to terminal stream
        const eventSource = new EventSource(`/api/runtime/terminal/attach?projectId=${projectId}`)
        eventSourceRef.current = eventSource

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'output') {
              xterm.write(data.data)
            } else if (data.type === 'error') {
              xterm.write(`\x1b[31m${data.data}\x1b[0m`) // Red text
            } else if (data.type === 'connected') {
              setIsConnected(true)
              onReady?.()
            }
          } catch (error) {
            console.error('Terminal message error:', error)
          }
        }

        eventSource.onerror = () => {
          setIsConnected(false)
          xterm.write('\r\n\x1b[31mConnection lost. Reconnecting...\x1b[0m\r\n')
        }

        // Handle terminal input
        xterm.onData((data: string) => {
          // Send input to server
          fetch('/api/runtime/terminal/attach', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, input: data }),
          }).catch((error) => {
            console.error('Failed to send terminal input:', error)
          })
        })

        // Handle resize
        const handleResize = () => {
          fitAddon.fit()
        }
        window.addEventListener('resize', handleResize)

        // Store cleanup function
        cleanupFn = () => {
          window.removeEventListener('resize', handleResize)
          eventSource.close()
          xterm.dispose()
        }
      } catch (error) {
        console.error('Failed to load xterm.js:', error)
        setIsLoading(false)
      }
    }

    initTerminal()

    return () => {
      mounted = false
      eventSourceRef.current?.close()
      if (xtermInstanceRef.current) {
        xtermInstanceRef.current.dispose()
      }
      if (cleanupFn) {
        cleanupFn()
      }
    }
  }, [projectId, onReady])

  return (
    <div className="h-full bg-gray-900 p-2 relative">
      <div ref={terminalRef} className="h-full" />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="text-green-400 text-sm">Loading terminal...</div>
        </div>
      )}
      {!isConnected && !isLoading && projectId && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
          <div className="text-green-400 text-sm">Connecting to terminal...</div>
        </div>
      )}
      {!projectId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <FiTerminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No terminal available</p>
            <p className="text-sm mt-1">Run the project to access terminal</p>
          </div>
        </div>
      )}
    </div>
  )
}
