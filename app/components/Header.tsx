'use client'

import { useTheme } from './ThemeProvider'
import { useChatStore } from '../store/useChatStore'
import toast from 'react-hot-toast'

interface HeaderProps {
  currentDomain: string
  setCurrentDomain: (domain: string) => void
}

export default function Header({ currentDomain, setCurrentDomain }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()
  const { clearMessages, exportConversation } = useChatStore()

  const handleClear = () => {
    clearMessages()
    toast.success('Conversation cleared')
  }

  const handleExport = () => {
    exportConversation()
    toast.success('Conversation exported')
  }

  const domains = ['General', 'Python', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Go', 'Rust']

  return (
    <header className="glass-morphism border-b border-white/10">
      <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-lg md:text-xl">
            D
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Devmate</h1>
            <p className="text-xs md:text-sm bg-gradient-to-r from-gray-300 to-gray-500 bg-clip-text text-transparent hidden sm:block">v2.0 - Powered by Gemini Pro</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 md:gap-3">
          <select
            value={currentDomain}
            onChange={(e) => setCurrentDomain(e.target.value)}
            className="glass-morphism px-2 md:px-4 py-1.5 md:py-2 rounded-lg text-white text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {domains.map((domain) => (
              <option key={domain} value={domain} className="bg-gray-900">
                {domain}
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            className="hidden sm:block glass-morphism p-2 rounded-lg hover:bg-white/20 transition-colors"
            title="Export conversation"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            onClick={handleClear}
            className="glass-morphism p-1.5 md:p-2 rounded-lg hover:bg-white/20 transition-colors"
            title="Clear conversation"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>

          <button
            onClick={toggleTheme}
            className="glass-morphism p-1.5 md:p-2 rounded-lg hover:bg-white/20 transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  )
}
