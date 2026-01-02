/**
 * Context Cache
 * 
 * Caches project context, file contents, and AI responses to reduce token usage
 * and improve performance.
 */

import { LRUCache } from 'lru-cache'

export interface CachedContext {
  projectId: string
  files: Map<string, string>
  metadata: {
    framework?: string
    lastModified: number
    fileCount: number
  }
  checksums: Map<string, string>
}

export interface CachedResponse {
  prompt: string
  response: string
  timestamp: number
  tokensUsed?: number
}

export class ContextCache {
  private fileCache: LRUCache<string, CachedContext>
  private responseCache: LRUCache<string, CachedResponse>
  private readonly MAX_CACHE_SIZE = 50
  private readonly TTL = 1000 * 60 * 60 // 1 hour

  constructor() {
    this.fileCache = new LRUCache<string, CachedContext>({
      max: this.MAX_CACHE_SIZE,
      ttl: this.TTL,
    })

    this.responseCache = new LRUCache<string, CachedResponse>({
      max: this.MAX_CACHE_SIZE,
      ttl: this.TTL,
    })
  }

  /**
   * Get cached context for a project
   */
  getContext(projectId: string): CachedContext | undefined {
    return this.fileCache.get(projectId)
  }

  /**
   * Set cached context for a project
   */
  setContext(projectId: string, context: CachedContext): void {
    this.fileCache.set(projectId, context)
  }

  /**
   * Update file in cached context
   */
  updateFile(projectId: string, filePath: string, content: string): void {
    const context = this.getContext(projectId)
    if (context) {
      context.files.set(filePath, content)
      context.metadata.lastModified = Date.now()
      context.metadata.fileCount = context.files.size
      context.checksums.set(filePath, this.computeChecksum(content))
      this.setContext(projectId, context)
    }
  }

  /**
   * Get cached response for a prompt
   */
  getCachedResponse(promptHash: string): CachedResponse | undefined {
    return this.responseCache.get(promptHash)
  }

  /**
   * Cache AI response
   */
  cacheResponse(promptHash: string, prompt: string, response: string, tokensUsed?: number): void {
    this.responseCache.set(promptHash, {
      prompt,
      response,
      timestamp: Date.now(),
      tokensUsed,
    })
  }

  /**
   * Generate prompt hash for caching
   */
  hashPrompt(prompt: string, projectId?: string): string {
    const content = projectId ? `${projectId}:${prompt}` : prompt
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  /**
   * Check if file has changed
   */
  hasFileChanged(projectId: string, filePath: string, content: string): boolean {
    const context = this.getContext(projectId)
    if (!context) return true

    const cachedChecksum = context.checksums.get(filePath)
    const currentChecksum = this.computeChecksum(content)
    return cachedChecksum !== currentChecksum
  }

  /**
   * Get changed files since last cache
   */
  getChangedFiles(projectId: string, files: Map<string, string>): string[] {
    const context = this.getContext(projectId)
    if (!context) return Array.from(files.keys())

    const changed: string[] = []
    for (const [path, content] of files.entries()) {
      if (this.hasFileChanged(projectId, path, content)) {
        changed.push(path)
      }
    }
    return changed
  }

  /**
   * Clear cache for a project
   */
  clearProject(projectId: string): void {
    this.fileCache.delete(projectId)
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.fileCache.clear()
    this.responseCache.clear()
  }

  /**
   * Get cache stats
   */
  getStats(): {
    fileCacheSize: number
    responseCacheSize: number
    fileCacheKeys: string[]
  } {
    return {
      fileCacheSize: this.fileCache.size,
      responseCacheSize: this.responseCache.size,
      fileCacheKeys: Array.from(this.fileCache.keys()),
    }
  }

  /**
   * Compute simple checksum
   */
  private computeChecksum(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }
}

// Singleton instance
export const contextCache = new ContextCache()

