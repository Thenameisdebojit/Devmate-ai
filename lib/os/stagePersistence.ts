/**
 * PHASE A: Stage Persistence
 * 
 * Single source of truth for project stage on disk.
 * Persists to .devmate/state/project.json
 * 
 * RULES:
 * - NEVER infer stage from files alone
 * - NEVER auto-advance stage
 * - ONLY read/write explicit stage values
 * - Stage changes must be explicit API calls
 */

import { promises as fs } from 'fs'
import { join } from 'path'

export interface ProjectState {
  projectId: string
  stage: 'empty' | 'bootstrapped' | 'editable' | 'evolving' | 'locked'
  updatedAt: string
  updatedBy: 'bootstrap' | 'recovery' | 'manual' | 'evolution'
}

const STATE_FILE = '.devmate/state/project.json'

/**
 * Load project stage from disk
 * Returns null if file doesn't exist (first-time initialization)
 */
export async function loadStage(rootPath: string): Promise<ProjectState | null> {
  try {
    const statePath = join(rootPath, STATE_FILE)
    const content = await fs.readFile(statePath, 'utf-8')
    const state: ProjectState = JSON.parse(content)
    
    // Validate stage value
    const validStages = ['empty', 'bootstrapped', 'editable', 'evolving', 'locked']
    if (!validStages.includes(state.stage)) {
      console.warn(`[stagePersistence] Invalid stage "${state.stage}" in ${statePath}, defaulting to empty`)
      return null
    }
    
    return state
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist - first time initialization
      return null
    }
    console.error(`[stagePersistence] Failed to load stage from ${rootPath}:`, error)
    return null
  }
}

/**
 * Save project stage to disk
 */
export async function saveStage(
  rootPath: string,
  projectId: string,
  stage: ProjectState['stage'],
  source: ProjectState['updatedBy'] = 'manual'
): Promise<void> {
  try {
    const stateDir = join(rootPath, '.devmate', 'state')
    await fs.mkdir(stateDir, { recursive: true })
    
    const statePath = join(stateDir, 'project.json')
    const state: ProjectState = {
      projectId,
      stage,
      updatedAt: new Date().toISOString(),
      updatedBy: source,
    }
    
    await fs.writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8')
    
    // Log stage transition
    console.log(`[stagePersistence] Stage saved: ${projectId} → ${stage} (source: ${source})`)
  } catch (error: any) {
    console.error(`[stagePersistence] Failed to save stage to ${rootPath}:`, error)
    throw new Error(`Failed to persist stage: ${error.message}`)
  }
}

/**
 * Get stage file path (for checking existence)
 */
export function getStageFilePath(rootPath: string): string {
  return join(rootPath, STATE_FILE)
}
