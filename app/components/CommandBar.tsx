'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Fuse from 'fuse.js'
import { loadAllTemplates, type PromptTemplate } from '../utils/promptTemplates'
import toast from 'react-hot-toast'

interface Command {
  id: string
  title: string
  description: string
  action: () => void
  icon?: string
  category: string
}

interface CommandBarProps {
  isOpen: boolean
  onClose: () => void
  onSelectAction?: (action: 'generate' | 'explain' | 'rewrite' | 'fix') => void
  onClearConversation?: () => void
  onExportConversation?: () => void
  onToggleTheme?: () => void
}

export default function CommandBar({
  isOpen,
  onClose,
  onSelectAction,
  onClearConversation,
  onExportConversation,
  onToggleTheme,
}: CommandBarProps) {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [commands, setCommands] = useState<Command[]>([])
  const [filteredCommands, setFilteredCommands] = useState<Command[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const fuseRef = useRef<Fuse<Command> | null>(null)

  // Load templates and build commands
  useEffect(() => {
    const buildCommands = async () => {
      const templates = await loadAllTemplates()
      
      const baseCommands: Command[] = [
        {
          id: 'clear',
          title: 'Clear Conversation',
          description: 'Clear all messages from the current conversation',
          action: () => {
            onClearConversation?.()
            onClose()
            toast.success('Conversation cleared')
          },
          icon: '🗑️',
          category: 'Actions',
        },
        {
          id: 'export',
          title: 'Export Conversation',
          description: 'Download conversation as a text file',
          action: () => {
            onExportConversation?.()
            onClose()
          },
          icon: '📥',
          category: 'Actions',
        },
        {
          id: 'theme',
          title: 'Toggle Theme',
          description: 'Switch between dark, light, and system theme',
          action: () => {
            onToggleTheme?.()
            onClose()
          },
          icon: '🎨',
          category: 'Settings',
        },
      ]

      const templateCommands: Command[] = templates.map((template) => ({
        id: template.action,
        title: template.name,
        description: template.description,
        action: () => {
          onSelectAction?.(template.action)
          onClose()
          toast.success(`Switched to ${template.name}`)
        },
        icon: getIconForAction(template.action),
        category: 'Templates',
      }))

      const allCommands = [...templateCommands, ...baseCommands]
      setCommands(allCommands)
      setFilteredCommands(allCommands)

      // Initialize Fuse.js for fuzzy search
      fuseRef.current = new Fuse(allCommands, {
        keys: ['title', 'description', 'category'],
        threshold: 0.3,
        ignoreLocation: true,
      })
    }

    buildCommands()
  }, [onSelectAction, onClearConversation, onExportConversation, onToggleTheme, onClose])

  // Handle search
  useEffect(() => {
    if (!search.trim()) {
      setFilteredCommands(commands)
      setSelectedIndex(0)
      return
    }

    if (fuseRef.current) {
      const results = fuseRef.current.search(search)
      setFilteredCommands(results.map(r => r.item))
      setSelectedIndex(0)
    }
  }, [search, commands])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) {
      acc[cmd.category] = []
    }
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="command-bar-backdrop"
            aria-hidden="true"
          />

          {/* Command Bar */}
          <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-20 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="command-bar-content pointer-events-auto max-h-[600px] overflow-hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Command palette"
            >
              {/* Search Input */}
              <div className="p-4 border-b border-white/10 dark:border-white/10">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search commands..."
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-400"
                    aria-label="Search commands"
                    aria-autocomplete="list"
                    aria-controls="command-list"
                  />
                  <kbd className="px-2 py-1 text-xs font-medium text-gray-400 bg-gray-700/50 rounded">ESC</kbd>
                </div>
              </div>

              {/* Commands List */}
              <div 
                id="command-list"
                className="max-h-[400px] overflow-y-auto p-2"
                role="listbox"
              >
                {Object.keys(groupedCommands).length === 0 ? (
                  <div className="p-8 text-center text-gray-400">
                    No commands found
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, cmds]) => (
                    <div key={category} className="mb-4 last:mb-0">
                      <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {category}
                      </div>
                      {cmds.map((cmd, idx) => {
                        const globalIndex = filteredCommands.indexOf(cmd)
                        const isSelected = globalIndex === selectedIndex
                        
                        return (
                          <motion.button
                            key={cmd.id}
                            onClick={cmd.action}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                              isSelected
                                ? 'bg-devmate-accent text-white'
                                : 'hover:bg-white/10 dark:hover:bg-white/10 text-gray-200'
                            }`}
                            role="option"
                            aria-selected={isSelected}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                          >
                            {cmd.icon && <span className="text-xl">{cmd.icon}</span>}
                            <div className="flex-1 text-left">
                              <div className="font-medium">{cmd.title}</div>
                              <div className={`text-sm ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                                {cmd.description}
                              </div>
                            </div>
                          </motion.button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-white/10 dark:border-white/10 flex items-center justify-between text-xs text-gray-400">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-700/50 rounded">↑↓</kbd> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-gray-700/50 rounded">↵</kbd> Select
                  </span>
                </div>
                <span>Press <kbd className="px-1.5 py-0.5 bg-gray-700/50 rounded">Cmd/Ctrl+K</kbd> to open</span>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

function getIconForAction(action: string): string {
  const icons: Record<string, string> = {
    generate: '✨',
    explain: '📖',
    rewrite: '🔄',
    fix: '🔧',
  }
  return icons[action] || '💡'
}
