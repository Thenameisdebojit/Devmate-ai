/**
 * Diagnostics Manager
 * 
 * Manages compiler diagnostics and integrates with IDE.
 */

import { Diagnostic } from './ErrorParser'
import { EventEmitter } from 'events'

export interface DiagnosticsByFile {
  [file: string]: Diagnostic[]
}

/**
 * Diagnostics Manager
 * 
 * Manages and provides diagnostics for the IDE.
 */
export class DiagnosticsManager extends EventEmitter {
  private static instance: DiagnosticsManager
  private diagnostics: Map<string, Diagnostic[]> = new Map() // projectId -> diagnostics

  private constructor() {
    super()
  }

  static getInstance(): DiagnosticsManager {
    if (!DiagnosticsManager.instance) {
      DiagnosticsManager.instance = new DiagnosticsManager()
    }
    return DiagnosticsManager.instance
  }

  /**
   * Set diagnostics for a project
   */
  setDiagnostics(projectId: string, diagnostics: Diagnostic[]): void {
    this.diagnostics.set(projectId, diagnostics)
    this.emit('diagnostics-changed', { projectId, diagnostics })
  }

  /**
   * Add diagnostics to a project
   */
  addDiagnostics(projectId: string, diagnostics: Diagnostic[]): void {
    const existing = this.diagnostics.get(projectId) || []
    const combined = [...existing, ...diagnostics]
    this.setDiagnostics(projectId, combined)
  }

  /**
   * Clear diagnostics for a project
   */
  clearDiagnostics(projectId: string): void {
    this.diagnostics.delete(projectId)
    this.emit('diagnostics-changed', { projectId, diagnostics: [] })
  }

  /**
   * Get diagnostics for a project
   */
  getDiagnostics(projectId: string): Diagnostic[] {
    return this.diagnostics.get(projectId) || []
  }

  /**
   * Get diagnostics grouped by file
   */
  getDiagnosticsByFile(projectId: string): DiagnosticsByFile {
    const diagnostics = this.getDiagnostics(projectId)
    const grouped: DiagnosticsByFile = {}

    for (const diagnostic of diagnostics) {
      if (!grouped[diagnostic.file]) {
        grouped[diagnostic.file] = []
      }
      grouped[diagnostic.file].push(diagnostic)
    }

    return grouped
  }

  /**
   * Get diagnostics for a specific file
   */
  getFileDiagnostics(projectId: string, filePath: string): Diagnostic[] {
    const diagnostics = this.getDiagnostics(projectId)
    return diagnostics.filter((d) => d.file === filePath)
  }

  /**
   * Get error count
   */
  getErrorCount(projectId: string): number {
    const diagnostics = this.getDiagnostics(projectId)
    return diagnostics.filter((d) => d.severity === 'error').length
  }

  /**
   * Get warning count
   */
  getWarningCount(projectId: string): number {
    const diagnostics = this.getDiagnostics(projectId)
    return diagnostics.filter((d) => d.severity === 'warning').length
  }

  /**
   * Convert diagnostics to Monaco Editor markers
   */
  toMonacoMarkers(projectId: string, filePath: string): any[] {
    const diagnostics = this.getFileDiagnostics(projectId, filePath)
    
    return diagnostics.map((diagnostic) => ({
      severity: diagnostic.severity === 'error' ? 8 : 
                diagnostic.severity === 'warning' ? 4 : 2,
      startLineNumber: diagnostic.line,
      startColumn: diagnostic.column || 1,
      endLineNumber: diagnostic.line,
      endColumn: diagnostic.column || 1000,
      message: diagnostic.message,
      code: diagnostic.code,
      source: diagnostic.source,
    }))
  }
}

/**
 * Get Diagnostics Manager instance
 */
export function getDiagnosticsManager(): DiagnosticsManager {
  return DiagnosticsManager.getInstance()
}
