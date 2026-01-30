import { NextRequest, NextResponse } from 'next/server'

// Mock extensions data - in production, this would come from a database or extension marketplace
const mockInstalledExtensions = [
  {
    id: 'ms-vscode.cpptools',
    name: 'C/C++',
    publisher: 'Microsoft',
    description: 'C/C++ IntelliSense, debugging, and code browsing.',
    version: '1.29.3',
    installed: true,
    enabled: true,
    rating: 4.0,
    downloadCount: 92996993,
    performance: '206ms',
    categories: ['Programming Languages', 'Debuggers', 'Formatters', 'Linters', 'Snippets'],
    repository: 'https://github.com/microsoft/vscode-cpptools',
    issues: 'https://github.com/microsoft/vscode-cpptools/issues',
    documentation: 'https://code.visualstudio.com/docs/languages/cpp',
    license: 'MIT',
    lastUpdated: '1 month ago',
    publishedDate: '9 years ago',
    size: '233.63MB',
  },
  {
    id: 'ms-vscode.vscode-typescript-next',
    name: 'TypeScript',
    publisher: 'Microsoft',
    description: 'TypeScript support for Visual Studio Code',
    version: '5.7.0',
    installed: true,
    enabled: true,
    rating: 4.5,
    downloadCount: 50000000,
    performance: '50ms',
    categories: ['Programming Languages'],
  },
  {
    id: 'formulahendry.code-runner',
    name: 'Code Runner',
    publisher: 'Jun Han',
    description: 'Run C, C++, Java, JS, PHP, Python, Perl, Ruby, Go, Lua, Groovy, PowerShell, CMD, BASH, F#, C#, VBScript, TypeScript, CoffeeScript, Scala, Swift, Julia, Crystal, OCaml, R, AppleScript, Elixir, VB.NET, Clojure, Haxe, Obj-C, Rust, Racket, Scheme, AutoHotkey, AutoIt, Kotlin, Dart, Free Pascal, Haskell, Nim, D, Lisp, Kit, V, SCSS, Sass, CUDA, Less, Fortran, Erlang',
    version: '0.12.0',
    installed: true,
    enabled: true,
    rating: 4.5,
    downloadCount: 15000000,
    performance: '93ms',
    categories: ['Other'],
  },
]

const mockRecommendedExtensions = [
  {
    id: 'ms-python.python',
    name: 'Python',
    publisher: 'Microsoft',
    description: 'IntelliSense (Pylance), Linting, Debugging (multi-threaded, remote), Jupyter Notebooks, code formatting, refactoring, unit tests, and more.',
    version: '2024.0.0',
    installed: false,
    enabled: false,
    rating: 4.8,
    downloadCount: 80000000,
    categories: ['Programming Languages', 'Debuggers'],
  },
  {
    id: 'esbenp.prettier-vscode',
    name: 'Prettier - Code formatter',
    publisher: 'Prettier',
    description: 'Code formatter using prettier',
    version: '10.0.0',
    installed: false,
    enabled: false,
    rating: 4.6,
    downloadCount: 25000000,
    categories: ['Formatters'],
  },
]

export async function GET(request: NextRequest) {
  try {
    // In production, fetch from database or extension marketplace
    return NextResponse.json({
      installed: mockInstalledExtensions,
      recommended: mockRecommendedExtensions,
    })
  } catch (error: any) {
    console.error('[extensions/list] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to load extensions' },
      { status: 500 }
    )
  }
}
