'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import { useChatStore } from '../store/useChatStore'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center">
      <div className="skeleton w-full h-full" />
    </div>
  ),
})

export default function MonacoCodeOutput() {
  const { messages, addMessage, updateLastMessage, setLastRequest } = useChatStore()
  const [code, setCode] = useState('')
  const [language, setLanguage] = useState('javascript')
  const [theme, setTheme] = useState('vs-dark')
  const [isExplaining, setIsExplaining] = useState(false)

  // Extract code from the last assistant message
  useEffect(() => {
    const lastAssistantMessage = [...messages].reverse().find(m => m.type === 'assistant')
    if (lastAssistantMessage && lastAssistantMessage.content) {
      const codeMatch = lastAssistantMessage.content.match(/```(\w+)?\n([\s\S]*?)```/)
      if (codeMatch) {
        const detectedLang = codeMatch[1] || 'javascript'
        const extractedCode = codeMatch[2]
        setLanguage(detectedLang)
        setCode(extractedCode)
      } else {
        setCode(lastAssistantMessage.content)
      }
    }
  }, [messages])

  // Update theme based on body class
  useEffect(() => {
    const isDark = document.body.classList.contains('dark')
    setTheme(isDark ? 'vs-dark' : 'light')

    const observer = new MutationObserver(() => {
      const isDark = document.body.classList.contains('dark')
      setTheme(isDark ? 'vs-dark' : 'light')
    })

    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })

    return () => observer.disconnect()
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      toast.success('Code copied to clipboard!')
    } catch (error) {
      toast.error('Failed to copy code')
    }
  }

  const handleDownload = () => {
    const extensionMap: Record<string, string> = {
      javascript: 'js',
      typescript: 'ts',
      python: 'py',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      go: 'go',
      rust: 'rs',
      html: 'html',
      css: 'css',
      json: 'json',
      markdown: 'md',
    }

    const extension = extensionMap[language] || 'txt'
    const filename = `devmate-code-${Date.now()}.${extension}`

    const blob = new Blob([code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Downloaded as ${filename}`)
  }

  const handleExplain = async () => {
    if (!code.trim()) {
      toast.error('No code to explain')
      return
    }

    setIsExplaining(true)

    const requestData = {
      action: 'explain' as const,
      code: code,
      domain: 'General',
    }
    setLastRequest(requestData)

    addMessage({
      type: 'user',
      content: `Explain this code:\n\`\`\`${language}\n${code}\n\`\`\``,
      action: 'explain',
    })

    addMessage({
      type: 'assistant',
      content: '',
      action: 'explain',
    })

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to explain code')
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6)
              if (data === '[DONE]') break

              try {
                const parsed = JSON.parse(data)
                if (parsed.text) {
                  accumulatedText += parsed.text
                  updateLastMessage(accumulatedText)
                }
              } catch (e) {
                // Ignore parsing errors
              }
            }
          }
        }
      }

      toast.success('Code explanation generated!')
    } catch (err: any) {
      toast.error(err.message || 'Failed to explain code')
      const { messages } = useChatStore.getState()
      if (messages.length >= 2) {
        useChatStore.setState({ 
          messages: messages.slice(0, -2) 
        })
      }
    } finally {
      setIsExplaining(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="glass-card flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="mb-4 pb-4 border-b border-white/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold dark:text-white text-gray-900">Code Output</h2>
              <p className="text-sm dark:text-gray-400 text-gray-600">Language: {language}</p>
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCopy}
                className="glass-button px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Copy code"
                aria-label="Copy code to clipboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDownload}
                className="glass-button px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                title="Download code"
                aria-label="Download code file"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleExplain}
                disabled={isExplaining || !code}
                className="glass-button px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Explain this code"
                aria-label="Explain code"
              >
                {isExplaining ? (
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </motion.button>
            </div>
          </div>
        </div>

        {/* Monaco Editor */}
        <div className="flex-1 min-h-0 rounded-lg overflow-hidden">
          {code ? (
            <MonacoEditor
              height="100%"
              language={language}
              value={code}
              theme={theme}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
                padding: { top: 16, bottom: 16 },
                fontFamily: 'JetBrains Mono, Monaco, Courier New, monospace',
                fontLigatures: true,
              }}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold dark:text-white text-gray-900 mb-2">No code yet</h3>
              <p className="dark:text-gray-400 text-gray-600 max-w-md">
                Generate code using the chat interface and it will appear here for easy copying and downloading.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
