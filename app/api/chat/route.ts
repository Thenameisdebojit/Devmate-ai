import OpenAI from 'openai'
import { NextRequest, NextResponse } from 'next/server'
import { chooseModel, streamAIModelWithFailover } from '@/lib/aiOrchestrator'

// Initialize OpenAI conditionally to allow Gemini-only operation
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null

const USE_ORCHESTRATOR = process.env.USE_AI_ORCHESTRATOR !== 'false'

const SYSTEM_INSTRUCTION = `You are an elite software engineer with 15+ years of experience. You write production-grade, OPTIMIZED code that is:
- Complete and fully functional with no placeholders or TODOs
- Includes all necessary imports, error handling, and edge cases
- Follows industry best practices and modern design patterns
- Clean, efficient, and self-documenting with minimal comments only
- HIGHLY OPTIMIZED for performance, speed, and maintainability
- Uses efficient algorithms and data structures
- Minimizes computational complexity and memory usage
- Ready to run without modifications

ALWAYS prioritize:
1. Code optimization and performance
2. Clean, readable structure
3. Minimal but effective error handling
4. Modern, efficient patterns

Write concise, professional, FAST code. Add comments only for complex logic. Keep responses focused and minimal.`

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
    const { prompt, action, code, instructions, error, domain, chatHistory, files, selectedAgent, projectId } = await req.json()

    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'Service unavailable: No AI API keys configured' },
        { status: 503 }
      )
    }

    // Detect intent for generate action
    const intent = action === 'generate' ? detectIntent(prompt) : 'code'
    
    // Adjust temperature based on intent - lower for faster, more deterministic responses
    const temperature = intent === 'conversation' ? 0.7 : 0.2
    
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
          userMessage = `You are a ${domainContext} expert. Create complete, production-ready, HIGHLY OPTIMIZED code.

**REQUIREMENTS:**
1. Complete, runnable code - no placeholders or TODOs
2. All necessary imports
3. Proper error handling and validation
4. Minimal, essential comments only
5. Follow ${domainContext} best practices
6. OPTIMIZED for performance, speed, and efficiency
7. Use efficient algorithms and data structures
8. Minimize computational complexity
9. Ready to run immediately
10. Include main/entry point if needed

**USER REQUEST:**
${prompt}

**DELIVERABLE:**
Clean, working, OPTIMIZED code. Prioritize performance and efficiency. Keep it concise and professional.`
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
    let uploadedImage: string | undefined
    if (files && files.length > 0) {
      // Check for image files
      const imageFile = files.find((f: any) => f.type?.startsWith('image/'))
      if (imageFile && imageFile.content) {
        // Extract base64 image data (assuming it's in data:image/... format)
        uploadedImage = imageFile.content.includes('data:') 
          ? imageFile.content.split(',')[1] 
          : imageFile.content
      }
      
      userMessage = `${userMessage}\n\n**ATTACHED FILES:**\n${files.map((f: any) => `- ${f.name}: ${f.content.substring(0, 1000)}${f.content.length > 1000 ? '...' : ''}`).join('\n')}`
    }

    // RAG Integration for General Domain only
    let ragContext: string = ''
    let useVisionModel = false
    if (domain === 'general' || domainContext === 'General') {
      try {
        // Get current user for access control
        const { getCurrentUser } = await import('@/lib/auth')
        const currentUser = await getCurrentUser()
        
        if (currentUser) {
          const { connectDB } = await import('@/lib/mongodb')
          await connectDB()
          const User = (await import('@/models/User')).default
          const user = await User.findById(currentUser.userId)
          
          if (user) {
            // Get user groups using AccessControl
            const { AccessControl } = await import('@/lib/rag/AccessControl')
            const accessControl = new AccessControl()
            const userGroupIds = await accessControl.getUserGroups(String(user._id))
            
            // Import RAG components
            const { QueryRouter } = await import('@/lib/rag/QueryRouter')
            const { Retriever } = await import('@/lib/rag/Retriever')
            const { ContextBuilder } = await import('@/lib/rag/ContextBuilder')
            
            const queryRouter = new QueryRouter()
            const retriever = new Retriever()
            const contextBuilder = new ContextBuilder()
            
            // Classify query
            const classification = await queryRouter.classify(prompt, !!uploadedImage)
            
            // Retrieve context
            const retrievalResults = await retriever.retrieve(
              classification.queryType,
              prompt,
              uploadedImage,
              String(user._id),
              userGroupIds,
              5 // Limit to 5 results
            )
            
            if (retrievalResults.length > 0) {
              // Build context
              const context = contextBuilder.build(retrievalResults)
              
              // Format context for prompt
              if (uploadedImage) {
                // Use vision-capable model
                useVisionModel = true
                const visionPrompt = contextBuilder.formatAsVisionPrompt(context, prompt, uploadedImage)
                ragContext = visionPrompt.textPrompt
              } else {
                ragContext = contextBuilder.formatAsPrompt(context, prompt)
              }
              
              // Prepend RAG context to user message
              userMessage = `${ragContext}\n\n${userMessage}`
            }
          }
        }
      } catch (ragError: any) {
        console.error('[Chat API] RAG integration error:', ragError)
        // Continue without RAG context if there's an error
      }
    }

    // Add the current user message
    messages.push({
      role: 'user',
      content: userMessage
    })

    const encoder = new TextEncoder()
    
    // Use AI orchestrator if enabled, otherwise use direct OpenAI
    if (USE_ORCHESTRATOR && process.env.GEMINI_API_KEY) {
      // Use vision model if RAG detected an image query in General domain
      const modelOverride = useVisionModel ? 'google:gemini-2.0-flash-exp' : undefined
      const selectedModel = modelOverride || chooseModel(userMessage, action, domain, selectedAgent)
      
      console.log(`[AI Orchestrator] User preference: ${selectedAgent || 'auto'} → Using model: ${selectedModel}`)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:200',message:'Model selection',data:{userPreference:selectedAgent,selectedModel,action,domain},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      
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
            
            try {
              // PHASE F′-3: Use role-aware AI if projectId is available
              let streamFunction
              if (projectId) {
                try {
                  const { WorkspaceRegistry } = await import('@/lib/workspace/WorkspaceRegistry')
                  const rootPath = await WorkspaceRegistry.getRootPath(projectId)
                  if (rootPath) {
                    const { streamAIModelWithRole } = await import('@/lib/os/ai/roleAwareAI')
                    streamFunction = streamAIModelWithRole(selectedModel, {
                      prompt: fullPrompt,
                      systemInstruction: systemMessage,
                      temperature,
                      maxTokens: 4096,
                      action,
                      domain,
                      projectId,
                      rootPath,
                    })
                  } else {
                    // No rootPath - use regular stream
                    streamFunction = streamAIModelWithFailover({
                      prompt: fullPrompt,
                      systemInstruction: systemMessage,
                      temperature,
                      maxTokens: 4096,
                      action,
                      domain,
                    }, selectedAgent)
                  }
                } catch (error) {
                  // PEE not available - use regular stream
                  console.warn('[chat/route] Failed to get role-aware AI, using regular stream:', error)
                  streamFunction = streamAIModelWithFailover({
                    prompt: fullPrompt,
                    systemInstruction: systemMessage,
                    temperature,
                    maxTokens: 4096,
                    action,
                    domain,
                  }, selectedAgent)
                }
              } else {
                // No projectId - use regular stream
                streamFunction = streamAIModelWithFailover({
                  prompt: fullPrompt,
                  systemInstruction: systemMessage,
                  temperature,
                  maxTokens: 4096,
                  action,
                  domain,
                }, selectedAgent)
              }
              
              try {
                let hasYielded = false
                let iterator = streamFunction[Symbol.asyncIterator]()
                
                try {
                  while (true) {
                    const result = await iterator.next()
                    if (result.done) break
                    hasYielded = true
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: result.value })}\n\n`))
                  }
                } catch (iterationError: any) {
                  // Error during iteration
                  console.error('[chat/route] Stream iteration error:', iterationError.message, iterationError.stack?.substring(0, 200))
                  // #region agent log
                  fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:277',message:'Stream iteration error caught',data:{error:iterationError.message,errorType:iterationError.constructor.name,hasStack:!!iterationError.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                  // #endregion
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ 
                      error: iterationError.message || 'Stream processing error. Please try again.',
                      type: 'error'
                    })}\n\n`)
                  )
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                  controller.close()
                  return // Exit early, error already sent
                }
                
                if (!hasYielded) {
                  // Generator completed without yielding - this shouldn't happen, but handle it
                  console.warn('[chat/route] Stream completed without yielding any data')
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ 
                      error: 'No response received from AI models. Please check your API keys and try again.',
                      type: 'error'
                    })}\n\n`)
                  )
                }
                
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                controller.close()
              } catch (innerError: any) {
                // Error from setting up the iterator or other issues
                console.error('[chat/route] Stream setup error:', innerError.message, innerError.stack?.substring(0, 200))
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:305',message:'Stream setup error caught',data:{error:innerError.message,errorType:innerError.constructor.name,hasStack:!!innerError.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
                // #endregion
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ 
                    error: innerError.message || 'Stream processing error. Please try again.',
                    type: 'error'
                  })}\n\n`)
                )
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                controller.close()
              }
            } catch (streamError: any) {
              console.error('Streaming error:', streamError)
              // Send error message to client before closing
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ 
                  error: streamError.message || 'Network error occurred. Please try again.',
                  type: 'error'
                })}\n\n`)
              )
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            }
          } catch (error: any) {
            console.error('Streaming setup error:', error)
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ 
                error: error.message || 'Failed to initialize streaming. Please try again.',
                type: 'error'
              })}\n\n`)
            )
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
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
    }
    
    // Legacy OpenAI-only streaming
    if (!openai) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 503 }
      )
    }
    
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o', // GPT-4o used as API fallback for GPT-5.1 (UI removed, but API still uses it until GPT-5.1 is available)
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
