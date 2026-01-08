'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface DomainSwitcherProps {
  currentDomain: string
  onDomainChange?: (domain: string) => void // PHASE 1: Callback for domain changes
}

const domains = [
  { id: 'general', label: 'General', icon: '🧠', route: '/domain/general' },
  { id: 'app-generator', label: 'App Generator', icon: '⚡', route: '/ide/app-generator' },
  { id: 'web-dev', label: 'Web Development', icon: '💻', route: '/domain/web-dev' },
  { id: 'ml-ai', label: 'Machine Learning / AI', icon: '🤖', route: '/domain/ml-ai' },
  { id: 'data-science', label: 'Data Science', icon: '📊', route: '/domain/data-science' },
  { id: 'academic', label: 'Academic / Research', icon: '📝', route: '/domain/academic' },
  { id: 'prompt-eng', label: 'Prompt Engineering', icon: '🪄', route: '/domain/prompt-eng' },
]

export default function DomainSwitcher({ currentDomain, onDomainChange }: DomainSwitcherProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const current = domains.find((d) => d.id === currentDomain) || domains[0]

  const handleDomainChange = (domain: typeof domains[0]) => {
    // PHASE 1: Call onDomainChange callback if provided (for IDE session reset)
    if (onDomainChange && domain.id !== currentDomain) {
      onDomainChange(domain.id)
    }
    // Navigate to domain route
    router.push(domain.route)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <span className="text-lg">{current.icon}</span>
        <span>{current.label}</span>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
            {domains.map((domain) => (
              <button
                key={domain.id}
                onClick={() => handleDomainChange(domain)}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  domain.id === currentDomain ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                }`}
              >
                <span className="text-2xl mt-0.5">{domain.icon}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {domain.label}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

