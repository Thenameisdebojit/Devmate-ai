/**
 * Editor Sensor
 * 
 * Captures editor signals and feeds them to workspace daemon.
 * Makes editor a sensor, not just a view.
 */

'use client'

import { useEffect, useRef } from 'react'
import { getWorkspaceDaemon } from '@/core/workspace'

interface EditorSensorProps {
  projectId?: string
  activeFilePath?: string
  cursorPosition?: { line: number; column: number }
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } }
  content?: string
  errors?: Array<{ line: number; column: number; message: string; severity: 'error' | 'warning' }>
}

export default function EditorSensor({
  projectId,
  activeFilePath,
  cursorPosition,
  selection,
  content,
  errors,
}: EditorSensorProps) {
  const daemonRef = useRef<ReturnType<typeof getWorkspaceDaemon> | null>(null)
  const lastCursorRef = useRef<{ line: number; column: number } | undefined>()

  useEffect(() => {
    if (!projectId) return

    daemonRef.current = getWorkspaceDaemon(projectId)

    return () => {
      // Daemon persists, no cleanup needed
    }
  }, [projectId])

  // Track file focus changes - dispatch to core workspace daemon
  useEffect(() => {
    if (!daemonRef.current || !activeFilePath) return
    daemonRef.current.dispatch({
      type: 'EDITOR_FOCUS_CHANGED',
      payload: { filePath: activeFilePath },
    })
  }, [activeFilePath])

  // Track cursor movement - dispatch to core workspace daemon
  useEffect(() => {
    if (!daemonRef.current || !cursorPosition) return
    
    // Only emit if cursor actually moved
    if (
      !lastCursorRef.current ||
      lastCursorRef.current.line !== cursorPosition.line ||
      lastCursorRef.current.column !== cursorPosition.column
    ) {
      daemonRef.current.dispatch({
        type: 'EDITOR_CURSOR_MOVED',
        payload: { line: cursorPosition.line, column: cursorPosition.column },
      })
      lastCursorRef.current = cursorPosition
    }
  }, [cursorPosition])

  // Track file content changes - dispatch to core workspace daemon
  useEffect(() => {
    if (!daemonRef.current || !activeFilePath || content === undefined) return
    daemonRef.current.dispatch({
      type: 'FILE_CHANGED',
      payload: { path: activeFilePath, content },
    })
  }, [activeFilePath, content])

  return null // This component doesn't render anything
}

