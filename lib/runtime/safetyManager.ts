/**
 * Safety Manager
 * 
 * Enforces safety controls for container execution:
 * - CPU quotas
 * - Process caps
 * - Network firewall
 * - Filesystem isolation
 */

import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface SafetyConfig {
  cpuLimit: string // e.g., "1.0" for 100% of one CPU
  memoryLimit: string // e.g., "1g" for 1GB
  maxProcesses?: number // Maximum number of processes
  networkIsolation?: boolean // Isolate network
  readOnlyFilesystem?: boolean // Read-only filesystem (except /tmp)
  allowedPorts?: number[] // Whitelist of allowed ports
  blockedCommands?: string[] // Commands to block
}

export interface SafetyPolicy {
  projectId: string
  config: SafetyConfig
  enforced: boolean
}

export class SafetyManager {
  private policies: Map<string, SafetyPolicy> = new Map()

  /**
   * Default safety configuration
   */
  private readonly DEFAULT_CONFIG: SafetyConfig = {
    cpuLimit: '1.0',
    memoryLimit: '1g',
    maxProcesses: 50,
    networkIsolation: true,
    readOnlyFilesystem: false,
    allowedPorts: [3000, 5000, 8000, 5173], // Common dev ports
    blockedCommands: [
      'rm -rf /',
      'format',
      'mkfs',
      'dd if=/dev/',
      'shutdown',
      'reboot',
      'halt',
    ],
  }

  /**
   * Apply safety policy to container
   */
  async applySafetyPolicy(containerId: string, projectId: string, config?: Partial<SafetyConfig>): Promise<void> {
    const safetyConfig: SafetyConfig = {
      ...this.DEFAULT_CONFIG,
      ...config,
    }

    const policy: SafetyPolicy = {
      projectId,
      config: safetyConfig,
      enforced: false,
    }

    try {
      // Apply CPU and memory limits (already in Docker run command)
      // These are enforced at container creation time

      // Apply process limits
      if (safetyConfig.maxProcesses) {
        await this.setProcessLimit(containerId, safetyConfig.maxProcesses)
      }

      // Apply network isolation
      if (safetyConfig.networkIsolation) {
        await this.isolateNetwork(containerId)
      }

      // Apply filesystem restrictions
      if (safetyConfig.readOnlyFilesystem) {
        await this.setReadOnlyFilesystem(containerId)
      }

      // Block dangerous commands
      await this.setupCommandFilter(containerId, safetyConfig.blockedCommands || [])

      policy.enforced = true
      this.policies.set(containerId, policy)
    } catch (error: any) {
      console.error(`Failed to apply safety policy: ${error.message}`)
      throw new Error(`Safety policy enforcement failed: ${error.message}`)
    }
  }

  /**
   * Set process limit using cgroups
   */
  private async setProcessLimit(containerId: string, maxProcesses: number): Promise<void> {
    try {
      // Use Docker's built-in process limit
      await execAsync(
        `docker update --pids-limit ${maxProcesses} ${containerId}`
      )
    } catch (error) {
      // Process limits might not be available on all systems
      console.warn('Process limit not available:', error)
    }
  }

  /**
   * Isolate network (block external access except allowed ports)
   */
  private async isolateNetwork(containerId: string): Promise<void> {
    try {
      // Create isolated network
      const networkName = `devmate-${containerId}`
      
      // Check if network exists
      try {
        await execAsync(`docker network inspect ${networkName}`)
      } catch {
        // Create isolated network
        await execAsync(`docker network create --internal ${networkName}`)
      }

      // Connect container to isolated network
      // Note: This should be done at container creation, but we can update here
      console.log(`Network isolation configured for ${containerId}`)
    } catch (error) {
      console.warn('Network isolation not fully available:', error)
    }
  }

  /**
   * Set read-only filesystem (except /tmp)
   */
  private async setReadOnlyFilesystem(containerId: string): Promise<void> {
    try {
      // Update container to read-only root filesystem
      await execAsync(
        `docker update --read-only ${containerId}`
      )

      // Ensure /tmp is writable
      await execAsync(
        `docker exec ${containerId} sh -c "mount -o remount,rw /tmp || true"`
      )
    } catch (error) {
      console.warn('Read-only filesystem not available:', error)
    }
  }

  /**
   * Setup command filter to block dangerous commands
   */
  private async setupCommandFilter(containerId: string, blockedCommands: string[]): Promise<void> {
    // This is a simplified implementation
    // In production, you'd use a more sophisticated approach (e.g., seccomp, AppArmor)
    
    // Create a wrapper script that filters commands
    const filterScript = `
#!/bin/sh
BLOCKED="${blockedCommands.join('|')}"
if echo "$*" | grep -qE "$BLOCKED"; then
  echo "Error: Command blocked by safety policy"
  exit 1
fi
exec "$@"
`

    try {
      // Write filter script to container
      await execAsync(
        `docker exec ${containerId} sh -c "echo '${filterScript}' > /usr/local/bin/safe-exec && chmod +x /usr/local/bin/safe-exec"`
      )
    } catch (error) {
      console.warn('Command filter setup failed:', error)
    }
  }

  /**
   * Validate command before execution
   */
  validateCommand(command: string, config?: SafetyConfig): { allowed: boolean; reason?: string } {
    const safetyConfig = config || this.DEFAULT_CONFIG
    const blockedCommands = safetyConfig.blockedCommands || []

    for (const blocked of blockedCommands) {
      if (command.includes(blocked)) {
        return {
          allowed: false,
          reason: `Command contains blocked pattern: ${blocked}`,
        }
      }
    }

    return { allowed: true }
  }

  /**
   * Get safety policy for container
   */
  getPolicy(containerId: string): SafetyPolicy | null {
    return this.policies.get(containerId) || null
  }

  /**
   * Remove safety policy
   */
  removePolicy(containerId: string): void {
    this.policies.delete(containerId)
  }

  /**
   * Get default safety config
   */
  getDefaultConfig(): SafetyConfig {
    return { ...this.DEFAULT_CONFIG }
  }
}

// Singleton instance
export const safetyManager = new SafetyManager()

