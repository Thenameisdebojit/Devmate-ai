/**
 * Compiler Service
 * 
 * Unified interface for multiple compilers and build tools.
 */

import { spawn, ChildProcess } from 'child_process'
import { promises as fs } from 'fs'
import { join } from 'path'
import { platform } from 'os'

export interface CompilerInfo {
  name: string
  version?: string
  path: string
  available: boolean
}

export interface CompileOptions {
  sourceFile: string
  outputFile?: string
  flags?: string[]
  cwd?: string
  env?: Record<string, string>
}

export interface CompileResult {
  success: boolean
  output?: string
  error?: string
  exitCode?: number
}

/**
 * Compiler Service
 * 
 * Provides unified interface for multiple compilers.
 */
export class CompilerService {
  private static instance: CompilerService
  private compilerCache: Map<string, CompilerInfo> = new Map()

  private constructor() {}

  static getInstance(): CompilerService {
    if (!CompilerService.instance) {
      CompilerService.instance = new CompilerService()
    }
    return CompilerService.instance
  }

  /**
   * Detect available compilers
   */
  async detectCompilers(): Promise<Map<string, CompilerInfo>> {
    const compilers = new Map<string, CompilerInfo>()

    // Detect C/C++ compilers
    await this.detectCompiler(compilers, 'gcc', 'gcc')
    await this.detectCompiler(compilers, 'g++', 'g++')
    await this.detectCompiler(compilers, 'clang', 'clang')
    await this.detectCompiler(compilers, 'clang++', 'clang++')

    // Detect Java compiler
    await this.detectCompiler(compilers, 'javac', 'javac')

    // Detect TypeScript compiler
    await this.detectCompiler(compilers, 'tsc', 'tsc')

    // Detect Rust compiler
    await this.detectCompiler(compilers, 'rustc', 'rustc')

    // Detect Go compiler
    await this.detectCompiler(compilers, 'go', 'go')

    return compilers
  }

  /**
   * Detect a specific compiler
   */
  private async detectCompiler(
    compilers: Map<string, CompilerInfo>,
    name: string,
    command: string
  ): Promise<void> {
    try {
      const version = await this.getCompilerVersion(command)
      const path = await this.findCompilerPath(command)
      
      compilers.set(name, {
        name,
        version,
        path,
        available: !!path,
      })
    } catch (error) {
      compilers.set(name, {
        name,
        path: '',
        available: false,
      })
    }
  }

  /**
   * Get compiler version
   */
  private async getCompilerVersion(command: string): Promise<string | undefined> {
    return new Promise((resolve) => {
      const process = spawn(command, ['--version'], { shell: true })
      let output = ''
      
      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      process.on('close', () => {
        const lines = output.split('\n')
        resolve(lines[0]?.trim())
      })
      
      process.on('error', () => {
        resolve(undefined)
      })
    })
  }

  /**
   * Find compiler path
   */
  private async findCompilerPath(command: string): Promise<string> {
    return new Promise((resolve) => {
      const isWindows = platform() === 'win32'
      const whichCommand = isWindows ? 'where' : 'which'
      
      const process = spawn(whichCommand, [command], { shell: true })
      let output = ''
      
      process.stdout.on('data', (data) => {
        output += data.toString()
      })
      
      process.on('close', () => {
        resolve(output.trim().split('\n')[0] || '')
      })
      
      process.on('error', () => {
        resolve('')
      })
    })
  }

  /**
   * Compile a file
   */
  async compile(options: CompileOptions): Promise<CompileResult> {
    const ext = options.sourceFile.split('.').pop()?.toLowerCase()
    
    switch (ext) {
      case 'c':
        return this.compileC(options)
      case 'cpp':
      case 'cxx':
      case 'cc':
        return this.compileCpp(options)
      case 'java':
        return this.compileJava(options)
      case 'ts':
        return this.compileTypeScript(options)
      case 'rs':
        return this.compileRust(options)
      case 'go':
        return this.compileGo(options)
      default:
        return {
          success: false,
          error: `Unsupported file type: ${ext}`,
        }
    }
  }

  /**
   * Compile C file
   */
  private async compileC(options: CompileOptions): Promise<CompileResult> {
    const outputFile = options.outputFile || options.sourceFile.replace(/\.c$/, '.exe')
    const compiler = 'gcc'
    const args = [
      options.sourceFile,
      '-o',
      outputFile,
      ...(options.flags || []),
    ]

    return this.executeCompiler(compiler, args, options)
  }

  /**
   * Compile C++ file
   */
  private async compileCpp(options: CompileOptions): Promise<CompileResult> {
    const outputFile = options.outputFile || options.sourceFile.replace(/\.(cpp|cxx|cc)$/, '.exe')
    const compiler = 'g++'
    const args = [
      options.sourceFile,
      '-o',
      outputFile,
      ...(options.flags || []),
    ]

    return this.executeCompiler(compiler, args, options)
  }

  /**
   * Compile Java file
   */
  private async compileJava(options: CompileOptions): Promise<CompileResult> {
    const compiler = 'javac'
    const args = [
      options.sourceFile,
      ...(options.flags || []),
    ]

    return this.executeCompiler(compiler, args, options)
  }

  /**
   * Compile TypeScript file
   */
  private async compileTypeScript(options: CompileOptions): Promise<CompileResult> {
    const compiler = 'tsc'
    const args = [
      options.sourceFile,
      ...(options.flags || []),
    ]

    return this.executeCompiler(compiler, args, options)
  }

  /**
   * Compile Rust file
   */
  private async compileRust(options: CompileOptions): Promise<CompileResult> {
    const outputFile = options.outputFile || options.sourceFile.replace(/\.rs$/, '')
    const compiler = 'rustc'
    const args = [
      options.sourceFile,
      '-o',
      outputFile,
      ...(options.flags || []),
    ]

    return this.executeCompiler(compiler, args, options)
  }

  /**
   * Compile Go file
   */
  private async compileGo(options: CompileOptions): Promise<CompileResult> {
    const compiler = 'go'
    const args = [
      'build',
      options.sourceFile,
      ...(options.flags || []),
    ]

    return this.executeCompiler(compiler, args, options)
  }

  /**
   * Execute compiler command
   */
  private async executeCompiler(
    compiler: string,
    args: string[],
    options: CompileOptions
  ): Promise<CompileResult> {
    return new Promise((resolve) => {
      const process = spawn(compiler, args, {
        cwd: options.cwd || process.cwd(),
        env: {
          ...process.env,
          ...options.env,
        },
        shell: true,
      })

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output: stdout,
          error: stderr,
          exitCode: code || undefined,
        })
      })

      process.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
        })
      })
    })
  }
}

/**
 * Get Compiler Service instance
 */
export function getCompilerService(): CompilerService {
  return CompilerService.getInstance()
}
