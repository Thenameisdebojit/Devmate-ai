import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'

interface ProjectFile {
  path: string
  content: string
}

interface ExportRequest {
  projectName: string
  files: ProjectFile[]
}

export const runtime = 'nodejs' // ✅ Ensures Node APIs like archiver are supported

export async function POST(req: NextRequest) {
  try {
    const { projectName, files }: ExportRequest = await req.json()

    if (!projectName || !files || files.length === 0) {
      return NextResponse.json(
        { error: 'Project name and files are required' },
        { status: 400 }
      )
    }

    // ✅ Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []

    // Collect archive chunks
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    // ✅ Add files to archive
    for (const file of files) {
      archive.append(file.content, { name: `${projectName}/${file.path}` })
    }

    await archive.finalize()
    const zipBuffer = await archivePromise

    // ✅ Convert Buffer → ReadableStream (Node-compatible Response)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(zipBuffer)
        controller.close()
      },
    })

    // ✅ Return ZIP as downloadable file
    return new Response(stream, {
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
    max_size_mb: 50,
  })
}
