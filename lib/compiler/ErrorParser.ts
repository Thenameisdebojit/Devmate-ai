/**
 * Error Parser
 * 
 * Parses compiler errors and extracts diagnostics.
 */

export interface Diagnostic {
  file: string
  line: number
  column?: number
  severity: 'error' | 'warning' | 'info'
  message: string
  code?: string
  source?: string
}

/**
 * Error Parser
 * 
 * Parses compiler output to extract diagnostics.
 */
export class ErrorParser {
  private static instance: ErrorParser

  private constructor() {}

  static getInstance(): ErrorParser {
    if (!ErrorParser.instance) {
      ErrorParser.instance = new ErrorParser()
    }
    return ErrorParser.instance
  }

  /**
   * Parse compiler output
   */
  parse(output: string, compilerType?: string): Diagnostic[] {
    if (!output || !output.trim()) {
      return []
    }

    // Try different parsers based on compiler type
    if (compilerType) {
      switch (compilerType) {
        case 'gcc':
        case 'g++':
        case 'clang':
        case 'clang++':
          return this.parseGCC(output)
        case 'msvc':
          return this.parseMSVC(output)
        case 'javac':
          return this.parseJava(output)
        case 'tsc':
          return this.parseTypeScript(output)
        case 'rustc':
        case 'cargo':
          return this.parseRust(output)
        default:
          return this.parseGeneric(output)
      }
    }

    // Auto-detect format
    return this.parseGeneric(output)
  }

  /**
   * Parse GCC/Clang errors
   * Format: file:line:column: error: message
   */
  private parseGCC(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split('\n')

    const gccPattern = /^(.+?):(\d+):(\d+):\s*(error|warning|note):\s*(.+)$/
    const gccPatternNoCol = /^(.+?):(\d+):\s*(error|warning|note):\s*(.+)$/

    for (const line of lines) {
      let match = line.match(gccPattern)
      if (!match) {
        match = line.match(gccPatternNoCol)
      }

      if (match) {
        const [, file, lineNum, col, severity, message] = match
        diagnostics.push({
          file: file.trim(),
          line: parseInt(lineNum, 10),
          column: col ? parseInt(col, 10) : undefined,
          severity: this.normalizeSeverity(severity),
          message: message.trim(),
          source: 'gcc',
        })
      }
    }

    return diagnostics
  }

  /**
   * Parse MSVC errors
   * Format: file(line): error C####: message
   */
  private parseMSVC(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split('\n')

    const msvcPattern = /^(.+?)\((\d+)\):\s*(error|warning)\s+([A-Z]\d+):\s*(.+)$/

    for (const line of lines) {
      const match = line.match(msvcPattern)
      if (match) {
        const [, file, lineNum, severity, code, message] = match
        diagnostics.push({
          file: file.trim(),
          line: parseInt(lineNum, 10),
          severity: this.normalizeSeverity(severity),
          message: message.trim(),
          code: code.trim(),
          source: 'msvc',
        })
      }
    }

    return diagnostics
  }

  /**
   * Parse Java compiler errors
   * Format: file:line: error: message
   */
  private parseJava(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split('\n')

    const javaPattern = /^(.+?):(\d+):\s*(error|warning):\s*(.+)$/

    for (const line of lines) {
      const match = line.match(javaPattern)
      if (match) {
        const [, file, lineNum, severity, message] = match
        diagnostics.push({
          file: file.trim(),
          line: parseInt(lineNum, 10),
          severity: this.normalizeSeverity(severity),
          message: message.trim(),
          source: 'javac',
        })
      }
    }

    return diagnostics
  }

  /**
   * Parse TypeScript errors
   * Format: file(line,col): error TS####: message
   */
  private parseTypeScript(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split('\n')

    const tsPattern = /^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+TS(\d+):\s*(.+)$/

    for (const line of lines) {
      const match = line.match(tsPattern)
      if (match) {
        const [, file, lineNum, col, severity, code, message] = match
        diagnostics.push({
          file: file.trim(),
          line: parseInt(lineNum, 10),
          column: parseInt(col, 10),
          severity: this.normalizeSeverity(severity),
          message: message.trim(),
          code: `TS${code}`,
          source: 'tsc',
        })
      }
    }

    return diagnostics
  }

  /**
   * Parse Rust errors
   * Format: --> file:line:col
   */
  private parseRust(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split('\n')

    const rustPattern = /^--> (.+?):(\d+):(\d+)$/
    const errorPattern = /^error\[([A-Z]\d+)\]:\s*(.+)$/
    const warningPattern = /^warning:\s*(.+)$/

    let currentFile = ''
    let currentLine = 0
    let currentCol = 0
    let currentMessage = ''
    let currentSeverity: 'error' | 'warning' = 'error'
    let currentCode = ''

    for (const line of lines) {
      const rustMatch = line.match(rustPattern)
      if (rustMatch) {
        currentFile = rustMatch[1].trim()
        currentLine = parseInt(rustMatch[2], 10)
        currentCol = parseInt(rustMatch[3], 10)
        continue
      }

      const errorMatch = line.match(errorPattern)
      if (errorMatch) {
        currentCode = errorMatch[1]
        currentMessage = errorMatch[2].trim()
        currentSeverity = 'error'
        if (currentFile) {
          diagnostics.push({
            file: currentFile,
            line: currentLine,
            column: currentCol,
            severity: currentSeverity,
            message: currentMessage,
            code: currentCode,
            source: 'rustc',
          })
        }
        continue
      }

      const warningMatch = line.match(warningPattern)
      if (warningMatch) {
        currentMessage = warningMatch[1].trim()
        currentSeverity = 'warning'
        if (currentFile) {
          diagnostics.push({
            file: currentFile,
            line: currentLine,
            column: currentCol,
            severity: currentSeverity,
            message: currentMessage,
            source: 'rustc',
          })
        }
      }
    }

    return diagnostics
  }

  /**
   * Parse generic errors (fallback)
   */
  private parseGeneric(output: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = []
    const lines = output.split('\n')

    // Try to find file:line patterns
    const genericPattern = /^(.+?):(\d+)(?::(\d+))?:\s*(.+)$/

    for (const line of lines) {
      const match = line.match(genericPattern)
      if (match) {
        const [, file, lineNum, col, message] = match
        const lowerMessage = message.toLowerCase()
        const severity = lowerMessage.includes('error') ? 'error' :
                        lowerMessage.includes('warning') ? 'warning' : 'info'
        
        diagnostics.push({
          file: file.trim(),
          line: parseInt(lineNum, 10),
          column: col ? parseInt(col, 10) : undefined,
          severity,
          message: message.trim(),
        })
      } else if (line.trim() && !line.startsWith(' ')) {
        // Unstructured error message
        const lowerLine = line.toLowerCase()
        if (lowerLine.includes('error') || lowerLine.includes('warning')) {
          diagnostics.push({
            file: '',
            line: 0,
            severity: lowerLine.includes('error') ? 'error' : 'warning',
            message: line.trim(),
          })
        }
      }
    }

    return diagnostics
  }

  /**
   * Normalize severity string
   */
  private normalizeSeverity(severity: string): 'error' | 'warning' | 'info' {
    const lower = severity.toLowerCase()
    if (lower.includes('error')) return 'error'
    if (lower.includes('warning')) return 'warning'
    if (lower.includes('note') || lower.includes('info')) return 'info'
    return 'error'
  }
}

/**
 * Get Error Parser instance
 */
export function getErrorParser(): ErrorParser {
  return ErrorParser.getInstance()
}
