import { NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import { Readable } from 'stream'

export async function POST(req: NextRequest) {
  try {
    const { project } = await req.json()

    if (!project || !project.files) {
      return NextResponse.json({ error: 'Invalid project data' }, { status: 400 })
    }

    const archive = archiver('zip', { zlib: { level: 9 } })
    const stream = new Readable()
    stream._read = () => {}

    archive.on('data', (chunk) => stream.push(chunk))
    archive.on('end', () => stream.push(null))
    archive.on('error', (err) => {
      console.error('Archive error:', err)
      stream.destroy(err)
    })

    project.files.forEach((file: { path: string; content: string }) => {
      archive.append(file.content, { name: file.path })
    })

    if (project.setup) {
      archive.append(project.setup, { name: 'README.md' })
    }

    if (project.dependencies && project.dependencies.length > 0) {
      const packageJson = {
        name: project.name,
        version: '1.0.0',
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
        },
        dependencies: project.dependencies.reduce((acc: any, dep: string) => {
          acc[dep] = 'latest'
          return acc
        }, {}),
      }
      archive.append(JSON.stringify(packageJson, null, 2), { name: 'package.json' })
    }

    archive.finalize()

    const response = new NextResponse(stream as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${project.name}.zip"`,
      },
    })

    return response
  } catch (error: any) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create download' },
      { status: 500 }
    )
  }
}
