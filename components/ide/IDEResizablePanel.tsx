'use client'

import { useState, useRef, useEffect, ReactNode } from 'react'

interface IDEResizablePanelProps {
  children: ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  onResize?: (width: number) => void
}

export default function IDEResizablePanel({
  children,
  defaultWidth = 300,
  minWidth = 200,
  maxWidth = 800,
  onResize,
}: IDEResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(defaultWidth)

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!panelRef.current) return

      const deltaX = e.clientX - startXRef.current
      let newWidth = startWidthRef.current + deltaX
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))

      setWidth(newWidth)
      onResize?.(newWidth)
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
  }, [isResizing, minWidth, maxWidth, onResize])

  return (
    <div
      ref={panelRef}
      className="relative flex-shrink-0 flex h-full"
      style={{ width: `${width}px` }}
    >
      <div className="flex-1 min-w-0 min-h-0">
        {children}
      </div>
      <div
        className={`flex-shrink-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent'
        }`}
        onMouseDown={(e) => {
          e.preventDefault()
          if (panelRef.current) {
            startXRef.current = e.clientX
            startWidthRef.current = panelRef.current.getBoundingClientRect().width
          } else {
            startXRef.current = e.clientX
            startWidthRef.current = width
          }
          setIsResizing(true)
        }}
      />
    </div>
  )
}


