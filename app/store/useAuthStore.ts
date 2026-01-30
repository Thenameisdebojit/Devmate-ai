import { create } from 'zustand'

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role?: 'base_user' | 'super_user' | 'admin'
}

interface AuthStore {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ isLoading: loading }),

  login: async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' }
      }

      set({ user: data.user, isAuthenticated: true })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Login failed' }
    }
  },

  signup: async (name, email, password) => {
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error || 'Signup failed' }
      }

      set({ user: data.user, isAuthenticated: true })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Signup failed' }
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      set({ user: null, isAuthenticated: false })
    } catch (error) {
      console.error('Logout error:', error)
    }
  },

  checkAuth: async () => {
    try {
      set({ isLoading: true })
      
      // Use AbortController for proper timeout handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
      
      try {
        const response = await fetch('/api/auth/me', {
          signal: controller.signal,
          cache: 'no-store',
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          set({ user: data.user, isAuthenticated: true, isLoading: false })
        } else {
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          console.warn('Auth check timed out, proceeding as unauthenticated')
        } else {
          console.error('Auth check fetch error:', fetchError)
        }
        set({ user: null, isAuthenticated: false, isLoading: false })
      }
    } catch (error) {
      console.error('Auth check error:', error)
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },
}))
