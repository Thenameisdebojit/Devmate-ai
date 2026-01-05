'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiChevronDown } from 'react-icons/fi'
import { useRouter } from 'next/navigation'

const domains = [
  { id: 'general', name: 'General', icon: '🧠', description: 'General purpose assistance' },
  { id: 'app-generator', name: 'App Generator', icon: '⚡', description: 'Generate complete applications from natural language' },
  { id: 'web-dev', name: 'Web Development', icon: '💻', description: 'Frontend, backend, and full-stack development' },
  { id: 'ml-ai', name: 'Machine Learning / AI', icon: '🤖', description: 'ML models, AI algorithms, and neural networks' },
  { id: 'data-science', name: 'Data Science', icon: '📊', description: 'Data analysis, visualization, and statistics' },
  { id: 'academic', name: 'Academic / Research', icon: '📝', description: 'Research papers, academic writing, and citations' },
  { id: 'prompt-eng', name: 'Prompt Engineering', icon: '🪄', description: 'AI prompts, optimization, and best practices' },
]

interface DomainSelectorProps {
  value: string
  onChange: (domain: string) => void
}

export default function DomainSelector({ value, onChange }: DomainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const selectedDomain = domains.find(d => d.id === value) || domains[0]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
      >
        <span className="text-lg">{selectedDomain.icon}</span>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {selectedDomain.name}
        </span>
        <FiChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden z-50"
          >
            {domains.map((domain) => (
              <button
                key={domain.id}
                onClick={() => {
                  // Navigate to appropriate route
                  if (domain.id === 'app-generator') {
                    router.push('/ide/app-generator')
                  } else {
                    // Navigate to domain route
                    router.push(`/domain/${domain.id}`)
                  }
                  setIsOpen(false)
                }}
                className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                  domain.id === value ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                }`}
              >
                <span className="text-2xl mt-0.5">{domain.icon}</span>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {domain.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {domain.description}
                  </p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
