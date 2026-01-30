/**
 * PHASE F-4: Virtual Document Manager
 * 
 * Manages VS Code-style virtual documents that are backed by JSON files.
 * These documents appear as regular files in the editor but are stored in .devmate/
 * 
 * Virtual documents:
 * - Settings: .devmate/settings.json
 * - Extensions: .devmate/extensions.json
 * - Keybindings: .devmate/keybindings.json
 * - Preferences: .devmate/preferences.json
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { WorkspaceRegistry } from '@/lib/workspace/WorkspaceRegistry'

export type VirtualDocumentType = 'settings' | 'extensions' | 'keybindings' | 'preferences'

export interface VirtualDocument {
  type: VirtualDocumentType
  path: string
  content: string
  exists: boolean
}

const VIRTUAL_DOCUMENT_PATHS: Record<VirtualDocumentType, string> = {
  settings: '.devmate/settings.json',
  extensions: '.devmate/extensions.json',
  keybindings: '.devmate/keybindings.json',
  preferences: '.devmate/preferences.json',
}

const DEFAULT_CONTENTS: Record<VirtualDocumentType, object> = {
  settings: {
    editor: {
      fontSize: 14,
      fontFamily: 'Consolas, "Courier New", monospace',
      wordWrap: 'on',
      minimap: { enabled: true },
      tabSize: 2,
      insertSpaces: true,
    },
    files: {
      autoSave: 'afterDelay',
      autoSaveDelay: 1000,
    },
    terminal: {
      integrated: {
        fontSize: 14,
      },
    },
  },
  extensions: {
    installed: [],
    enabled: [],
    disabled: [],
  },
  keybindings: [
    {
      key: 'ctrl+s',
      command: 'file.save',
    },
    {
      key: 'ctrl+f',
      command: 'editor.find',
    },
    {
      key: 'ctrl+h',
      command: 'editor.replace',
    },
  ],
  preferences: {
    theme: 'dark',
    language: 'en',
    notifications: {
      enabled: true,
    },
  },
}

export class VirtualDocumentManager {
  /**
   * Get virtual document path for a type
   */
  static getVirtualPath(type: VirtualDocumentType): string {
    return VIRTUAL_DOCUMENT_PATHS[type]
  }

  /**
   * Check if a path is a virtual document
   */
  static isVirtualDocument(path: string): boolean {
    return Object.values(VIRTUAL_DOCUMENT_PATHS).includes(path)
  }

  /**
   * Get virtual document type from path
   */
  static getVirtualDocumentType(path: string): VirtualDocumentType | null {
    for (const [type, virtualPath] of Object.entries(VIRTUAL_DOCUMENT_PATHS)) {
      if (virtualPath === path) {
        return type as VirtualDocumentType
      }
    }
    return null
  }

  /**
   * Read virtual document content
   */
  static async readVirtualDocument(
    projectId: string,
    type: VirtualDocumentType
  ): Promise<VirtualDocument> {
    const rootPath = await WorkspaceRegistry.getRootPath(projectId)
    const virtualPath = VIRTUAL_DOCUMENT_PATHS[type]
    const fullPath = join(rootPath, virtualPath)

    try {
      // Ensure .devmate directory exists
      const devmateDir = join(rootPath, '.devmate')
      await fs.mkdir(devmateDir, { recursive: true })

      // Try to read existing file
      try {
        const content = await fs.readFile(fullPath, 'utf-8')
        return {
          type,
          path: virtualPath,
          content,
          exists: true,
        }
      } catch {
        // File doesn't exist, return default content
        const defaultContent = JSON.stringify(DEFAULT_CONTENTS[type], null, 2)
        return {
          type,
          path: virtualPath,
          content: defaultContent,
          exists: false,
        }
      }
    } catch (error: any) {
      throw new Error(
        `Failed to read virtual document ${type}: ${error.message}`
      )
    }
  }

  /**
   * Write virtual document content
   */
  static async writeVirtualDocument(
    projectId: string,
    type: VirtualDocumentType,
    content: string
  ): Promise<void> {
    const rootPath = await WorkspaceRegistry.getRootPath(projectId)
    const virtualPath = VIRTUAL_DOCUMENT_PATHS[type]
    const fullPath = join(rootPath, virtualPath)

    try {
      // Ensure .devmate directory exists
      const devmateDir = join(rootPath, '.devmate')
      await fs.mkdir(devmateDir, { recursive: true })

      // Validate JSON
      JSON.parse(content)

      // Write file
      await fs.writeFile(fullPath, content, 'utf-8')
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in ${type}: ${error.message}`)
      }
      throw new Error(
        `Failed to write virtual document ${type}: ${error.message}`
      )
    }
  }

  /**
   * Get all virtual documents for a project
   */
  static async getAllVirtualDocuments(projectId: string): Promise<VirtualDocument[]> {
    const documents: VirtualDocument[] = []
    for (const type of Object.keys(VIRTUAL_DOCUMENT_PATHS) as VirtualDocumentType[]) {
      try {
        const doc = await this.readVirtualDocument(projectId, type)
        documents.push(doc)
      } catch (error) {
        console.error(`Failed to read virtual document ${type}:`, error)
      }
    }
    return documents
  }
}
