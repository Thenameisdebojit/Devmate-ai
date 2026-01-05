'use client'

import Terminal from '@/app/components/AppGenerator/Terminal'

interface IDETerminalProps {
  projectId?: string
  className?: string
}

export default function IDETerminal({ projectId, className }: IDETerminalProps) {
  return (
    <div className={className}>
      <div className="h-full">
        <Terminal projectId={projectId} />
      </div>
    </div>
  )
}

