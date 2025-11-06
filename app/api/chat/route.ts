import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { chooseModel, streamAIModelWithFailover } from '@/lib/aiOrchestrator'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
})

const USE_ORCHESTRATOR = process.env.USE_AI_ORCHESTRATOR !== 'false'

const SYSTEM_INSTRUCTION = `You are an elite software engineer with 15+ years of experience. You write production-grade code that is:
- Complete and fully functional with no placeholders or TODOs
- Includes all necessary imports, error handling, and edge cases
- Follows industry best practices and design patterns
- Clean and self-documenting with minimal, essential comments only
- Optimized for performance and maintainability
- Ready to run without modifications

Write concise, professional code. Add comments only for complex logic that isn't immediately obvious. Keep responses focused and minimal.`

// Helper function to detect intent
function detectIntent(prompt: string) {
  const lowerPrompt = prompt.toLowerCase().trim()
  
  // Greetings and casual conversation
  const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
  const isGreeting = greetings.some(g => lowerPrompt === g || lowerPrompt.startsWith(g + ' ') || lowerPrompt.startsWith(g + ','))
  
  // Questions about the assistant
  const aboutQuestions = ['who are you', 'what are you', 'what can you do', 'help me', 'your capabilities']
  const isAboutQuestion = aboutQuestions.some(q => lowerPrompt.includes(q))
  
  // Code-related keywords
  const codeKeywords = ['code', 'function', 'class', 'program', 'script', 'algorithm', 'implement', 'create', 'build', 'write', 'develop']
  const hasCodeKeywords = codeKeywords.some(k => lowerPrompt.includes(k))
  
  if (isGreeting || isAboutQuestion) return 'conversation'
  if (hasCodeKeywords || lowerPrompt.includes('?') === false) return 'code'
  
  return 'general'
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, action, code, instructions, error, domain, chatHistory, files, selectedAgent } = await req.json()

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Service unavailable: OpenAI API key not configured' },
        { status: 503 }
      )
    }

    // Detect intent for generate action
    const intent = action === 'generate' ? detectIntent(prompt) : 'code'
    
    // Adjust temperature based on intent
    const temperature = intent === 'conversation' ? 0.8 : 0.3
    
    // Build messages array from chat history for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = []
    
    // Add system message
    const systemMessage = intent === 'conversation' 
      ? 'You are Devmate, a friendly and helpful AI coding assistant. You can have natural conversations and help with programming tasks. Be warm, professional, and concise.'
      : SYSTEM_INSTRUCTION
    
    messages.push({
      role: 'system',
      content: systemMessage
    })
    
    // Add chat history
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.slice(-6).forEach((msg: any) => {
        messages.push({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.content
        })
      })
    }

    let userMessage = ''
    const domainContext = domain || 'General'

    // Build user message based on action
    switch (action) {
      case 'generate':
        if (intent === 'conversation') {
          userMessage = prompt
        } else {
          userMessage = `You are a ${domainContext} expert. Create complete, production-ready code.

**REQUIREMENTS:**
1. Complete, runnable code - no placeholders or TODOs
2. All necessary imports
3. Proper error handling and validation
4. Minimal, essential comments only
5. Follow ${domainContext} best practices
6. Ready to run immediately
7. Include main/entry point if needed

**USER REQUEST:**
${prompt}

**DELIVERABLE:**
Clean, working code. Keep it concise and professional.`
        }
        break

      case 'explain':
        userMessage = `Analyze and explain this code in detail. Provide:

1. **Overview**: What does this code do? (2-3 sentences)
2. **Step-by-Step Breakdown**: Explain each major section line-by-line
3. **Key Concepts**: Identify important programming concepts used
4. **Dependencies**: List any imports or external libraries
5. **Potential Issues**: Point out any bugs, vulnerabilities, or improvements needed
6. **Performance Notes**: Comment on efficiency and optimization opportunities
7. **Use Cases**: When would you use this code?

**CODE TO EXPLAIN:**
\`\`\`
${code}
\`\`\``
        break

      case 'rewrite':
        userMessage = `Refactor this code to production quality.

**OBJECTIVES:**
1. Improve readability and maintainability
2. Optimize performance
3. Add error handling if missing
4. Follow best practices
5. Minimal, essential comments only
${instructions ? `6. SPECIFIC: ${instructions}` : ''}

**ORIGINAL CODE:**
\`\`\`
${code}
\`\`\`

**DELIVERABLE:**
Refactored code with improvements. Briefly explain key changes after the code.`
        break

      case 'fix':
        userMessage = `Debug and fix this code.

**REQUIREMENTS:**
1. Identify and fix all bugs
2. Add error handling and validation
3. Minimal comments for fixes only
4. Ensure code is complete and runnable
5. Handle edge cases

${error ? `**ERROR MESSAGE:**\n${error}\n\n` : ''}

**BUGGY CODE:**
\`\`\`
${code}
\`\`\`

**DELIVERABLE:**
Fixed code with brief explanation of changes.`
        break

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Add file context if files are provided
    if (files && files.length > 0) {
      userMessage = `${userMessage}\n\n**ATTACHED FILES:**\n${files.map((f: any) => `- ${f.name}: ${f.content.substring(0, 1000)}${f.content.length > 1000 ? '...' : ''}`).join('\n')}`
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: userMessage
    })

    const encoder = new TextEncoder()
    
    // Use AI orchestrator if enabled, otherwise use direct OpenAI
    if (USE_ORCHESTRATOR && process.env.GEMINI_API_KEY) {
      const selectedModel = chooseModel(userMessage, action, domain, selectedAgent)
      
      console.log(`[AI Orchestrator] User preference: ${selectedAgent || 'auto'} → Using model: ${selectedModel}`)
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ modelUsed: selectedModel })}\n\n`)
            )
            
            const fullPrompt = messages.map(m => {
              if (m.role === 'system') return `System: ${m.content}`
              if (m.role === 'user') return `User: ${m.content}`
              return `Assistant: ${m.content}`
            }).join('\n\n')
            
            for await (const text of streamAIModelWithFailover({
              prompt: fullPrompt,
              systemInstruction: systemMessage,
              temperature,
              maxTokens: 4096,
              action,
              domain,
            }, selectedAgent)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
            
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            console.error('Streaming error:', error)
            controller.error(error)
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
    }
    
    // Legacy OpenAI-only streaming
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      temperature: temperature,
      stream: true,
      max_tokens: 4096,
    })

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          controller.error(error)
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
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    )
  }
}
