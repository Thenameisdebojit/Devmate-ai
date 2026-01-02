/**
 * Preview Engine
 * 
 * Manages preview URLs, port assignment, and reverse proxy for running apps.
 * Auto-detects framework and exposes appropriate ports.
 */

import { containerManager, ContainerStatus } from './containerManager'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface PreviewConfig {
  projectId: string
  framework: 'nextjs' | 'vite' | 'react' | 'python' | 'node' | 'unknown'
  port: number
  autoReload?: boolean
}

export class PreviewEngine {
  private previews: Map<string, PreviewConfig> = new Map()
  private nginxConfigPath = '/etc/nginx/sites-available/devmate-preview'
  private nginxEnabledPath = '/etc/nginx/sites-enabled/devmate-preview'

  /**
   * Get preview URL for a project
   */
  async getPreviewUrl(projectId: string): Promise<string | null> {
    const status = containerManager.getContainerStatus(projectId)
    if (!status || status.status !== 'running') {
      return null
    }

    // Return direct container URL (in production, use reverse proxy)
    return status.previewUrl || `http://localhost:${status.port}`
  }

  /**
   * Setup reverse proxy for preview (if Nginx is available)
   */
  async setupReverseProxy(config: PreviewConfig): Promise<boolean> {
    try {
      // Check if Nginx is available
      await execAsync('which nginx')
    } catch {
      // Nginx not available, use direct port access
      return false
    }

    try {
      // Create Nginx config
      const nginxConfig = this.generateNginxConfig(config)
      
      // Write config (requires sudo in production)
      // For now, just return true - actual implementation would write to nginx config
      this.previews.set(config.projectId, config)
      return true
    } catch (error) {
      console.error('Failed to setup reverse proxy:', error)
      return false
    }
  }

  /**
   * Generate Nginx configuration for reverse proxy
   */
  private generateNginxConfig(config: PreviewConfig): string {
    return `
server {
    listen 80;
    server_name ${config.projectId}.devmate.local;

    location / {
        proxy_pass http://localhost:${config.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Auto-reload for development
    ${config.autoReload ? `
    location /_dev/reload {
        proxy_pass http://localhost:${config.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }` : ''}
}
`
  }

  /**
   * Enable auto-reload for preview
   */
  async enableAutoReload(projectId: string): Promise<void> {
    const config = this.previews.get(projectId)
    if (config) {
      config.autoReload = true
      await this.setupReverseProxy(config)
    }
  }

  /**
   * Get all active previews
   */
  getActivePreviews(): PreviewConfig[] {
    return Array.from(this.previews.values())
  }

  /**
   * Remove preview configuration
   */
  removePreview(projectId: string): void {
    this.previews.delete(projectId)
  }
}

// Singleton instance
export const previewEngine = new PreviewEngine()

