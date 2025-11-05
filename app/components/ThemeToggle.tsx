'use client'

import { useTheme } from './ThemeProvider'
import { FiSun, FiMoon, FiMonitor } from 'react-icons/fi'

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('light')
    else if (theme === 'light') setTheme('system')
    else setTheme('dark')
  }

  const Icon = theme === 'dark' ? FiMoon : theme === 'light' ? FiSun : FiMonitor
  const label = theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 active:scale-95 border border-gray-200 dark:border-gray-700"
      title={`Theme: ${label} (click to cycle)`}
    >
      <Icon className="w-5 h-5 text-gray-700 dark:text-gray-300 transition-transform duration-200" />
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
        {label}
      </span>
    </button>
  )
}
