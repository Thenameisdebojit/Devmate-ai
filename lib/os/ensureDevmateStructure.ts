/**
 * PHASE F′-2: .devmate Structure Restoration
 * 
 * Ensures .devmate directory structure exists with required files.
 * Called during bootstrap to guarantee OS state persistence.
 * 
 * RULES:
 * - NEVER overwrites existing files
 * - NEVER deletes user data
 * - Creates only missing files/directories
 * - Non-destructive, defensive operation
 */

import { promises as fs } from 'fs'
import { join } from 'path'

export interface DevmateStructureResult {
  success: boolean
  created: string[]
  error?: string
}

/**
 * Ensure .devmate directory structure exists
 * 
 * Creates:
 * - .devmate/state/settings.json (if missing)
 * - .devmate/goals.json (if missing)
 * - .devmate/execution-thread.json (if missing)
 * - .devmate/threads.json (if missing) - alias for execution-thread.json
 */
export async function ensureDevmateStructure(rootPath: string): Promise<DevmateStructureResult> {
  const created: string[] = []

  try {
    // Ensure .devmate directory exists
    const devmateDir = join(rootPath, '.devmate')
    await fs.mkdir(devmateDir, { recursive: true })

    // Ensure .devmate/state directory exists
    const stateDir = join(devmateDir, 'state')
    await fs.mkdir(stateDir, { recursive: true })

    // Create settings.json if missing
    const settingsPath = join(stateDir, 'settings.json')
    try {
      await fs.access(settingsPath)
      // File exists, skip
    } catch {
      // File doesn't exist, create it
      const defaultSettings = {}
      await fs.writeFile(settingsPath, JSON.stringify(defaultSettings, null, 2), 'utf-8')
      created.push('.devmate/state/settings.json')
    }

    // Create goals.json if missing
    const goalsPath = join(devmateDir, 'goals.json')
    try {
      await fs.access(goalsPath)
      // File exists, skip
    } catch {
      // File doesn't exist, create it
      const defaultGoals = {
        projectId: '',
        goals: [],
        version: 1,
      }
      await fs.writeFile(goalsPath, JSON.stringify(defaultGoals, null, 2), 'utf-8')
      created.push('.devmate/goals.json')
    }

    // Create execution-thread.json if missing
    const threadPath = join(devmateDir, 'execution-thread.json')
    try {
      await fs.access(threadPath)
      // File exists, skip
    } catch {
      // File doesn't exist, create it
      const defaultThread = {
        projectId: '',
        thread: null,
        version: 1,
      }
      await fs.writeFile(threadPath, JSON.stringify(defaultThread, null, 2), 'utf-8')
      created.push('.devmate/execution-thread.json')
    }

    // Create threads.json if missing (alias for execution-thread.json)
    const threadsPath = join(devmateDir, 'threads.json')
    try {
      await fs.access(threadsPath)
      // File exists, skip
    } catch {
      // File doesn't exist, create it
      const defaultThreads = {
        projectId: '',
        threads: [],
        version: 1,
      }
      await fs.writeFile(threadsPath, JSON.stringify(defaultThreads, null, 2), 'utf-8')
      created.push('.devmate/threads.json')
    }

    return {
      success: true,
      created,
    }
  } catch (error: any) {
    console.error('[ensureDevmateStructure] Error:', error)
    return {
      success: false,
      created,
      error: error.message || 'Failed to ensure .devmate structure',
    }
  }
}
