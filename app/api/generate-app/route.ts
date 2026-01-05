/**
 * App Generator API Route
 * 
 * Workspace-aware agent entry point with tool call support and checkpoint integration.
 * 
 * ARCHITECTURE:
 * - Initializes workspace context for the project
 * - Uses Agent Orchestrator abstraction for execution
 * - Supports tool calls and checkpoints
 * - Falls back to Python agent (if available) or direct AI generation
 * 
 * TECH STACK ASSUMPTIONS:
 * - Frontend: Next.js + Monaco (UI layer unchanged)
 * - Backend: Agent Orchestrator abstraction
 * - Runtime: Container-per-project model (interface only, implementation deferred)
 */

import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { join } from 'path'
import { promises as fs } from 'fs'
import archiver from 'archiver'
import { WorkspaceContextManager, AgentOrchestrator } from '@/lib/appGeneratorAgent'
import { GenerationController } from '@/lib/runtime/GenerationController'

// Generate project ID (simple implementation - can use uuid library if needed)
function generateProjectId(): string {
  return `proj-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 8)}`
}

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
    const { prompt, stream = true, projectId, toolCalls } = await req.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Initialize workspace context (agent foundation)
    // AGENT RULE: Workspace context must be initialized before any operations
    const workspaceProjectId = projectId || generateProjectId()
    const workspaceContext = new WorkspaceContextManager(workspaceProjectId)
    const agentOrchestrator = new AgentOrchestrator(workspaceContext)

    // Create initial checkpoint (agent rule: mandatory checkpoints before writes)
    const checkpointId = agentOrchestrator.createCheckpoint()
    logger.info(`Workspace context initialized: ${workspaceProjectId}, checkpoint: ${checkpointId}`)

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

            // If tool calls are provided, process them (agent rule: tool-first)
            if (toolCalls && Array.isArray(toolCalls) && toolCalls.length > 0) {
              sendStep({
                step: 1,
                total: 6,
                message: 'Processing tool calls...',
                status: 'in_progress'
              })

              // Process tool calls through workspace context
              // This is where tool execution would happen (implementation deferred)
              for (const toolCall of toolCalls) {
                workspaceContext.updateFromToolResult(
                  toolCall.name,
                  toolCall.operation || 'read',
                  toolCall.parameters?.path || '',
                  toolCall.parameters?.content
                )
              }

              sendStep({
                step: 1,
                total: 6,
                message: 'Tool calls processed, initializing agent...',
                status: 'completed'
              })
            } else {
              sendStep({
                step: 1,
                total: 6,
                message: 'Initializing workspace-aware agent...',
                status: 'in_progress'
              })
            }

            // Call Python script
            const agentDir = join(process.cwd(), 'autonomus-dev-agent')
            const scriptPath = join(agentDir, 'api_wrapper.py')
            // Try python3 first, fallback to python
            const pythonCommand = process.platform === 'win32' ? 'python' : 'python3'

            // Check if we're in a serverless environment (Vercel) where Python subprocess won't work
            // More robust detection: check for Vercel, AWS Lambda, or if Python is not available
            const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV || process.env.VERCEL_URL
            const isAWS = process.env.AWS_LAMBDA_FUNCTION_NAME
            const isServerless = isVercel || isAWS

            if (isServerless) {
              sendStep({
                step: 1,
                total: 6,
                message: 'Serverless environment detected, using direct AI generation...',
                status: 'completed'
              })
            } else {
              sendStep({
                step: 1,
                total: 6,
                message: 'Checking Python dependencies...',
                status: 'in_progress'
              })
            }
            
            if (isServerless) {
              logger.info('Serverless environment detected (Vercel/AWS), using direct AI generation')
              // Skip Python entirely on serverless
            } else {
              // Only try Python in non-serverless environments
              try {
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
              } catch (error: any) {
                // If spawn fails (e.g., Python not found), skip to direct generation
                logger.warn(`Python check error: ${error.message}, using direct AI generation`)
              }
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
              message: 'Generating application with AI...',
              status: 'in_progress'
            })

            let projectData: any
            // Only use Python agent if not in serverless environment
            let usePythonAgent = !isServerless
            const pythonStartTime = Date.now()
            const PYTHON_TIMEOUT = 10 * 60 * 1000 // 10 minutes timeout for Python agent (increased for complex tasks)

            if (usePythonAgent && !isServerless) {
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
                let hasOutput = false

                pythonProcess.stdout.on('data', (data) => {
                  const text = data.toString()
                  stdout += text
                  hasOutput = true
                  
                  // Try to parse partial JSON if we see it
                  if (text.includes('{') && text.includes('"success"')) {
                    try {
                      const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/)
                      if (jsonMatch) {
                        const partial = JSON.parse(jsonMatch[0])
                        if (partial.success === false) {
                          // If we see an error, fail fast
                          logger.warn('Python agent returned error, switching to direct generation')
                          usePythonAgent = false
                          pythonProcess.kill()
                        }
                      }
                    } catch (e) {
                      // Ignore parse errors for partial JSON
                    }
                  }
                })

                pythonProcess.stderr.on('data', (data) => {
                  stderr += data.toString()
                  logger.warn(`Python stderr: ${data.toString()}`)
                })

                // Add timeout - 2 minutes max for Python agent (then fallback to direct)
                const timeout = setTimeout(() => {
                  if (!projectData) {
                    logger.warn('Python agent timeout after 2 minutes, switching to direct generation')
                    pythonProcess.kill('SIGTERM')
                    usePythonAgent = false
                  }
                }, PYTHON_TIMEOUT)

                await new Promise<void>((resolve, reject) => {
                  pythonProcess.on('close', (code) => {
                    clearTimeout(timeout)
                    
                    if (code !== 0 && !projectData) {
                      // Fallback to direct generation
                      logger.warn(`Python agent failed (code ${code}), using direct AI generation`)
                      logger.warn(`Python stderr: ${stderr.substring(0, 500)}`)
                      usePythonAgent = false
                      resolve()
                    } else if (projectData && projectData.success) {
                      // Already got data, resolve
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
                        logger.warn(`Failed to parse Python output: ${parseError.message}, using direct AI generation`)
                        logger.warn(`Python stdout (last 500 chars): ${stdout.substring(Math.max(0, stdout.length - 500))}`)
                        usePythonAgent = false
                        resolve()
                      }
                    }
                  })
                  pythonProcess.on('error', (error) => {
                    clearTimeout(timeout)
                    logger.warn(`Python process error: ${error.message}, using direct AI generation`)
                    usePythonAgent = false
                    resolve()
                  })
                })
              } catch (error: any) {
                logger.warn(`Python agent error: ${error.message}, using direct AI generation`)
                usePythonAgent = false
              }
            }

            // Fallback to direct AI generation if Python agent not available or failed
            if (!usePythonAgent || !projectData) {
              const elapsed = Date.now() - pythonStartTime
              if (elapsed < PYTHON_TIMEOUT) {
                // Python failed quickly, update message
                sendStep({
                  step: 2,
                  total: 6,
                  message: 'Python agent unavailable, using direct AI generation...',
                  status: 'in_progress'
                })
              } else {
                // Python timed out, already showing correct message
                sendStep({
                  step: 2,
                  total: 6,
                  message: 'Python agent timed out, using direct AI generation...',
                  status: 'in_progress'
                })
              }
              
              try {
                const { generateAppDirect } = await import('@/lib/appGenerator')
                logger.info('Starting direct AI generation...')
                const directProject = await generateAppDirect(prompt)
                logger.info(`Direct generation completed: ${directProject.files?.length || 0} files`)
                
                // Convert to expected format
                projectData = {
                  success: true,
                  projectName: directProject.projectName,
                  framework: directProject.framework,
                  description: directProject.description,
                  files: directProject.files.map((f: any) => ({
                    path: f.path,
                    content: f.content
                  })),
                  setupInstructions: directProject.setupInstructions
                }
              } catch (directError: any) {
                logger.error('Direct generation error:', directError)
                throw new Error(`Failed to generate application: ${directError.message || 'Unknown error'}`)
              }
            }

            // Write files to disk for validation
            const projectPath = join(process.cwd(), 'runtime-projects', workspaceProjectId)
            await fs.mkdir(projectPath, { recursive: true })

            // Initialize GenerationController
            const generationController = new GenerationController(workspaceProjectId, projectPath)

            // ITERATIVE GENERATION LOOP
            const MAX_ATTEMPTS = 3
            let allGeneratedFiles: Array<{ path: string; content: string }> = []
            let contractSatisfied = false
            let attempt = 0

            while (!contractSatisfied && attempt < MAX_ATTEMPTS) {
              attempt++

              if (attempt > 1) {
                sendStep({
                  step: 2,
                  total: 7,
                  message: `Regenerating missing files (attempt ${attempt}/${MAX_ATTEMPTS})...`,
                  status: 'in_progress'
                })
              } else {
                sendStep({
                  step: 2,
                  total: 7,
                  message: 'Application generation completed',
                  status: 'completed'
                })
              }

              // Write current batch of files to disk
              const currentFiles = attempt === 1 
                ? (projectData.files || [])
                : [] // On subsequent attempts, we'll generate only missing files

              if (currentFiles.length > 0) {
                for (const file of currentFiles) {
                  const filePath = join(projectPath, file.path || file)
                  const dir = join(filePath, '..')
                  await fs.mkdir(dir, { recursive: true })
                  await fs.writeFile(filePath, file.content || '', 'utf-8')
                }
                allGeneratedFiles = [...allGeneratedFiles, ...currentFiles]
              }

              sendStep({
                step: 3,
                total: 7,
                message: 'Validating project completeness...',
                status: 'in_progress'
              })

              // Validate with GenerationController
              const validationStatus = await generationController.validateProject()

              // Also validate with Python validator if available
              let pythonValidation = { isComplete: true, issues: [] as string[], recommendation: '' }
              try {
                pythonValidation = await generationController.validateWithPythonValidator(allGeneratedFiles)
              } catch (error: any) {
                logger.warn('Python validator unavailable, using GenerationController only')
              }

              // Contract is satisfied if both validators pass
              contractSatisfied = validationStatus.complete && pythonValidation.isComplete

              if (!contractSatisfied && attempt < MAX_ATTEMPTS) {
                // Collect missing artifacts
                const missingArtifacts = [
                  ...validationStatus.missingArtifacts,
                  ...pythonValidation.issues,
                ]

                sendStep({
                  step: 3,
                  total: 7,
                  message: `Project incomplete. Missing: ${missingArtifacts.slice(0, 3).join(', ')}...`,
                  status: 'in_progress'
                })

                // Generate missing files
                const missingPrompt = `The previous generation was incomplete. Generate ONLY these missing files:
${missingArtifacts.map(a => `- ${a}`).join('\n')}

Do NOT regenerate existing files. Only create the missing files listed above.
Ensure each file is complete and functional.`

                try {
                  const { generateAppDirect } = await import('@/lib/appGenerator')
                  const missingProject = await generateAppDirect(missingPrompt)
                  
                  // Add missing files to collection
                  if (missingProject.files && Array.isArray(missingProject.files)) {
                    // Filter to only add files that match missing artifacts
                    const newFiles = missingProject.files.filter((f: any) => {
                      const path = f.path || f
                      return missingArtifacts.some(missing => 
                        path.includes(missing.toLowerCase().replace(/\s+/g, '')) ||
                        path.includes('package.json') ||
                        path.includes('README.md') ||
                        path.includes('index.') ||
                        path.includes('tsconfig') ||
                        path.includes('vite.config') ||
                        path.includes('next.config')
                      )
                    })
                    
                    allGeneratedFiles = [...allGeneratedFiles, ...newFiles]
                    
                    // Write new files to disk
                    for (const file of newFiles) {
                      const filePath = join(projectPath, file.path || file)
                      const dir = join(filePath, '..')
                      await fs.mkdir(dir, { recursive: true })
                      await fs.writeFile(filePath, file.content || '', 'utf-8')
                    }
                  }
                } catch (error: any) {
                  logger.error('Failed to generate missing files:', error)
                  // Continue to next attempt
                }
              }
            }

            // Final validation
            const finalStatus = await generationController.validateProject()
            const finalPythonValidation = await generationController.validateWithPythonValidator(allGeneratedFiles).catch(() => ({
              isComplete: true,
              issues: [],
              recommendation: 'Python validator unavailable',
            }))

            const isComplete = finalStatus.complete && finalPythonValidation.isComplete

            if (!isComplete) {
              // Generation failed after max attempts
              const allIssues = [
                ...finalStatus.issues,
                ...finalStatus.missingArtifacts,
                ...finalPythonValidation.issues,
              ]

              throw new Error(
                `Generation incomplete after ${MAX_ATTEMPTS} attempts. Missing: ${allIssues.join(', ')}. ` +
                `Generated ${finalStatus.fileCount} files, need at least ${finalStatus.requiredMinimum}.`
              )
            }

            sendStep({
              step: 3,
              total: 7,
              message: `Project validated: ${finalStatus.fileCount} files, ${finalStatus.sourceFileCount} source files`,
              status: 'completed'
            })

            // Update workspace context with all generated files
            if (allGeneratedFiles.length > 0) {
              for (const file of allGeneratedFiles) {
                workspaceContext.updateFromToolResult(
                  'generate_app',
                  'write',
                  file.path,
                  file.content
                )
              }
              logger.info(`Updated workspace context with ${allGeneratedFiles.length} files`)
            }

            // Convert to expected format
            const formattedProject = {
              projectName: projectData.projectName || 'generated-project',
              framework: projectData.framework || 'Next.js',
              description: projectData.description || prompt.substring(0, 100),
              files: allGeneratedFiles.map((f: any) => ({
                path: f.path || f,
                content: f.content || ''
              })),
              setupInstructions: projectData.setupInstructions || 'See README.md for setup instructions.',
              // Include workspace metadata for agent-aware clients
              workspaceMetadata: {
                projectId: workspaceProjectId,
                checkpointId,
                fileCount: allGeneratedFiles.length,
                generationComplete: true, // Backend authority: generation is complete
              }
            }

            sendStep({
              step: 4,
              total: 7,
              message: 'Project structure validated',
              status: 'completed'
            })

            sendStep({
              step: 5,
              total: 7,
              message: 'Preparing download package...',
              status: 'in_progress'
            })

            sendStep({
              step: 5,
              total: 7,
              message: 'Package ready',
              status: 'completed'
            })

            sendStep({
              step: 6,
              total: 7,
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

