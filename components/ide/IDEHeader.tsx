'use client'

import { ReactNode } from 'react'

interface IDEHeaderProps {
  children?: ReactNode
}

export default function IDEHeader({ children }: IDEHeaderProps) {
  return (
    <div className="h-12 flex-shrink-0 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center px-4">
      <div className="w-full flex items-center justify-between">
        {children}
      </div>
    </div>
  )
}

