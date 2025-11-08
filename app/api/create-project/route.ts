import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface ProjectFile {
  path: string
  content: string
}

function sanitizePath(unsafePath: string): string | null {
  const normalized = path.normalize(unsafePath).replace(/^(\.\.(\/|\\|$))+/, '')
  
  if (normalized.includes('..') || 
      path.isAbsolute(normalized) || 
      normalized.startsWith('/') || 
      normalized.startsWith('\\')) {
    return null
  }
  
  return normalized
}

function sanitizeProjectName(name: string): string | null {
  const sanitized = name.replace(/[^a-zA-Z0-9-_]/g, '-')
  
  if (sanitized.includes('..') || 
      sanitized.startsWith('.') || 
      sanitized.length === 0 || 
      sanitized.length > 100) {
    return null
  }
  
  return sanitized
}

export async function POST(req: NextRequest) {
  try {
    const { projectName, files }: {
      projectName: string
      files: ProjectFile[]
    } = await req.json()

    if (!projectName || !files || files.length === 0) {
      return NextResponse.json(
        { error: 'Project name and files are required' },
        { status: 400 }
      )
    }

    const sanitizedProjectName = sanitizeProjectName(projectName)
    if (!sanitizedProjectName) {
      return NextResponse.json(
        { error: 'Invalid project name. Use only alphanumeric characters, hyphens, and underscores.' },
        { status: 400 }
      )
    }

    const SAFE_BASE_DIR = 'generated-projects'
    const projectPath = path.join(process.cwd(), SAFE_BASE_DIR, sanitizedProjectName)
    const resolvedProjectPath = path.resolve(projectPath)

    try {
      await fs.access(projectPath)
      return NextResponse.json(
        { error: 'Project already exists. Please choose a different name.' },
        { status: 409 }
      )
    } catch {
    }

    await fs.mkdir(projectPath, { recursive: true })

    const createdFiles: string[] = []
    for (const file of files) {
      const sanitizedFilePath = sanitizePath(file.path)
      if (!sanitizedFilePath) {
        return NextResponse.json(
          { error: `Invalid file path detected: ${file.path}` },
          { status: 400 }
        )
      }

      const fullPath = path.join(projectPath, sanitizedFilePath)
      const resolvedFullPath = path.resolve(fullPath)
      
      if (!resolvedFullPath.startsWith(resolvedProjectPath + path.sep)) {
        return NextResponse.json(
          { error: `Path traversal attempt detected: ${file.path}` },
          { status: 400 }
        )
      }

      const fileDir = path.dirname(fullPath)
      await fs.mkdir(fileDir, { recursive: true })
      await fs.writeFile(fullPath, file.content, 'utf-8')
      createdFiles.push(sanitizedFilePath)
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdFiles.length} files`,
      projectPath: `generated-projects/${sanitizedProjectName}`,
      files: createdFiles,
    })
  } catch (error: any) {
    console.error('Project creation error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create project' },
      { status: 500 }
    )
  }
}
