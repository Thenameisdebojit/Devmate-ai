import { NextRequest } from 'next/server'
import { callAIModelWithFailover } from '@/lib/aiOrchestrator'
import { validateProject, validatePlan, type Plan } from '@/lib/aiSchemas'
import { getCurrentUser } from '@/lib/auth'
import { connectDB } from '@/lib/mongodb'
import User from '@/models/User'

export async function POST(req: NextRequest) {
  const encoder = new TextEncoder()
  
  let prompt: string
  let plan: Plan
  let currentUser: any
  
  try {
    const body = await req.json()
    prompt = body.prompt
    
    currentUser = await getCurrentUser()
    if (!currentUser) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await connectDB()
    const user = await User.findById(currentUser.userId)
    
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const subscription = user.subscription || { plan: 'free', status: 'active' }
    const usageQuota = user.usageQuota || { monthlyGenerations: 10, usedGenerations: 0, resetDate: new Date() }

    if (new Date() > usageQuota.resetDate) {
      usageQuota.usedGenerations = 0
      usageQuota.resetDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }

    const remainingGenerations = subscription.plan === 'pro_plus' 
      ? -1 
      : usageQuota.monthlyGenerations - usageQuota.usedGenerations

    if (subscription.plan !== 'pro_plus' && remainingGenerations <= 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Generation limit reached. Please upgrade your plan.',
          upgrade: true,
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new Error('Invalid prompt')
    }
    
    if (!body.plan || typeof body.plan !== 'object') {
      throw new Error('Invalid plan')
    }
    
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

        const user = await User.findById(currentUser.userId)
        if (!user) {
          send({ type: 'error', message: 'User not found' })
          controller.close()
          return
        }

        const isPremium = ['pro', 'pro_plus'].includes(user.subscription?.plan || 'free')

        send({ type: 'status', step: 1, total: 5, message: 'Initializing industrial-grade code generator...' })

        const systemInstruction = `You are an EXPERT full-stack developer with 15+ years of experience in building production-grade applications.

CRITICAL REQUIREMENTS FOR INDUSTRIAL-LEVEL CODE:
1. Generate COMPLETE, PRODUCTION-READY code - ZERO placeholders or TODOs
2. Include comprehensive error handling and input validation
3. Add proper TypeScript types and interfaces
4. Include security best practices (XSS prevention, CSRF protection, sanitization)
5. Add detailed comments for complex logic
6. Follow SOLID principles and clean architecture
7. Include proper logging and monitoring hooks
8. Make code scalable and maintainable
${isPremium ? '9. Add automated tests (unit and integration)\n10. Include performance optimizations\n11. Add CI/CD configuration' : ''}

Project Plan:
${JSON.stringify(plan, null, 2)}

Generate each file with this EXACT format:
FILE: path/to/file.ext
\`\`\`language
// Complete, production-ready file content
\`\`\`

${isPremium ? 'Also include:\n- Setup instructions\n- Testing commands\n- Deployment guide\n- Environment variables needed' : 'Also include setup instructions at the end.'}`

        send({ type: 'status', step: 2, total: 5, message: 'Generating industrial-grade code with AI...' })

        let response
        try {
          response = await callAIModelWithFailover({
            prompt: `${prompt}\n\nPremium Features: ${isPremium ? 'ENABLED' : 'DISABLED'}`,
            domain: 'web-dev',
            action: 'generate',
            systemInstruction,
            temperature: 0.3,
            maxTokens: 12000,
          })
        } catch (aiError: any) {
          send({ type: 'error', message: aiError.message || 'AI generation failed. Please try again.' })
          controller.close()
          return
        }

        send({ type: 'status', step: 3, total: 5, message: 'Processing and validating generated code...' })

        const files = parseGeneratedFiles(response.text)
        const setup = extractSetupInstructions(response.text)
        const tests = isPremium ? extractTests(response.text) : []

        send({ type: 'status', step: 4, total: 5, message: 'Running code quality checks...' })

        const qualityScore = await analyzeCodeQuality(files)

        send({ type: 'status', step: 5, total: 5, message: 'Finalizing project...' })

        const rawProject = {
          name: extractProjectName(prompt),
          framework: plan.framework || 'Next.js',
          files,
          setup,
          tests,
          qualityScore,
          modelUsed: response.modelUsed,
          isPremium,
        }

        const validatedProject = validateProject(rawProject)

        if (user.subscription?.plan !== 'pro_plus') {
          if (!user.usageQuota) {
            user.usageQuota = {
              monthlyGenerations: 10,
              usedGenerations: 0,
              resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            }
          }
          user.usageQuota.usedGenerations = (user.usageQuota.usedGenerations || 0) + 1
          await user.save()
        }

        send({ type: 'project', data: validatedProject })
        send({ type: 'done' })

        controller.close()
      } catch (error: any) {
        console.error('Generation error:', error)
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`)
        )
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
  const setupMatch = text.match(/(?:Setup|Installation|Getting Started|How to Run)[\s\S]*?(?=\n\n[A-Z#]|$)/i)
  if (setupMatch) {
    return setupMatch[0].trim()
  }
  
  return `## Setup Instructions\n\n1. Install dependencies: \`npm install\`\n2. Set up environment variables (see .env.example)\n3. Run development server: \`npm run dev\`\n4. Open http://localhost:3000\n\n## Testing\n\nRun tests: \`npm test\`\n\n## Deployment\n\nBuild for production: \`npm run build\`\nStart production server: \`npm start\``
}

function extractTests(text: string): Array<{ path: string; content: string }> {
  const tests: Array<{ path: string; content: string }> = []
  const testRegex = /TEST:\s*(.+?)\n```[\w]*\n([\s\S]*?)```/g
  
  let match
  while ((match = testRegex.exec(text)) !== null) {
    tests.push({
      path: match[1].trim(),
      content: match[2].trim(),
    })
  }

  return tests
}

function extractProjectName(prompt: string): string {
  const words = prompt.toLowerCase().split(' ')
  const keywords = ['app', 'website', 'blog', 'todo', 'chat', 'dashboard', 'api', 'platform', 'system']
  
  for (const keyword of keywords) {
    if (words.includes(keyword)) {
      return `${keyword}-app`
    }
  }
  
  return 'generated-project'
}

async function analyzeCodeQuality(files: Array<{ path: string; content: string }>): Promise<number> {
  let score = 100
  
  for (const file of files) {
    if (file.content.includes('TODO') || file.content.includes('FIXME')) {
      score -= 5
    }
    
    if (file.content.includes('console.log') && !file.path.includes('test')) {
      score -= 2
    }
    
    if (file.content.length < 50) {
      score -= 10
    }
    
    const hasComments = /\/\/|\/\*|\*\/|#/.test(file.content)
    if (!hasComments && file.content.length > 200) {
      score -= 5
    }
  }
  
  return Math.max(0, Math.min(100, score))
}
