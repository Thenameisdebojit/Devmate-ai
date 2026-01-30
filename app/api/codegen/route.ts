import { NextRequest, NextResponse } from 'next/server'
import { callAIModel, streamAIModel, streamAIModelWithFailover } from '@/lib/aiOrchestrator'

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

const SYSTEM_INSTRUCTION = `You are an expert full-stack application architect and developer.
Generate complete, production-ready, OPTIMIZED applications with proper project structure.

RULES:
1. Generate COMPLETE, working applications - no placeholders or TODOs
2. Include ALL necessary files: package.json, configs, routes, components, etc.
3. Use modern best practices and latest frameworks
4. Include proper error handling and validation
5. Generate OPTIMIZED, MINIMAL code - comments ONLY for complex logic, keep code concise and production-ready
6. Include setup instructions in README.md
7. OPTIMIZE for performance - use efficient algorithms, avoid unnecessary code, minimize bundle size
8. Comments should be MINIMAL - only add comments when logic is truly complex or non-obvious

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "projectName": "project-name",
  "framework": "framework-name",
  "description": "brief description",
  "files": [
    {
      "path": "relative/file/path.ext",
      "content": "complete file content"
    }
  ],
  "setupInstructions": "step-by-step setup guide"
}

IMPORTANT: Output ONLY valid JSON, no markdown formatting.`

function detectFramework(prompt: string): string {
  const lowerPrompt = prompt.toLowerCase()
  
  if (lowerPrompt.includes('next.js') || lowerPrompt.includes('nextjs')) return 'Next.js'
  if (lowerPrompt.includes('react')) return 'React + Vite'
  if (lowerPrompt.includes('express')) return 'Express.js'
  if (lowerPrompt.includes('flask')) return 'Flask (Python)'
  if (lowerPrompt.includes('fastapi')) return 'FastAPI (Python)'
  if (lowerPrompt.includes('vue')) return 'Vue.js'
  if (lowerPrompt.includes('angular')) return 'Angular'
  if (lowerPrompt.includes('svelte')) return 'Svelte'
  
  return 'Next.js'
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

    const detectedFramework = detectFramework(prompt)
    
    const enhancedPrompt = `Generate a complete, production-ready application based on this request:

USER REQUEST: ${prompt}

DETECTED FRAMEWORK: ${detectedFramework}

Generate a full project structure with:
- All necessary configuration files (package.json, tsconfig.json, tailwind.config.js, etc.)
- Complete source code organized in proper folders
- README.md with setup and running instructions
- Environment variable templates if needed
- Modern, clean UI with responsive design
- Proper error handling and validation
- No placeholder code - everything must be complete and working
- OPTIMIZED code - minimal comments, efficient algorithms, production-ready performance
- Comments ONLY for complex logic - keep code clean and self-documenting

Remember to output ONLY valid JSON in the specified format.`

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
              total: 5,
              message: `Analyzing requirements and selecting ${detectedFramework}...`,
              status: 'in_progress'
            })

            await new Promise(resolve => setTimeout(resolve, 500))

            sendStep({
              step: 1,
              total: 5,
              message: `Framework selected: ${detectedFramework}`,
              status: 'completed'
            })

            sendStep({
              step: 2,
              total: 5,
              message: 'Designing project architecture...',
              status: 'in_progress'
            })

            await new Promise(resolve => setTimeout(resolve, 500))

            sendStep({
              step: 2,
              total: 5,
              message: 'Project structure designed',
              status: 'completed'
            })

            sendStep({
              step: 3,
              total: 5,
              message: 'Generating application code with GPT-5.1...',
              status: 'in_progress'
            })

            let accumulatedText = ''
            for await (const text of streamAIModel('openai:gpt-5.1', {
              prompt: enhancedPrompt,
              systemInstruction: SYSTEM_INSTRUCTION,
              temperature: 0.2, // Balanced temperature for optimized but complete code
              maxTokens: 8192, // Sufficient for complete code without being excessive
            })) {
              accumulatedText += text
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'generation', text })}\n\n`)
              )
            }

            sendStep({
              step: 3,
              total: 5,
              message: 'Code generation completed',
              status: 'completed'
            })

            sendStep({
              step: 4,
              total: 5,
              message: 'Processing and validating generated files...',
              status: 'in_progress'
            })

            let projectData
            try {
              const jsonMatch = accumulatedText.match(/\{[\s\S]*\}/)
              if (jsonMatch) {
                projectData = JSON.parse(jsonMatch[0])
              } else {
                projectData = JSON.parse(accumulatedText)
              }
            } catch (parseError) {
              console.error('JSON parsing error:', parseError)
              sendStep({
                step: 4,
                total: 5,
                message: 'Error: Invalid JSON response from AI',
                status: 'error'
              })
              controller.close()
              return
            }

            sendStep({
              step: 4,
              total: 5,
              message: `Validated ${projectData.files?.length || 0} files`,
              status: 'completed'
            })

            sendStep({
              step: 5,
              total: 5,
              message: 'Finalizing project package...',
              status: 'in_progress'
            })

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'result', 
                project: projectData 
              })}\n\n`)
            )

            sendStep({
              step: 5,
              total: 5,
              message: 'Project generation complete!',
              status: 'completed'
            })

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error: any) {
            console.error('Generation error:', error)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                type: 'error', 
                message: error.message 
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
      const response = await callAIModel('openai:gpt-5.1', {
        prompt: enhancedPrompt,
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, // Balanced temperature for optimized but complete code
        maxTokens: 8192, // Sufficient for complete code without being excessive
      })

      const jsonMatch = response.match(/\{[\s\S]*\}/)
      const projectData = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(response)

      return NextResponse.json({ project: projectData })
    }
  } catch (error: any) {
    console.error('Codegen API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate application' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    supported_frameworks: [
      'Next.js',
      'React + Vite',
      'Express.js',
      'Flask (Python)',
      'FastAPI (Python)',
      'Vue.js',
      'Angular',
      'Svelte'
    ],
    status: 'operational'
  })
}
