import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    const projectPath = join(process.cwd(), 'runtime-projects', projectId)

    try {
      await fs.access(projectPath)
    } catch {
      return NextResponse.json({ files: [] })
    }

    const files: Array<{ path: string; type: string }> = []

    async function walkDir(dir: string, basePath: string = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true })

      for (const entry of entries) {
        // Skip hidden files and common ignore patterns
        if (entry.name.startsWith('.') && entry.name !== '.git') {
          continue
        }

        const fullPath = join(dir, entry.name)
        const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name

        if (entry.isDirectory()) {
          // Skip node_modules, .git, etc.
          if (['node_modules', '.git', '.next', 'dist', 'build'].includes(entry.name)) {
            continue
          }
          await walkDir(fullPath, relativePath)
        } else {
          files.push({
            path: relativePath,
            type: 'file',
          })
        }
      }
    }

    await walkDir(projectPath)

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error('List files error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to list files' },
      { status: 500 }
    )
  }
}

