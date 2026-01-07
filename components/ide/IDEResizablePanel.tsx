'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface IDEResizablePanelProps {
  children: ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  onResize?: (width: number) => void
  direction?: 'horizontal' | 'vertical'
}

export default function IDEResizablePanel({
  children,
  defaultWidth = 300,
  minWidth = 200,
  maxWidth = 800,
  onResize,
  direction = 'horizontal',
}: IDEResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (direction === 'horizontal') {
        const newWidth = e.clientX
        const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
        setWidth(clampedWidth)
        onResize?.(clampedWidth)
      } else {
        const newHeight = window.innerHeight - e.clientY
        const clampedHeight = Math.max(minWidth, Math.min(maxWidth, newHeight))
        setWidth(clampedHeight)
        onResize?.(clampedHeight)
      }
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minWidth, maxWidth, direction, onResize])

  return (
    <div
      ref={panelRef}
      className="relative flex-shrink-0 flex"
      style={{
        width: direction === 'horizontal' ? `${width}px` : '100%',
        height: direction === 'vertical' ? `${width}px` : '100%',
      }}
    >
      <div className="flex-1 min-w-0 min-h-0">
        {children}
      </div>
      <div
        className={`flex-shrink-0 ${
          direction === 'horizontal'
            ? 'w-1 cursor-col-resize hover:bg-blue-500'
            : 'h-1 cursor-row-resize hover:bg-blue-500'
        } transition-colors ${isResizing ? 'bg-blue-500' : 'bg-transparent'}`}
        onMouseDown={(e) => {
          e.preventDefault()
          setIsResizing(true)
        }}
      />
    </div>
  )
}

