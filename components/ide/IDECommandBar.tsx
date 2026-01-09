'use client'

/**
 * PHASE 1: Command-Driven UX (Refactored)
 * 
 * Compact chat box matching the reference design.
 * Input field on top, controls below in a single row.
 * Features: @ for context, Globe for browser, Image for upload
 */

import { useState, useRef } from 'react'
import { FiSend, FiImage, FiGlobe, FiAtSign, FiRepeat } from 'react-icons/fi'
import { motion } from 'framer-motion'

export type CommandAction = 'generate' | 'run' | 'fix' | 'explain'

interface IDECommandBarProps {
  onCommand: (action: CommandAction, input?: string, context?: { type: string; data: any }) => void
  disabled?: boolean
  isProcessing?: boolean
}

export default function IDECommandBar({
  onCommand,
  disabled = false,
  isProcessing = false,
}: IDECommandBarProps) {
  const [input, setInput] = useState('')
  const [autoMode, setAutoMode] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [contextMenu, setContextMenu] = useState<'@' | 'globe' | 'image' | null>(null)
  const [pendingImageContext, setPendingImageContext] = useState<{ type: string; data: any } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (disabled || isProcessing || (!input.trim() && !pendingImageContext)) return

    // Get pending image context if available
    const imageContext = pendingImageContext

    // Infer action from input - default to generate for natural language
    const lowerInput = input.toLowerCase()
    let action: CommandAction = 'generate'
    
    if (lowerInput.includes('run') || lowerInput.includes('execute') || lowerInput.includes('start')) {
      action = 'run'
    } else if (lowerInput.includes('fix') || lowerInput.includes('error') || lowerInput.includes('bug')) {
      action = 'fix'
    } else if (lowerInput.includes('explain') || lowerInput.includes('what') || lowerInput.includes('how')) {
      action = 'explain'
    } else {
      // Default: generate (build, create, make, etc.)
      action = 'generate'
    }

    // Send command with image context if available
    onCommand(action, input.trim() || (imageContext ? 'Analyze this image' : ''), imageContext || undefined)
    
    // Clear input and pending image
    setInput('')
    setPendingImageContext(null)
    setContextMenu(null)
  }

  // Handle @ mention - Add context
  const handleMention = () => {
    setContextMenu(contextMenu === '@' ? null : '@')
  }

  // Handle Globe - Connect to Browser / Web Search
  const handleGlobe = () => {
    setContextMenu(contextMenu === 'globe' ? null : 'globe')
    // If menu is opening, show options
    if (contextMenu !== 'globe') {
      // In a real implementation, this would open a browser connection dialog
      // For now, we'll add a web search indicator to the input
      if (!input.includes('[Web Search]')) {
        setInput(prev => prev + ' [Web Search Enabled]')
      }
    }
  }

  // Handle Image Upload
  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Convert to base64 for preview/attachment (don't auto-send)
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      
      // Store image context in state (don't send automatically)
      // User must click send button to send with image
      const imageContext = {
        type: 'image',
        data: {
          base64,
          filename: file.name,
          mimeType: file.type,
        },
      }
      
      // Store image context in state for when user clicks send
      setPendingImageContext(imageContext)
      
      // Update input to show image is attached (but don't auto-send)
      setInput(prev => {
        // Remove any existing image marker
        const cleaned = prev.replace(/\[Image:.*?\]/g, '').trim()
        return cleaned ? `${cleaned} [Image: ${file.name}]` : `[Image: ${file.name}]`
      })
      
      setContextMenu(null)
    }
    reader.readAsDataURL(file)
    
    // Reset file input so same file can be selected again
    e.target.value = ''
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="p-2">
        {/* Input Field - Full Width on Top */}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Plan, @ for context, / for commands"
          disabled={disabled || isProcessing}
          className="w-full px-3 py-2 mb-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />

        {/* Context Menu for @ mention */}
        {contextMenu === '@' && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
            <div className="font-semibold mb-1">Add Context:</div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setInput(prev => prev + ' @files')
                  setContextMenu(null)
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                @files - Include all files
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput(prev => prev + ' @errors')
                  setContextMenu(null)
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                @errors - Include errors
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput(prev => prev + ' @terminal')
                  setContextMenu(null)
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                @terminal - Include terminal output
              </button>
            </div>
          </div>
        )}

        {/* Context Menu for Globe */}
        {contextMenu === 'globe' && (
          <div className="mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
            <div className="font-semibold mb-1">Browser Connection:</div>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setInput(prev => prev + ' [Connect to Browser]')
                  setContextMenu(null)
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                Connect to Browser - Access current page
              </button>
              <button
                type="button"
                onClick={() => {
                  setInput(prev => prev + ' [Web Search]')
                  setContextMenu(null)
                }}
                className="w-full text-left px-2 py-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                Web Search - Search the web
              </button>
            </div>
          </div>
        )}

        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Controls Row - Compact, Below Input */}
        <div className="flex items-center gap-2">
          {/* Auto Mode Toggle with Dropdown */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg px-2 py-1">
            <button
              type="button"
              onClick={() => setAutoMode(!autoMode)}
              className={`p-1 rounded transition-colors ${
                autoMode
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
              title="Auto mode"
            >
              <FiRepeat className="w-3.5 h-3.5" />
            </button>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="text-xs bg-transparent border-none text-gray-600 dark:text-gray-400 focus:outline-none cursor-pointer"
              title="Speed"
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Feature Icons - Compact */}
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleMention}
              className={`p-1.5 rounded transition-colors ${
                contextMenu === '@'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
              title="Add context (@)"
            >
              <FiAtSign className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleGlobe}
              className={`p-1.5 rounded transition-colors ${
                contextMenu === 'globe'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
              }`}
              title="Connect to Browser / Web Search"
            >
              <FiGlobe className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleImageClick}
              className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded transition-colors"
              title="Upload Image"
            >
              <FiImage className="w-4 h-4" />
            </button>
          </div>

          {/* Send Button - Icon Only, Compact */}
          <button
            type="submit"
            disabled={disabled || isProcessing || !input.trim()}
            className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            title="Send"
          >
            {isProcessing ? (
              <motion.div
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            ) : (
              <FiSend className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
