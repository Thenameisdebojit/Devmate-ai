import { NextRequest, NextResponse } from 'next/server'
import { tavily } from '@tavily/core'
import { callAIModelWithFailover } from '@/lib/aiOrchestrator'

if (!process.env.TAVILY_API_KEY && !process.env.OPENAI_API_KEY) {
  console.warn('TAVILY_API_KEY not set. Research mode will use fallback.')
}

const tvly = process.env.TAVILY_API_KEY ? tavily({ apiKey: process.env.TAVILY_API_KEY }) : null

interface Source {
  title: string
  url: string
  snippet: string
  score?: number
  publishedDate?: string
}

async function analyzeIntent(query: string, selectedModel: string): Promise<string> {
  const response = await callAIModelWithFailover({
    prompt: query,
    domain: 'research',
    action: 'analyze',
    systemInstruction: 'You are a query classifier. Classify the user query as one of: academic, code, research, or hybrid. Respond with only one word.',
    temperature: 0.1,
    maxTokens: 10,
  }, selectedModel)
  return response.text.toLowerCase().trim() || 'research'
}

async function expandQuery(query: string, selectedModel: string): Promise<string[]> {
  const response = await callAIModelWithFailover({
    prompt: query,
    domain: 'research',
    action: 'expand',
    systemInstruction: 'Generate 2-3 related search queries to help find comprehensive information. Return only the queries, one per line, without numbering.',
    temperature: 0.7,
    maxTokens: 150,
  }, selectedModel)
  const expanded = response.text.trim().split('\n').filter((q: string) => q.trim()) || []
  return [query, ...expanded.slice(0, 2)]
}

async function retrieveWebResults(queries: string[], searchDepth: 'basic' | 'advanced' = 'basic'): Promise<any[]> {
  const allResults: any[] = []
  
  if (tvly) {
    const searchPromises = queries.map(async (q) => {
      try {
        const response = await tvly.search(q, {
          searchDepth,
          maxResults: 5,
          includeAnswer: false,
          includeImages: false,
        })
        return response.results || []
      } catch (error) {
        console.error(`Tavily search error for query "${q}":`, error)
        return []
      }
    })
    
    const results = await Promise.all(searchPromises)
    allResults.push(...results.flat())
  }
  
  const uniqueResults = Array.from(
    new Map(allResults.map((r: any) => [r.url, r])).values()
  )
  
  return uniqueResults.slice(0, 10)
}

async function fallbackKnowledgeBase(query: string, selectedModel: string): Promise<{ answer: string; sources: Source[] }> {
  const response = await callAIModelWithFailover({
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
  }, selectedModel)

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

  const rankingPrompt = `Given the query "${query}", rank these sources by credibility and relevance. Prefer academic, educational (.edu), government (.gov), and documentation sites.

Sources:
${sourcesWithContent.map((s, i) => `${i + 1}. ${s.title} - ${s.url.substring(0, 50)}`).join('\n')}

Return the indices of the top 5 most credible and relevant sources in order, comma-separated (e.g., "3,1,5,2,4").`

  try {
    const rankingResponse = await callAIModelWithFailover({
      prompt: rankingPrompt,
      domain: 'research',
      action: 'rank',
      systemInstruction: 'You are a source credibility evaluator for academic research.',
      temperature: 0.2,
      maxTokens: 50,
    }, selectedModel)

    const rankedIndices = rankingResponse.text
      .trim()
      .split(',')
      .map((i: string) => parseInt(i.trim()) - 1)
      .filter((i: number) => !isNaN(i) && i >= 0 && i < sourcesWithContent.length) || []

    const topSources = rankedIndices.map((idx: number) => sourcesWithContent[idx])
    const fallbackSources = sourcesWithContent.slice(0, 5)
    
    return topSources.length > 0 ? topSources : fallbackSources
  } catch (error) {
    console.error('Ranking error, using default order:', error)
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
    const response = await callAIModelWithFailover({
      prompt: userPrompt,
      domain: 'research',
      action: 'generate',
      systemInstruction: systemPrompt,
      temperature: 0.3 + (attempts * 0.1),
      maxTokens: 2000,
    }, selectedModel)

    const answer = response.text || 'Unable to generate summary.'
    
    const isValid = await verifyCitations(answer, sources)
    if (isValid || attempts === maxAttempts - 1) {
      return answer
    }
    
    console.log(`Hallucination guard: Retry attempt ${attempts + 1} due to insufficient citations`)
    attempts++
  }

  return 'Unable to generate summary.'
}

export async function POST(req: NextRequest) {
  try {
    const { query, selectedModel = 'auto', searchDepth = 'basic', maxResults = 5 } = await req.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a valid query' },
        { status: 400 }
      )
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is required for research functionality' },
        { status: 500 }
      )
    }

    const modelToUse = selectedModel && selectedModel !== 'auto' ? selectedModel : 'auto'

    const intent = await analyzeIntent(query, modelToUse)
    console.log(`Query intent: ${intent}`)

    const expandedQueries = await expandQuery(query, modelToUse)
    console.log(`Expanded queries: ${expandedQueries.join(', ')}`)

    let webResults = await retrieveWebResults(expandedQueries, searchDepth as 'basic' | 'advanced')
    console.log(`Retrieved ${webResults.length} web results`)

    let summary: string
    let rankedSources: Source[]

    if (webResults.length === 0) {
      console.log('No Tavily results, using knowledge base fallback')
      const fallback = await fallbackKnowledgeBase(query, modelToUse)
      summary = fallback.answer
      rankedSources = fallback.sources
    } else {
      rankedSources = await rankAndFilterSources(webResults, query, modelToUse)
      console.log(`Ranked to ${rankedSources.length} top sources`)
      summary = await generateAnswerWithCitations(query, rankedSources, modelToUse)
    }

    return NextResponse.json({
      summary,
      sources: rankedSources,
      query,
      selectedModel: modelToUse,
      intent,
      expandedQueries,
    })
  } catch (error: any) {
    console.error('Research API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process research query' },
      { status: 500 }
    )
  }
}
