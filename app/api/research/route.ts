import { NextRequest, NextResponse } from 'next/server'
import { tavily } from '@tavily/core'
import { callAIModelWithFailover } from '@/lib/aiOrchestrator'

if (!process.env.TAVILY_API_KEY && !process.env.OPENAI_API_KEY) {
  console.warn('TAVILY_API_KEY not set. Research mode will use fallback.')
}

const tvly = process.env.TAVILY_API_KEY ? tavily({ apiKey: process.env.TAVILY_API_KEY }) : null

// Timeout wrapper function
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    ),
  ])
}

interface Source {
  title: string
  url: string
  snippet: string
  score?: number
  publishedDate?: string
}

async function analyzeIntent(query: string, selectedModel: string): Promise<string> {
  try {
    const startTime = Date.now()
    const response = await withTimeout(
      callAIModelWithFailover({
        prompt: query,
        domain: 'research',
        action: 'analyze',
        systemInstruction: 'You are a query classifier. Classify the user query as one of: academic, code, research, or hybrid. Respond with only one word.',
        temperature: 0.1,
        maxTokens: 10,
      }, selectedModel),
      15000, // 15 second timeout
      'Intent analysis timeout'
    )
    const duration = Date.now() - startTime
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:35',message:'Intent analysis completed',data:{duration,query:query.substring(0,50),intent:response.text?.toLowerCase().trim()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    return response.text.toLowerCase().trim() || 'research'
  } catch (error: any) {
    console.warn('Intent analysis failed, defaulting to research:', error.message)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:42',message:'Intent analysis failed',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    return 'research'
  }
}

async function expandQuery(query: string, selectedModel: string): Promise<string[]> {
  try {
    const startTime = Date.now()
    const response = await withTimeout(
      callAIModelWithFailover({
        prompt: query,
        domain: 'research',
        action: 'expand',
        systemInstruction: 'Generate 2-3 related search queries to help find comprehensive information. Return only the queries, one per line, without numbering.',
        temperature: 0.7,
        maxTokens: 150,
      }, selectedModel),
      20000, // 20 second timeout
      'Query expansion timeout'
    )
    const duration = Date.now() - startTime
    const expanded = response.text.trim().split('\n').filter((q: string) => q.trim()) || []
    const queries = [query, ...expanded.slice(0, 2)]
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:58',message:'Query expansion completed',data:{duration,queryCount:queries.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    return queries
  } catch (error: any) {
    console.warn('Query expansion failed, using original query:', error.message)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:65',message:'Query expansion failed',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
    return [query]
  }
}

async function retrieveWebResults(queries: string[], searchDepth: 'basic' | 'advanced' = 'basic'): Promise<any[]> {
  const allResults: any[] = []
  
  if (tvly) {
    const startTime = Date.now()
    const searchPromises = queries.map(async (q, index) => {
      try {
        const queryStartTime = Date.now()
        const response = await withTimeout(
          tvly.search(q, {
            searchDepth,
            maxResults: 5,
            includeAnswer: false,
            includeImages: false,
          }),
          20000, // 20 second timeout per query
          `Tavily search timeout for query "${q.substring(0, 50)}"`
        )
        const queryDuration = Date.now() - queryStartTime
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:87',message:'Tavily search completed',data:{queryIndex:index,query:q.substring(0,50),duration:queryDuration,resultCount:response.results?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        return response.results || []
      } catch (error: any) {
        console.error(`Tavily search error for query "${q}":`, error)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:92',message:'Tavily search error',data:{queryIndex:index,query:q.substring(0,50),error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
        return []
      }
    })
    
    try {
      const results = await withTimeout(
        Promise.all(searchPromises),
        30000, // 30 second total timeout for all queries
        'Tavily search overall timeout'
      )
      allResults.push(...results.flat())
      const totalDuration = Date.now() - startTime
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:102',message:'All Tavily searches completed',data:{totalDuration,queryCount:queries.length,totalResults:allResults.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    } catch (error: any) {
      console.error('Tavily search overall timeout:', error)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:106',message:'Tavily search overall timeout',data:{error:error.message,partialResults:allResults.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
      // Return partial results if any
    }
  }
  
  const uniqueResults = Array.from(
    new Map(allResults.map((r: any) => [r.url, r])).values()
  )
  
  return uniqueResults.slice(0, 10)
}

function createBasicSummaryFromSources(query: string, sources: Source[]): string {
  if (sources.length === 0) {
    return `I found information related to "${query}", but was unable to generate a detailed summary. Please review the sources below for more information.`
  }

  const sourceList = sources
    .map((s, i) => `**${i + 1}. ${s.title}**\n${s.snippet.substring(0, 200)}${s.snippet.length > 200 ? '...' : ''}\n[Source: ${s.url}]`)
    .join('\n\n')

  return `## Research Summary for "${query}"

I found ${sources.length} relevant source${sources.length > 1 ? 's' : ''} related to your query. Below is a summary based on the available information:

${sourceList}

---

**Note:** This is a basic summary generated from the source titles and snippets. For a more detailed analysis, please review the individual sources listed below.`
}

async function fallbackKnowledgeBase(query: string, selectedModel: string): Promise<{ answer: string; sources: Source[] }> {
  try {
    const startTime = Date.now()
    const response = await withTimeout(
      callAIModelWithFailover({
        prompt: query,
        domain: 'research',
        action: 'fallback',
        systemInstruction: `You are a research assistant. When web search is unavailable, provide a comprehensive answer based on your training data. 

CRITICAL TRANSPARENCY REQUIREMENTS:
1. Start with: "⚠️ **Web Search Unavailable** - This answer is based on AI training data (cutoff: October 2023) and cannot access current web sources."
2. After each factual statement, add [Source: AI Training Data]
3. At the end, add a section: "## Limitations\n- Cannot verify against current web sources\n- May not reflect recent developments\n- For latest information, enable Tavily API"
4. Use markdown formatting with headings and bullet points`,
        temperature: 0.4,
        maxTokens: 1500,
      }, selectedModel),
      30000, // 30 second timeout
      'Fallback knowledge base timeout'
    )
    const duration = Date.now() - startTime
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:125',message:'Fallback knowledge base completed',data:{duration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});

    const answer = response.text || '⚠️ **Web Search Unavailable** - Unable to generate answer without web search access. Please configure TAVILY_API_KEY for academic research functionality.'
    
    return {
      answer,
      sources: [{
        title: 'AI Training Data (Oct 2023 Cutoff)',
        url: 'https://openai.com/research',
        snippet: '⚠️ Answer generated from AI model training data. No live web sources were consulted. For verified, up-to-date academic research with citations, configure Tavily API.',
        score: 0,
      }],
    }
  } catch (error: any) {
    console.error('Fallback knowledge base error:', error)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:137',message:'Fallback knowledge base error',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H3'})}).catch(()=>{});
    return {
      answer: '⚠️ **Error** - Unable to generate answer. Please try again or check your API configuration.',
      sources: [],
    }
  }
}

async function rankAndFilterSources(results: any[], query: string, selectedModel: string): Promise<Source[]> {
  if (results.length === 0) return []

  const sourcesWithContent = results.map((r, idx) => ({
    index: idx,
    title: r.title || 'Untitled',
    url: r.url || '#',
    snippet: r.content || r.snippet || '',
    rawScore: r.score || 0,
    publishedDate: r.publishedDate || r.published_date,
  }))

  // Skip ranking if we have few sources (faster)
  if (sourcesWithContent.length <= 3) {
    return sourcesWithContent.slice(0, 5)
  }

  const rankingPrompt = `Given the query "${query}", rank these sources by credibility and relevance. Prefer academic, educational (.edu), government (.gov), and documentation sites.

Sources:
${sourcesWithContent.map((s, i) => `${i + 1}. ${s.title} - ${s.url.substring(0, 50)}`).join('\n')}

Return the indices of the top 5 most credible and relevant sources in order, comma-separated (e.g., "3,1,5,2,4").`

  try {
    const startTime = Date.now()
    const rankingResponse = await withTimeout(
      callAIModelWithFailover({
        prompt: rankingPrompt,
        domain: 'research',
        action: 'rank',
        systemInstruction: 'You are a source credibility evaluator for academic research.',
        temperature: 0.2,
        maxTokens: 50,
      }, selectedModel),
      15000, // 15 second timeout
      'Source ranking timeout'
    )
    const duration = Date.now() - startTime
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:170',message:'Source ranking completed',data:{duration,sourceCount:sourcesWithContent.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});

    const rankedIndices = rankingResponse.text
      .trim()
      .split(',')
      .map((i: string) => parseInt(i.trim()) - 1)
      .filter((i: number) => !isNaN(i) && i >= 0 && i < sourcesWithContent.length) || []

    const topSources = rankedIndices.map((idx: number) => sourcesWithContent[idx])
    const fallbackSources = sourcesWithContent.slice(0, 5)
    
    return topSources.length > 0 ? topSources : fallbackSources
  } catch (error: any) {
    console.error('Ranking error, using default order:', error.message)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:181',message:'Source ranking failed',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H4'})}).catch(()=>{});
    // Return sources in default order if ranking fails
    return sourcesWithContent.slice(0, 5)
  }
}

async function verifyCitations(answer: string, sources: Source[]): Promise<boolean> {
  const sourceUrls = sources.map(s => s.url)
  const citationRegex = /\[Source:\s*([^\]]+)\]/g
  const citations = Array.from(answer.matchAll(citationRegex))
  
  if (citations.length === 0) {
    console.warn('Hallucination guard: No citations found in answer')
    return false
  }
  
  const validCitations = citations.filter(match => {
    const citedUrl = match[1].trim()
    return sourceUrls.some(url => url.includes(citedUrl) || citedUrl.includes(url.split('/')[2]))
  })
  
  const citationRatio = validCitations.length / citations.length
  console.log(`Citation verification: ${validCitations.length}/${citations.length} valid (${(citationRatio * 100).toFixed(1)}%)`)
  
  return citationRatio >= 0.8
}

async function generateAnswerWithCitations(
  query: string,
  sources: Source[],
  selectedModel: string
): Promise<string> {
  if (sources.length === 0) {
    return 'I could not find sufficient reliable sources to answer this question. Please try rephrasing your query or checking if the topic requires more specific terms.'
  }

  const sourcesText = sources
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.url}`)
    .join('\n\n')

  const systemPrompt = `You are a professional academic research assistant and summarizer.

CRITICAL RULES - HALLUCINATION GUARD:
1. ONLY use information explicitly stated in the provided sources
2. NEVER invent facts, statistics, or claims not in the sources
3. If sources lack information to answer, state: "The provided sources do not contain sufficient information on [topic]"
4. Include citations after EVERY factual statement using [Source: URL] format
5. Synthesize information from multiple sources when they agree
6. Note any contradictions between sources
7. Organize with clear sections if the topic is complex
8. Be concise but comprehensive
9. If a claim cannot be verified from sources, do not include it

FORMAT: Use markdown with proper headings, bullet points, and inline citations.`

  const userPrompt = `Research Question: ${query}

Retrieved Sources:
${sourcesText}

Provide a well-researched, citation-backed answer. Remember: Do not hallucinate. Only use facts from the sources above.`

  let attempts = 0
  const maxAttempts = 2

  while (attempts < maxAttempts) {
    try {
      const startTime = Date.now()
      const response = await withTimeout(
        callAIModelWithFailover({
          prompt: userPrompt,
          domain: 'research',
          action: 'generate',
          systemInstruction: systemPrompt,
          temperature: 0.3 + (attempts * 0.1),
          maxTokens: 2000,
        }, selectedModel),
        45000, // 45 second timeout per attempt
        `Answer generation timeout (attempt ${attempts + 1})`
      )
      const duration = Date.now() - startTime
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:240',message:'Answer generation completed',data:{duration,attempt:attempts+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});

      // If response.text is empty or falsy, this means the AI call failed
      if (!response.text || response.text.trim().length === 0) {
        throw new Error('AI model returned empty response')
      }
      
      const answer = response.text
      
      const isValid = await verifyCitations(answer, sources)
      if (isValid || attempts === maxAttempts - 1) {
        return answer
      }
      
      console.log(`Hallucination guard: Retry attempt ${attempts + 1} due to insufficient citations`)
      attempts++
    } catch (error: any) {
      console.error(`Answer generation error (attempt ${attempts + 1}):`, error)
      fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:252',message:'Answer generation error',data:{error:error.message,attempt:attempts+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H5'})}).catch(()=>{});
      if (attempts === maxAttempts - 1) {
        // Throw error to trigger fallback in calling function
        throw new Error(`Answer generation failed after ${maxAttempts} attempts: ${error.message}`)
      }
      attempts++
    }
  }

  // If we get here, all attempts failed - throw to trigger fallback
  throw new Error('Unable to generate summary after all attempts')
}

export async function POST(req: NextRequest) {
  const requestStartTime = Date.now()
  let requestQuery = ''
  try {
    const body = await req.json()
    const { query, selectedModel = 'auto', searchDepth = 'basic', maxResults = 5 } = body
    requestQuery = query || ''

    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:280',message:'Research request started',data:{query:requestQuery.substring(0,100),selectedModel,searchDepth},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H0'})}).catch(()=>{});

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a valid query' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY && !process.env.TAVILY_API_KEY) {
      return NextResponse.json(
        { error: 'AI API keys (OPENAI or GEMINI) and TAVILY_API_KEY are required for research functionality' },
        { status: 500 }
      )
    }

    // Map model names to proper format
    let modelToUse = selectedModel && selectedModel !== 'auto' ? selectedModel : 'auto'
    // Handle legacy model names and map to new format
    if (modelToUse === 'gemini-2.5-flash-exp' || modelToUse === 'gemini-2.0-flash-exp') {
      modelToUse = 'gemini-2.5-flash'
    } else if (modelToUse === 'gpt-4o' || modelToUse === 'gpt-4o-mini') {
      modelToUse = 'gpt-5.1' // GPT-4o removed, map to GPT-5.1
    } else if (modelToUse === 'chatgpt-5' || modelToUse === 'gpt-5') {
      modelToUse = 'gpt-5.1'
    } else if (modelToUse === 'gemini-2.5-pro') {
      modelToUse = 'gemini-3-pro' // Map old 2.5 Pro to new 3 Pro
    } else if (modelToUse === 'gemini-1.5-pro' || modelToUse === 'gemini-1.5-flash') {
      modelToUse = 'gemini-2.5-flash' // Gemini 1.5 models removed, map to 2.5 Flash
    } else if (modelToUse === 'grok-2-1212' || modelToUse === 'grok-2') {
      modelToUse = 'grok-4' // Grok 2 removed, map to Grok 4
    }

    // Wrap entire research flow in timeout
    const researchPromise = (async () => {
      const intent = await analyzeIntent(requestQuery, modelToUse)
      console.log(`Query intent: ${intent}`)

      const expandedQueries = await expandQuery(requestQuery, modelToUse)
      console.log(`Expanded queries: ${expandedQueries.join(', ')}`)

      let webResults = await retrieveWebResults(expandedQueries, searchDepth as 'basic' | 'advanced')
      console.log(`Retrieved ${webResults.length} web results`)

      let summary: string
      let rankedSources: Source[]

      if (webResults.length === 0) {
        console.log('No Tavily results, using knowledge base fallback')
        const fallback = await fallbackKnowledgeBase(requestQuery, modelToUse)
        summary = fallback.answer
        rankedSources = fallback.sources
      } else {
        rankedSources = await rankAndFilterSources(webResults, requestQuery, modelToUse)
        console.log(`Ranked to ${rankedSources.length} top sources`)
        fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:419',message:'About to call generateAnswerWithCitations',data:{sourceCount:rankedSources.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        try {
          summary = await generateAnswerWithCitations(requestQuery, rankedSources, modelToUse)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:422',message:'generateAnswerWithCitations succeeded',data:{summaryLength:summary.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        } catch (error: any) {
          console.warn('Answer generation failed, creating basic summary from sources:', error.message)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:425',message:'Answer generation failed, using basic summary fallback',data:{error:error.message,errorStack:error.stack?.substring(0,200),sourceCount:rankedSources.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
          // Fallback: Create a basic summary from source titles and snippets when AI fails
          summary = createBasicSummaryFromSources(requestQuery, rankedSources)
          fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:428',message:'Basic summary created from sources',data:{summaryLength:summary.length,sourceCount:rankedSources.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H6'})}).catch(()=>{});
        }
      }

      return {
        summary,
        sources: rankedSources,
        query: requestQuery,
        selectedModel: modelToUse,
        intent,
        expandedQueries,
      }
    })()

    const result = await withTimeout(
      researchPromise,
      120000, // 2 minute overall timeout
      'Research request timeout - operation took too long'
    )

    const totalDuration = Date.now() - requestStartTime
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:330',message:'Research request completed',data:{totalDuration,sourceCount:result.sources.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H0'})}).catch(()=>{});

    return NextResponse.json(result)
  } catch (error: any) {
    const totalDuration = Date.now() - requestStartTime
    console.error('Research API error:', error)
    fetch('http://127.0.0.1:7242/ingest/fe742378-fb51-48f7-9ab2-5f48302b4b88',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/research/route.ts:336',message:'Research request error',data:{error:error.message,totalDuration},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H0'})}).catch(()=>{});
    
    // If timeout, return fallback answer
    if (error.message.includes('timeout')) {
      try {
        const fallback = await fallbackKnowledgeBase(requestQuery || 'research query', 'auto')
        return NextResponse.json({
          summary: fallback.answer + '\n\n⚠️ **Note**: Web search timed out. This answer is based on AI training data.',
          sources: fallback.sources,
          query: requestQuery || '',
          selectedModel: 'auto',
          intent: 'timeout',
          expandedQueries: [],
        })
      } catch (fallbackError: any) {
        return NextResponse.json(
          { error: 'Research request timed out. Please try again with a simpler query.' },
          { status: 504 }
        )
      }
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to process research query' },
      { status: 500 }
    )
  }
}
