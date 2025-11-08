import { NextRequest, NextResponse } from 'next/server'
import { tavily } from '@tavily/core'

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

export async function POST(req: NextRequest) {
  try {
    const { query, model = 'gpt-4o', searchDepth = 'basic', maxResults = 5 } = await req.json()

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Please provide a valid query' },
        { status: 400 }
      )
    }

    let searchResults: any[] = []
    let sources: Source[] = []

    if (tvly) {
      try {
        const response = await tvly.search(query, {
          searchDepth: searchDepth as 'basic' | 'advanced',
          maxResults: maxResults,
          includeAnswer: true,
          includeImages: false,
        })

        searchResults = response.results || []
        
        sources = searchResults.slice(0, maxResults).map((result: any) => ({
          title: result.title || 'Untitled',
          url: result.url || '#',
          snippet: result.content || result.snippet || '',
          score: result.score || 0,
          publishedDate: result.publishedDate || result.published_date,
        }))

        if (response.answer) {
          return NextResponse.json({
            summary: response.answer,
            sources,
            query,
            model: 'tavily',
          })
        }
      } catch (error: any) {
        console.error('Tavily search error:', error)
      }
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Search API not configured. Please add TAVILY_API_KEY or OPENAI_API_KEY to your environment.' },
        { status: 500 }
      )
    }

    const OpenAI = (await import('openai')).default
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

    const snippetsText = sources.length > 0
      ? sources.map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nSource: ${s.url}`).join('\n\n')
      : 'No web results available. Provide a helpful response based on your knowledge.'

    const systemPrompt = `You are a professional academic research assistant. Your task is to synthesize information from web search results into a clear, well-structured answer.

CRITICAL RULES:
1. Only use information from the provided search snippets
2. Include citations using [Source: URL] format after each fact
3. Do not hallucinate or invent information
4. If the snippets don't contain relevant information, say so clearly
5. Organize your response with clear sections if appropriate
6. Be concise but comprehensive`

    const userPrompt = `Question: ${query}

Search Results:
${snippetsText}

Please provide a well-researched answer with proper citations.`

    const completion = await openai.chat.completions.create({
      model: model === 'gpt-5' ? 'gpt-4o' : model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 1500,
    })

    const summary = completion.choices[0]?.message?.content || 'Unable to generate summary.'

    return NextResponse.json({
      summary,
      sources,
      query,
      model,
    })
  } catch (error: any) {
    console.error('Research API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process research query' },
      { status: 500 }
    )
  }
}
