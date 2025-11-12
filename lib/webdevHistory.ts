export interface WebDevHistoryItem {
  id: string
  prompt: string
  timestamp: number
  framework: string
  fileCount: number
  modelUsed?: string
}

const STORAGE_KEY = 'webdev-history'

export function getWebDevHistory(): WebDevHistoryItem[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (e) {
    console.error('Failed to load history:', e)
    return []
  }
}

export function addWebDevHistoryItem(item: Omit<WebDevHistoryItem, 'id' | 'timestamp'>): void {
  if (typeof window === 'undefined') return
  
  try {
    const history = getWebDevHistory()
    const newItem: WebDevHistoryItem = {
      ...item,
      id: `wd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }
    
    const updatedHistory = [newItem, ...history].slice(0, 50) // Keep last 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory))
  } catch (e) {
    console.error('Failed to save history:', e)
  }
}

export function clearWebDevHistory(): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (e) {
    console.error('Failed to clear history:', e)
  }
}
