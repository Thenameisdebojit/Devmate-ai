import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver' // ✅ FIXED — default import instead of `* as archiver`

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

    // ✅ Create the archive
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Uint8Array[] = []

    // Collect archive data into memory
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    const archivePromise = new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    // ✅ Append all files into the zip
    files.forEach((file) => {
      archive.append(file.content, { name: `${projectName}/${file.path}` })
    })

    await archive.finalize()
    const zipBuffer = await archivePromise

    // ✅ Return zip as downloadable file
    return new Response(zipBuffer, {
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

