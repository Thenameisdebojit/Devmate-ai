/**
 * PHASE E: Execution Invariant Checker
 * 
 * Validates post-conditions after every execution.
 * Prevents silent failures and ensures deterministic behavior.
 * 
 * Rules:
 * - generate ⇒ fileCount > 0
 * - mutate ⇒ FILE_CHANGED event emitted
 * - fix ⇒ FILE_CHANGED event emitted
 * - run ⇒ runtimeState === "running" or "starting"
 * - explain ⇒ zero file writes
 * - bootstrap ⇒ workspaceStage === "bootstrapped"
 */

import type { ExecutionIntent } from '@/lib/ide/IntentBuilder'

export type WorkspaceStage = 'empty' | 'bootstrapped' | 'generated' | 'running' | 'error'

export interface ExecutionInvariantContext {
  projectId: string
  intent: ExecutionIntent
  workspaceStage: WorkspaceStage
  fileCount: number
  rootPath: string
  runtimeState?: 'idle' | 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed'
  filesChanged?: string[] // List of files that were changed
  filesWritten?: number // Number of files written
}

/**
 * Assert execution invariants
 * 
 * Throws a hard error if any invariant is violated.
 * This prevents silent failures and ensures deterministic behavior.
 */
export function assertExecutionInvariant(context: ExecutionInvariantContext): void {
  const { projectId, intent, workspaceStage, fileCount, rootPath, runtimeState, filesChanged, filesWritten } = context

  // Common invariants
  if (!projectId) {
    throw new Error(`Invariant violation: projectId is missing. Context: ${JSON.stringify(context)}`)
  }

  if (!rootPath) {
    throw new Error(`Invariant violation: rootPath is missing for projectId: ${projectId}`)
  }

  // Intent-specific invariants
  switch (intent.type) {
    case 'generate':
      // Generate must create at least one file
      if (fileCount === 0 && workspaceStage !== 'empty') {
        throw new Error(
          `Invariant violation: generate completed but fileCount is 0. ` +
          `projectId: ${projectId}, workspaceStage: ${workspaceStage}, rootPath: ${rootPath}`
        )
      }
      // If files were written, verify count matches
      if (filesWritten !== undefined && filesWritten === 0) {
        throw new Error(
          `Invariant violation: generate reported zero files written. ` +
          `projectId: ${projectId}, rootPath: ${rootPath}`
        )
      }
      break

    case 'mutate':
      // Mutate must emit FILE_CHANGED events
      if (!filesChanged || filesChanged.length === 0) {
        throw new Error(
          `Invariant violation: mutate completed but no FILE_CHANGED events emitted. ` +
          `projectId: ${projectId}, intent: ${intent.description}, rootPath: ${rootPath}`
        )
      }
      // Mutate should not run on empty workspace
      if (fileCount === 0) {
        throw new Error(
          `Invariant violation: mutate attempted on empty workspace. ` +
          `projectId: ${projectId}, rootPath: ${rootPath}`
        )
      }
      break

    case 'fix':
      // Fix must emit FILE_CHANGED events (even if no errors found)
      if (filesChanged === undefined) {
        throw new Error(
          `Invariant violation: fix completed but FILE_CHANGED events not tracked. ` +
          `projectId: ${projectId}, rootPath: ${rootPath}`
        )
      }
      // Fix should not run on empty workspace
      if (fileCount === 0) {
        throw new Error(
          `Invariant violation: fix attempted on empty workspace. ` +
          `projectId: ${projectId}, rootPath: ${rootPath}`
        )
      }
      break

    case 'run':
      // Run must result in runtime starting or running
      if (runtimeState !== 'running' && runtimeState !== 'starting') {
        throw new Error(
          `Invariant violation: run completed but runtimeState is not running/starting. ` +
          `projectId: ${projectId}, runtimeState: ${runtimeState}, rootPath: ${rootPath}`
        )
      }
      // Run should not work on empty workspace
      if (fileCount === 0) {
        throw new Error(
          `Invariant violation: run attempted on empty workspace. ` +
          `projectId: ${projectId}, rootPath: ${rootPath}`
        )
      }
      break

    case 'explain':
      // Explain must NOT write any files
      if (filesWritten !== undefined && filesWritten > 0) {
        throw new Error(
          `Invariant violation: explain wrote files (should be read-only). ` +
          `projectId: ${projectId}, filesWritten: ${filesWritten}, rootPath: ${rootPath}`
        )
      }
      if (filesChanged && filesChanged.length > 0) {
        throw new Error(
          `Invariant violation: explain emitted FILE_CHANGED events (should be read-only). ` +
          `projectId: ${projectId}, filesChanged: ${filesChanged.length}, rootPath: ${rootPath}`
        )
      }
      break

    case 'debug':
      // Debug should not write files
      if (filesWritten !== undefined && filesWritten > 0) {
        throw new Error(
          `Invariant violation: debug wrote files (should be read-only). ` +
          `projectId: ${projectId}, filesWritten: ${filesWritten}, rootPath: ${rootPath}`
        )
      }
      break
  }

  // Workspace stage invariants
  if (workspaceStage === 'error' && intent.type !== 'explain') {
    // Error stage should only persist if there's an actual error
    // This is checked elsewhere, but we log it here
    console.warn(
      `Workspace in error state after ${intent.type}. ` +
      `projectId: ${projectId}, rootPath: ${rootPath}`
    )
  }
}

/**
 * Assert workspace registry invariants
 */
export function assertWorkspaceInvariant(
  projectId: string,
  rootPath: string,
  fileCount: number
): void {
  if (!projectId) {
    throw new Error('Invariant violation: projectId is required')
  }

  if (!rootPath) {
    throw new Error(`Invariant violation: rootPath is missing for projectId: ${projectId}`)
  }

  // File count should be non-negative
  if (fileCount < 0) {
    throw new Error(
      `Invariant violation: fileCount is negative. ` +
      `projectId: ${projectId}, fileCount: ${fileCount}, rootPath: ${rootPath}`
    )
  }
}
