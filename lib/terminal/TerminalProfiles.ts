/**
 * Terminal Profiles
 * 
 * Defines terminal profiles (shell configurations) for different platforms.
 */

import { platform } from 'os'

export interface TerminalProfile {
  id: string
  name: string
  shell: string
  args: string[]
  icon?: string
  env?: Record<string, string>
}

/**
 * Predefined terminal profiles
 */
export const TERMINAL_PROFILES: Record<string, TerminalProfile> = {
  'powershell': {
    id: 'powershell',
    name: 'PowerShell',
    shell: 'powershell.exe',
    args: ['-NoLogo', '-NoExit'],
    icon: '>_',
    env: {},
  },
  'cmd': {
    id: 'cmd',
    name: 'Command Prompt',
    shell: process.env.COMSPEC || 'cmd.exe',
    args: ['/k'],
    icon: '>_',
    env: {},
  },
  'git-bash': {
    id: 'git-bash',
    name: 'Git Bash',
    shell: 'C:\\Program Files\\Git\\bin\\bash.exe',
    args: ['--login'],
    icon: '$',
    env: {},
  },
  'wsl': {
    id: 'wsl',
    name: 'WSL',
    shell: 'wsl.exe',
    args: [],
    icon: '$',
    env: {},
  },
  'bash': {
    id: 'bash',
    name: 'Bash',
    shell: '/bin/bash',
    args: ['-l'],
    icon: '$',
    env: {},
  },
  'zsh': {
    id: 'zsh',
    name: 'Zsh',
    shell: '/bin/zsh',
    args: ['-l'],
    icon: '$',
    env: {},
  },
}

/**
 * Get default profile for current platform
 */
export function getDefaultProfile(): TerminalProfile {
  const isWindows = platform() === 'win32'
  
  if (isWindows) {
    // Try PowerShell first, fallback to CMD
    try {
      return TERMINAL_PROFILES['powershell']
    } catch {
      return TERMINAL_PROFILES['cmd']
    }
  } else {
    // Try zsh first (common on macOS), fallback to bash
    try {
      return TERMINAL_PROFILES['zsh']
    } catch {
      return TERMINAL_PROFILES['bash']
    }
  }
}

/**
 * Get available profiles for current platform
 */
export function getAvailableProfiles(): TerminalProfile[] {
  const isWindows = platform() === 'win32'
  
  if (isWindows) {
    return [
      TERMINAL_PROFILES['powershell'],
      TERMINAL_PROFILES['cmd'],
      TERMINAL_PROFILES['git-bash'],
      TERMINAL_PROFILES['wsl'],
    ]
  } else {
    return [
      TERMINAL_PROFILES['bash'],
      TERMINAL_PROFILES['zsh'],
    ]
  }
}

/**
 * Get profile by ID
 */
export function getProfile(profileId: string): TerminalProfile {
  return TERMINAL_PROFILES[profileId] || getDefaultProfile()
}
