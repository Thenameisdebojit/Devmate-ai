import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import mammoth from 'mammoth'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

// Dynamic import for pdf-parse to avoid ESM issues
const getPdfParse = async () => {
  const pdfParse = await import('pdf-parse')
  return pdfParse.default || pdfParse
}

async function processFile(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name
  const fileType = file.type

  try {
    // Handle images with OpenAI Vision API
    if (fileType.startsWith('image/')) {
      const base64Image = buffer.toString('base64')
      const dataUrl = `data:${fileType};base64,${base64Image}`
      
      return {
        name: fileName,
        type: 'image',
        content: dataUrl,
        analysis: null
      }
    }

    // Handle PDF files
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        const pdfParse = await getPdfParse()
        const data = await pdfParse(buffer)
        return {
          name: fileName,
          type: 'pdf',
          content: data.text,
          pages: data.numpages
        }
      } catch (error) {
        return {
          name: fileName,
          type: 'pdf',
          content: '[PDF parsing failed - file may be corrupted or encrypted]',
          pages: 0
        }
      }
    }

    // Handle DOCX files
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer })
      return {
        name: fileName,
        type: 'docx',
        content: result.value
      }
    }

    // Handle CSV files
    if (fileType === 'text/csv' || fileName.endsWith('.csv')) {
      const text = buffer.toString('utf-8')
      const lines = text.split('\n').filter(line => line.trim())
      
      return {
        name: fileName,
        type: 'csv',
        content: text,
        rows: lines.length
      }
    }

    // Handle plain text files
    if (fileType.startsWith('text/') || fileName.endsWith('.txt')) {
      return {
        name: fileName,
        type: 'text',
        content: buffer.toString('utf-8')
      }
    }

    throw new Error(`Unsupported file type: ${fileType}`)
  } catch (error: any) {
    throw new Error(`Error processing ${fileName}: ${error.message}`)
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]
    
    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Process all files in parallel
    const processedFiles = await Promise.all(
      files.map(file => processFile(file))
    )

    return NextResponse.json({
      success: true,
      files: processedFiles,
      count: processedFiles.length
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process files' },
      { status: 500 }
    )
  }
}
