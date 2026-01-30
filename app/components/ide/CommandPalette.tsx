/**
 * PHASE 2: Command Palette Component
 * 
 * VS Code-identical command palette (Cmd/Ctrl+Shift+P).
 * Keyboard navigation required. Fuzzy search.
 */

'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { IDECommand } from '@/lib/ide/commands/CommandRegistry'

interface CommandPaletteProps {
  projectId?: string
  isOpen: boolean
  onClose: () => void
  onCommandExecuted?: (commandId: string) => void
}

export default function CommandPalette({ 
  projectId, 
  isOpen, 
  onClose, 
  onCommandExecuted 
}: CommandPaletteProps) {
  const [commands, setCommands] = useState<IDECommand[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load commands
  async function loadCommands() {
    try {
      const res = await fetch('/api/commands/list')
      const data = await res.json()
      setCommands(data.commands || [])
    } catch (error: any) {
      console.error('[CommandPalette] Failed to load commands:', error)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadCommands()
      // Focus input when opened
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      setSearchQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Filter commands by search query (defined BEFORE useEffects that use it)
  const filteredCommands = useMemo(() => {
    if (!searchQuery) {
      return commands
    }

    const query = searchQuery.toLowerCase()
    return commands.filter(cmd =>
      cmd.title.toLowerCase().includes(query) ||
      cmd.id.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
    )
  }, [commands, searchQuery])

  // Reset selected index when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery, filteredCommands.length])

  // Execute command function (useCallback to prevent recreation on each render)
  const executeCommand = useCallback(async (commandId: string) => {
    try {
      const res = await fetch('/api/commands/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, context: { projectId } }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to execute command')
      }

      onCommandExecuted?.(commandId)
      onClose()
    } catch (error: any) {
      console.error('[CommandPalette] Failed to execute command:', error)
      alert(`Failed to execute command: ${error.message}`)
    }
  }, [projectId, onCommandExecuted, onClose])

  // Keyboard shortcuts (defined AFTER filteredCommands and executeCommand)
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => {
          if (filteredCommands.length === 0) return 0
          return Math.min(prev + 1, filteredCommands.length - 1)
        })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        return
      }

      if (e.key === 'Enter' && filteredCommands.length > 0 && filteredCommands[selectedIndex]) {
        e.preventDefault()
        executeCommand(filteredCommands[selectedIndex].id)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredCommands, executeCommand, onClose])

  if (!isOpen) return null

  // Group commands by category
  const commandsByCategory = useMemo(() => {
    const groups: Record<string, IDECommand[]> = {}
    filteredCommands.forEach(cmd => {
      if (!groups[cmd.category]) {
        groups[cmd.category] = []
      }
      groups[cmd.category].push(cmd)
    })
    return groups
  }, [filteredCommands])

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <style jsx>{`
        .command-palette-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 10vh;
          z-index: 10000;
        }

        .command-palette {
          width: 600px;
          max-height: 70vh;
          background: var(--vscode-quickInput-background, #252526);
          border: 1px solid var(--vscode-quickInput-border, #454545);
          border-radius: 2px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .command-palette-input {
          padding: 12px;
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--vscode-quickInput-border, #454545);
          color: var(--vscode-input-foreground, #cccccc);
          font-size: 14px;
          outline: none;
        }

        .command-palette-input::placeholder {
          color: var(--vscode-input-placeholderForeground, #6a6a6a);
        }

        .command-palette-list {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }

        .command-group {
          margin-bottom: 8px;
        }

        .command-group-header {
          padding: 4px 12px;
          font-size: 11px;
          font-weight: 600;
          color: var(--vscode-descriptionForeground, #969696);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .command-item {
          padding: 8px 12px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .command-item:hover,
        .command-item.selected {
          background: var(--vscode-list-hoverBackground, #2a2d2e);
        }

        .command-item.selected {
          background: var(--vscode-list-activeSelectionBackground, #094771);
        }

        .command-title {
          font-size: 13px;
          color: var(--vscode-foreground, #cccccc);
        }

        .command-item.selected .command-title {
          color: var(--vscode-list-activeSelectionForeground, #ffffff);
        }

        .command-keybinding {
          font-size: 11px;
          color: var(--vscode-descriptionForeground, #969696);
        }

        .command-empty {
          padding: 24px;
          text-align: center;
          color: var(--vscode-descriptionForeground, #969696);
          font-size: 13px;
        }
      `}</style>

      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          type="text"
          className="command-palette-input"
          placeholder="Type command name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="command-palette-list">
          {filteredCommands.length === 0 ? (
            <div className="command-empty">No commands found</div>
          ) : (
            Object.entries(commandsByCategory).map(([category, categoryCommands]) => (
              <div key={category} className="command-group">
                <div className="command-group-header">{category}</div>
                {categoryCommands.map((cmd, index) => {
                  const globalIndex = filteredCommands.indexOf(cmd)
                  return (
                    <div
                      key={cmd.id}
                      className={`command-item ${globalIndex === selectedIndex ? 'selected' : ''}`}
                      onClick={() => executeCommand(cmd.id)}
                      onMouseEnter={() => setSelectedIndex(globalIndex)}
                    >
                      <div className="command-title">{cmd.title}</div>
                      {cmd.keybinding && (
                        <div className="command-keybinding">{cmd.keybinding}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
