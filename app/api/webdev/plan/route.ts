import { NextRequest, NextResponse } from 'next/server'
import { callAIModelWithFailover } from '@/lib/aiOrchestrator'
import { validatePlan } from '@/lib/aiSchemas'

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const systemInstruction = `You are an expert software architect. Analyze the user's request and create a detailed implementation plan.

Your plan should include:
1. Architecture overview (tech stack, design patterns, project structure)
2. Complete list of files to create (with paths)
3. Database schema (if needed)
4. API routes (if applicable)
5. Key dependencies

Format your response as JSON with these fields:
{
  "architecture": "string - detailed architecture description",
  "files": ["array of file paths"],
  "database": "string - database schema (optional)",
  "routes": ["array of API routes (optional)"],
  "dependencies": ["array of npm packages"]
}`

    const response = await callAIModelWithFailover({
      prompt: `User Request: ${prompt}\n\nCreate a comprehensive implementation plan for this project.`,
      domain: 'web-dev',
      action: 'plan',
      systemInstruction,
      temperature: 0.3,
      maxTokens: 4096,
    })

    let rawPlan
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        rawPlan = JSON.parse(jsonMatch[0])
      } else {
        rawPlan = {
          architecture: response.text,
          files: [],
          dependencies: []
        }
      }
    } catch (e) {
      rawPlan = {
        architecture: response.text,
        files: [],
        dependencies: []
      }
    }

    // Validate the plan structure
    const validatedPlan = validatePlan(rawPlan)

    return NextResponse.json({ plan: validatedPlan, modelUsed: response.modelUsed })
  } catch (error: any) {
    console.error('Planning error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create plan' },
      { status: 500 }
    )
  }
}
