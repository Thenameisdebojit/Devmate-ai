/**
 * PHASE B: Bootstrap Atomic Transaction
 * 
 * Ensures bootstrap is atomic: files + .devmate + stage must commit together.
 * 
 * RULES:
 * - No UI calls inside this function
 * - No try/catch swallowing errors
 * - No stage inference - only verification
 * - Throws FatalBootstrapError if invariants fail
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { loadStage } from '@/lib/os/stagePersistence'
import { BootstrapGenerator } from './BootstrapGenerator'

export class FatalBootstrapError extends Error {
  constructor(message: string, public readonly projectId: string, public readonly rootPath: string) {
    super(message)
    this.name = 'FatalBootstrapError'
  }
}

export interface BootstrapCommitResult {
  success: true
  projectId: string
  rootPath: string
  filesCreated: string[]
  stage: string
  committedAt: string
}

/**
 * Commit bootstrap transaction atomically
 * 
 * Verifies ALL bootstrap invariants:
 * - Required project files exist
 * - .devmate/ exists
 * - .devmate/state/project.json exists
 * - Stage is at least "bootstrapped"
 * 
 * Throws FatalBootstrapError if any invariant fails.
 * Only returns success if ALL invariants pass.
 */
export async function commitBootstrapTransaction(
  projectId: string,
  rootPath: string,
  expectedFiles: string[]
): Promise<BootstrapCommitResult> {
  const timestamp = new Date().toISOString()
  
  // PHASE B: Verify project files exist
  const missingFiles: string[] = []
  for (const filePath of expectedFiles) {
    const fullPath = join(rootPath, filePath)
    try {
      await fs.access(fullPath)
    } catch {
      missingFiles.push(filePath)
    }
  }
  
  if (missingFiles.length > 0) {
    throw new FatalBootstrapError(
      `Bootstrap commit failed: Required files missing: ${missingFiles.join(', ')}`,
      projectId,
      rootPath
    )
  }
  
  // PHASE B: Verify .devmate exists
  const devmatePath = join(rootPath, '.devmate')
  try {
    const stat = await fs.stat(devmatePath)
    if (!stat.isDirectory()) {
      throw new FatalBootstrapError(
        `Bootstrap commit failed: .devmate exists but is not a directory`,
        projectId,
        rootPath
      )
    }
  } catch (error: any) {
    if (error instanceof FatalBootstrapError) {
      throw error
    }
    throw new FatalBootstrapError(
      `Bootstrap commit failed: .devmate directory does not exist`,
      projectId,
      rootPath
    )
  }
  
  // PHASE B: Verify .devmate/state/project.json exists
  const projectStatePath = join(rootPath, '.devmate', 'state', 'project.json')
  let persistedState
  try {
    persistedState = await loadStage(rootPath)
    if (!persistedState) {
      throw new FatalBootstrapError(
        `Bootstrap commit failed: .devmate/state/project.json does not exist`,
        projectId,
        rootPath
      )
    }
  } catch (error: any) {
    if (error instanceof FatalBootstrapError) {
      throw error
    }
    throw new FatalBootstrapError(
      `Bootstrap commit failed: Cannot read .devmate/state/project.json: ${error.message}`,
      projectId,
      rootPath
    )
  }
  
  // PHASE B: Verify stage is at least "bootstrapped"
  const validBootstrapStages: Array<'bootstrapped' | 'editable' | 'evolving'> = ['bootstrapped', 'editable', 'evolving']
  if (!validBootstrapStages.includes(persistedState.stage as any)) {
    throw new FatalBootstrapError(
      `Bootstrap commit failed: Stage is "${persistedState.stage}" but must be at least "bootstrapped"`,
      projectId,
      rootPath
    )
  }
  
  // PHASE B: All invariants pass - return success
  return {
    success: true,
    projectId,
    rootPath,
    filesCreated: expectedFiles,
    stage: persistedState.stage,
    committedAt: timestamp,
  }
}
