import { NextRequest } from 'next/server'
import { callAIModelWithFailover } from '@/lib/aiOrchestrator'
import { validateProject, validatePlan, type Plan } from '@/lib/aiSchemas'

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  
  let prompt: string
  let plan: Plan
  let selectedModel: string
  
  try {
    const body = await req.json()
    prompt = body.prompt
    selectedModel = body.selectedModel || 'auto'
    
    // Validate request
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid prompt')
    }
    
    if (!body.plan || typeof body.plan !== 'object') {
      throw new Error('Invalid plan')
    }
    
    // Validate plan structure
    plan = validatePlan(body.plan)
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        send({ type: 'status', message: 'Starting project generation...' })

        const systemInstruction = `You are an expert full-stack developer. Generate COMPLETE, PRODUCTION-READY code based on the plan.

CRITICAL REQUIREMENTS:
1. Generate ALL files mentioned in the plan
2. Include COMPLETE code - no placeholders, no TODOs
3. Add proper error handling and validation
4. Include comments for complex logic
5. Follow best practices for the chosen framework
6. Make code copy-paste ready

Plan:
${JSON.stringify(plan, null, 2)}

Generate each file with this format:
FILE: path/to/file.ext
\`\`\`language
// complete file content
\`\`\`

Also include setup instructions at the end.`

        send({ type: 'status', message: 'Generating code with AI...' })

        let response
        try {
          response = await callAIModelWithFailover({
            prompt,
            domain: 'web-dev',
            action: 'generate',
            systemInstruction,
            temperature: 0.4,
            maxTokens: 8192,
          }, selectedModel)
        } catch (aiError: any) {
          console.error('AI model error:', aiError)
          send({ type: 'error', message: `AI generation failed: ${aiError.message || 'Unknown error. Please try again or check your API keys.'}` })
          send({ type: 'done' })
          controller.close()
          return
        }

        send({ type: 'status', message: 'Processing generated code...' })

        if (!response || !response.text) {
          send({ type: 'error', message: 'No response from AI model. Please try again.' })
          send({ type: 'done' })
          controller.close()
          return
        }

        const files = parseGeneratedFiles(response.text)
        const setup = extractSetupInstructions(response.text)

        if (files.length === 0) {
          send({ type: 'error', message: 'No files were generated. The AI response may be incomplete. Please try again with a more specific prompt.' })
          send({ type: 'done' })
          controller.close()
          return
        }

        const rawProject = {
          name: extractProjectName(prompt),
          framework: plan.framework || 'Next.js',
          files,
          setup,
          modelUsed: response.modelUsed,
        }

        // Validate project structure
        let validatedProject
        try {
          validatedProject = validateProject(rawProject)
        } catch (validationError: any) {
          console.error('Validation error:', validationError)
          send({ type: 'error', message: `Project validation failed: ${validationError.message || 'Invalid project structure'}` })
          send({ type: 'done' })
          controller.close()
          return
        }

        send({ type: 'project', data: validatedProject })
        send({ type: 'done' })

        controller.close()
      } catch (error: any) {
        console.error('Generation error:', error)
        send({ type: 'error', message: error.message || 'Failed to generate project. Please try again.' })
        send({ type: 'done' })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}

function parseGeneratedFiles(text: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = []
  const fileRegex = /FILE:\s*(.+?)\n```[\w]*\n([\s\S]*?)```/g
  
  let match
  while ((match = fileRegex.exec(text)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2].trim(),
    })
  }

  if (files.length === 0) {
    const codeBlocks = text.match(/```[\w]*\n([\s\S]*?)```/g) || []
    codeBlocks.forEach((block, idx) => {
      const content = block.replace(/```[\w]*\n|```/g, '').trim()
      files.push({
        path: `file-${idx + 1}.txt`,
        content,
      })
    })
  }

  return files
}

function extractSetupInstructions(text: string): string {
  const setupMatch = text.match(/(?:Setup|Installation|Getting Started|How to Run)[\s\S]*?(?=\n\n[A-Z]|$)/i)
  if (setupMatch) {
    return setupMatch[0].trim()
  }
  
  return `1. Install dependencies: npm install\n2. Run development server: npm run dev\n3. Open http://localhost:3000`
}

function extractProjectName(prompt: string): string {
  const words = prompt.toLowerCase().split(' ')
  const keywords = ['app', 'website', 'blog', 'todo', 'chat', 'dashboard', 'api']
  
  for (const keyword of keywords) {
    if (words.includes(keyword)) {
      return `${keyword}-app`
    }
  }
  
  return 'generated-project'
}
