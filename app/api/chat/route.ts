import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

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
    const { prompt, action, code, instructions, error, domain, chatHistory } = await req.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Service unavailable: API key not configured' },
        { status: 503 }
      )
    }

    // Detect intent for generate action
    const intent = action === 'generate' ? detectIntent(prompt) : 'code'
    
    // Adjust temperature based on intent
    const temperature = intent === 'conversation' ? 0.8 : 0.3
    
    // Build context from chat history
    let historyContext = ''
    if (chatHistory && chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-4).map((msg: any) => 
        `${msg.type === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n')
      historyContext = `\n**CONVERSATION HISTORY:**\n${recentHistory}\n\n`
    }

    // Use Gemini 2.5 Pro for premium quality responses
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro',
      systemInstruction: intent === 'conversation' 
        ? 'You are Devmate, a friendly and helpful AI coding assistant. You can have natural conversations and help with programming tasks. Be warm, professional, and concise.'
        : SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 2048,
      }
    })

    let fullPrompt = ''
    const domainContext = domain || 'General'

    switch (action) {
      case 'generate':
        if (intent === 'conversation') {
          fullPrompt = `${historyContext}You are Devmate, a helpful AI coding assistant specializing in ${domainContext}.
          
**USER MESSAGE:**
${prompt}

Respond naturally and helpfully. If they're greeting you, greet them back warmly. If they're asking about your capabilities, explain what you can help with. Keep responses friendly and concise.`
        } else {
          fullPrompt = `${historyContext}You are a ${domainContext} expert. Create complete, production-ready code.

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
        fullPrompt = `Analyze and explain this code in detail. Provide:

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
\`\`\`

Be thorough and educational. Assume the reader wants to deeply understand the code.`
        break

      case 'rewrite':
        fullPrompt = `Refactor this code to production quality.

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
        fullPrompt = `Debug and fix this code.

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

    const result = await model.generateContentStream(fullPrompt)

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
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

    return new Response(stream, {
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
