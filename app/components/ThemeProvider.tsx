'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

const ThemeContext = createContext<{
  theme: Theme
  resolvedTheme: 'dark' | 'light'
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}>({
  theme: 'system',
  resolvedTheme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
})

export const useTheme = () => useContext(ThemeContext)

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedTheme = (localStorage.getItem('devmate-theme') as Theme) || 'system'
    setTheme(savedTheme)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const getResolvedTheme = (): 'dark' | 'light' => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return theme
    }

    const updateTheme = () => {
      const resolved = getResolvedTheme()
      setResolvedTheme(resolved)
      
      const root = window.document.documentElement
      const body = window.document.body
      
      root.classList.remove('light', 'dark')
      body.classList.remove('light', 'dark')
      
      root.classList.add(resolved)
      body.classList.add(resolved)
      
      localStorage.setItem('devmate-theme', theme)
    }

    updateTheme()

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => updateTheme()
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme, mounted])

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'dark') return 'light'
      if (prev === 'light') return 'system'
      return 'dark'
    })
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
