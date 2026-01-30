/**
 * PHASE 2: Explorer Visibility Rules
 * 
 * IDE-level filtering for file explorer.
 * Enforces that .devmate files are hidden unless explicitly shown.
 * 
 * NOTE: This is a client-safe module. It does NOT import server-only modules.
 */

/**
 * Default hidden paths (always hidden unless showSystemFiles is enabled)
 */
export const HIDDEN_PATHS = [
  '.devmate',
  '.git',
  'node_modules',
  '.next',
  '.vscode',
  '.idea',
]

/**
 * Check if a file path should be hidden (client-safe version)
 * 
 * For server-side filtering with settings, use the API endpoint.
 */
export function shouldHideFile(filePath: string, showSystemFiles: boolean = false): boolean {
  // Normalize path separators
  const normalizedPath = filePath.replace(/\\/g, '/')

  // Always hide .devmate files - they must NEVER appear as editable source
  if (normalizedPath.includes('.devmate/') || normalizedPath.startsWith('.devmate')) {
    return true // Always hide, regardless of setting
  }

  // If showSystemFiles is false, hide other system files
  if (!showSystemFiles) {
    for (const hiddenPath of HIDDEN_PATHS) {
      if (normalizedPath.includes(`${hiddenPath}/`) || normalizedPath.startsWith(`${hiddenPath}/`) || normalizedPath === hiddenPath) {
        return true
      }
    }
  }

  return false
}

/**
 * Filter file list based on visibility rules (client-safe version)
 */
export function filterVisibleFiles(
  files: Array<{ path: string; [key: string]: any }>,
  showSystemFiles: boolean = false
): Array<{ path: string; [key: string]: any }> {
  const visibleFiles: Array<{ path: string; [key: string]: any }> = []

  for (const file of files) {
    const shouldHide = shouldHideFile(file.path, showSystemFiles)
    if (!shouldHide) {
      visibleFiles.push(file)
    }
  }

  return visibleFiles
}

/**
 * Check if .devmate files should be excluded (always true)
 * 
 * This is a hard rule - .devmate must NEVER be visible as editable source.
 */
export function isDevmateFile(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/')
  return normalizedPath.includes('.devmate/') || normalizedPath.startsWith('.devmate') || normalizedPath === '.devmate'
}
