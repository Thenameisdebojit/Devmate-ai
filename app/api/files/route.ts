import { NextRequest, NextResponse } from 'next/server'
import * as archiver from 'archiver'

interface ProjectFile {
  path: string
  content: string
}

interface ExportRequest {
  projectName: string
  files: ProjectFile[]
}

export async function POST(req: NextRequest) {
  try {
    const { projectName, files }: ExportRequest = await req.json()

    if (!projectName || !files || files.length === 0) {
      return NextResponse.json(
        { error: 'Project name and files are required' },
        { status: 400 }
      )
    }

    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    const chunks: Buffer[] = []

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
    })

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => {
        resolve(Buffer.concat(chunks))
      })
      archive.on('error', reject)
    })

    files.forEach(file => {
      archive.append(file.content, { name: `${projectName}/${file.path}` })
    })

    await archive.finalize()

    const zipBuffer = await archivePromise

    return new Response(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${projectName}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })
  } catch (error: any) {
    console.error('File export error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create ZIP file' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    features: ['zip_export', 'file_bundling'],
    max_files: 100,
    max_size_mb: 50
  })
}
