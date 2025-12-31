import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { promises as fs } from 'fs'
import archiver from 'archiver'

interface ProjectFile {
  path: string
  content: string
}

interface GenerationStep {
  step: number
  total: number
  message: string
  status: 'in_progress' | 'completed' | 'error'
}

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for Vercel Pro, 10s for Hobby

// Simple logger for serverless environments
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, stream = true } = await req.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    if (stream) {
      const encoder = new TextEncoder()
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            const sendStep = (step: GenerationStep) => {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'step', ...step })}\n\n`)
              )
            }

            sendStep({
              step: 1,
              total: 6,
              message: 'Initializing autonomous development agent...',
              status: 'in_progress'
            })

            // Call Python script
            const agentDir = join(process.cwd(), 'autonomus-dev-agent')
            const scriptPath = join(agentDir, 'api_wrapper.py')
            // Try python3 first, fallback to python
            const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'

            sendStep({
              step: 1,
              total: 6,
              message: 'Checking Python dependencies...',
              status: 'in_progress'
            })

            // Check if we're in a serverless environment (Vercel) where Python subprocess won't work
            const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME || !process.env.PATH?.includes('python')
            
            if (!isServerless) {
              // Check if Python dependencies are installed (only in non-serverless environments)
              const checkDepsProcess = spawn(pythonCommand, ['-c', 'import langchain_google_genai; import langgraph; import langchain'], {
                cwd: agentDir,
                env: { ...process.env, PYTHONPATH: agentDir }
              })

              let depsCheckError = ''
              checkDepsProcess.stderr.on('data', (data) => {
                depsCheckError += data.toString()
              })

              await new Promise<void>((resolve, reject) => {
                checkDepsProcess.on('close', (code) => {
                  if (code !== 0) {
                    // Fallback to direct AI generation if Python deps not available
                    logger.warn('Python dependencies not available, using direct AI generation')
                    resolve() // Continue with fallback
                  } else {
                    resolve()
                  }
                })
                checkDepsProcess.on('error', (error) => {
                  // Fallback to direct AI generation
                  logger.warn(`Python check failed: ${error.message}, using direct AI generation`)
                  resolve() // Continue with fallback
                })
              })
            } else {
              logger.info('Serverless environment detected, using direct AI generation')
            }

            sendStep({
              step: 1,
              total: 6,
              message: 'Agent initialized, analyzing requirements...',
              status: 'completed'
            })

            sendStep({
              step: 2,
              total: 6,
              message: 'Generating complete application...',
              status: 'in_progress'
            })

            let projectData: any
            let usePythonAgent = !isServerless

            if (usePythonAgent) {
              // Try to use Python agent
              try {
                // Run Python script from the agent directory so relative imports work
                const pythonProcess = spawn(pythonCommand, ['api_wrapper.py', prompt], {
                  cwd: agentDir,
                  env: { 
                    ...process.env, 
                    PYTHONUNBUFFERED: '1',
                    PYTHONPATH: agentDir
                  }
                })

                let stdout = ''
                let stderr = ''

                pythonProcess.stdout.on('data', (data) => {
                  stdout += data.toString()
                })

                pythonProcess.stderr.on('data', (data) => {
                  stderr += data.toString()
                })

                await new Promise<void>((resolve, reject) => {
                  pythonProcess.on('close', (code) => {
                    if (code !== 0) {
                      // Fallback to direct generation
                      console.warn(`Python agent failed (code ${code}), using direct AI generation`)
                      usePythonAgent = false
                      resolve()
                    } else {
                      // Parse Python output
                      try {
                        const jsonMatch = stdout.match(/\{[\s\S]*\}/)
                        if (jsonMatch) {
                          projectData = JSON.parse(jsonMatch[0])
                          if (projectData.success) {
                            resolve()
                          } else {
                            throw new Error(projectData.error || 'Generation failed')
                          }
                        } else {
                          throw new Error('No JSON found in Python output')
                        }
                      } catch (parseError: any) {
                        console.warn(`Failed to parse Python output: ${parseError.message}, using direct AI generation`)
                        usePythonAgent = false
                        resolve()
                      }
                    }
                  })
                  pythonProcess.on('error', (error) => {
                    console.warn(`Python process error: ${error.message}, using direct AI generation`)
                    usePythonAgent = false
                    resolve()
                  })
                })
              } catch (error: any) {
                console.warn(`Python agent error: ${error.message}, using direct AI generation`)
                usePythonAgent = false
              }
            }

            // Fallback to direct AI generation if Python agent not available or failed
            if (!usePythonAgent || !projectData) {
              const { generateAppDirect } = await import('@/lib/appGenerator')
              projectData = await generateAppDirect(prompt)
              projectData.success = true
            }

            sendStep({
              step: 2,
              total: 6,
              message: 'Application generation completed',
              status: 'completed'
            })

            sendStep({
              step: 3,
              total: 6,
              message: 'Processing generated files...',
              status: 'in_progress'
            })

            sendStep({
              step: 3,
              total: 6,
              message: `Processed ${projectData.files?.length || 0} files`,
              status: 'completed'
            })

            sendStep({
              step: 4,
              total: 6,
              message: 'Validating project structure...',
              status: 'in_progress'
            })

            // Ensure we have the required structure
            if (!projectData.files || !Array.isArray(projectData.files) || projectData.files.length === 0) {
              throw new Error(`Invalid project structure: No files were generated. ${projectData.error || 'The generation may have failed. Please try again or check the logs.'}`)
            }

            // Convert to expected format
            const formattedProject = {
              projectName: projectData.projectName || 'generated-project',
              framework: projectData.framework || 'Next.js',
              description: projectData.description || prompt.substring(0, 100),
              files: projectData.files.map((f: any) => ({
                path: f.path || f,
                content: f.content || ''
              })),
              setupInstructions: projectData.setupInstructions || 'See README.md for setup instructions.'
            }

            sendStep({
              step: 4,
              total: 6,
              message: 'Project structure validated',
              status: 'completed'
            })

            sendStep({
              step: 5,
              total: 6,
              message: 'Preparing download package...',
              status: 'in_progress'
            })

            sendStep({
              step: 5,
              total: 6,
              message: 'Package ready',
              status: 'completed'
            })

            sendStep({
              step: 6,
              total: 6,
              message: 'Generation complete!',
              status: 'completed'
            })

            // Send final result
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'result', 
                project: formattedProject 
              })}\n\n`)
            )

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error: any) {
            console.error('Generation error:', error)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'error', 
                message: error.message || 'Failed to generate application' 
              })}\n\n`)
            )
            controller.close()
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Non-streaming mode (fallback)
      return NextResponse.json(
        { error: 'Streaming mode is required' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Generate App API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate application' },
      { status: 500 }
    )
  }
}

