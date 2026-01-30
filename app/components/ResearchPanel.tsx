'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Source {
  title: string
  url: string
  snippet: string
  score?: number
  publishedDate?: string
}

interface ResearchResult {
  summary: string
  sources: Source[]
  query: string
  model: string
}

export default function ResearchPanel() {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [model, setModel] = useState('gemini-3-pro')
  const [searchDepth, setSearchDepth] = useState<'basic' | 'advanced'>('basic')
  const [expandedSources, setExpandedSources] = useState<Set<number>>(new Set())

  const handleSearch = async () => {
    if (!query.trim()) {
      toast.error('Please enter a search query')
      return
    }

    setIsSearching(true)
    setResult(null)

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          model,
          searchDepth,
          maxResults: 5,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch research results')
      }

      setResult(data)
    } catch (error: any) {
      toast.error(error.message || 'Research search failed')
      console.error('Research error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  const toggleSource = (index: number) => {
    const newExpanded = new Set(expandedSources)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedSources(newExpanded)
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-white dark:bg-gray-900">
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-7 h-7 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Academic Research
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="gpt-5.1">GPT-5.1</option>
              <option value="gemini-3-pro">Gemini 3 Pro</option>
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="kimi-k2">Kimi K2</option>
              <option value="deepseek-3">DeepSeek 3</option>
              <option value="grok-4">Grok 4</option>
              <option value="auto">Auto (Best Model)</option>
            </select>
            <select
              value={searchDepth}
              onChange={(e) => setSearchDepth(e.target.value as 'basic' | 'advanced')}
              className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value="basic">Basic Search</option>
              <option value="advanced">Advanced Search</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter your research query here... (e.g., 'What is quantum computing?', 'Latest research on AI safety')"
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={isSearching || !query.trim()}
            className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 focus:ring-4 focus:ring-indigo-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSearching ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent' }}>
        <AnimatePresence mode="wait">
          {isSearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12 min-h-full"
            >
              <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Searching the web for answers...</p>
            </motion.div>
          )}

          {!isSearching && result && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 max-w-full"
            >
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Research Summary
                </h3>
                <div className="prose prose-sm dark:prose-invert max-w-none overflow-wrap break-words [&>*]:break-words">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.summary}
                  </ReactMarkdown>
                </div>
              </div>

              {result.sources && result.sources.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Sources ({result.sources.length})
                  </h3>
                  <div className="space-y-3">
                    {result.sources.map((source, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-all max-w-full"
                      >
                        <button
                          onClick={() => toggleSource(index)}
                          className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <span className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <h4 className="font-semibold text-gray-900 dark:text-white truncate break-words">
                              {source.title}
                            </h4>
                            <p className="text-sm text-indigo-600 dark:text-indigo-400 truncate mt-1 break-all">
                              {source.url}
                            </p>
                          </div>
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${expandedSources.has(index) ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        <AnimatePresence>
                          {expandedSources.has(index) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="border-t border-gray-200 dark:border-gray-700"
                            >
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/30 overflow-hidden">
                                <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 break-words overflow-wrap">
                                  {source.snippet}
                                </p>
                                <a
                                  href={source.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                                >
                                  Visit Source
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {!isSearching && !result && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
