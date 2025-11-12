'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiSend, FiLoader, FiZap } from 'react-icons/fi'

interface PromptBoxProps {
  onSubmit: (prompt: string) => void
  isLoading: boolean
}

const examplePrompts = [
  {
    title: 'Next.js Blog with SQLite',
    description: 'Create a Next.js blog app with SQLite and Prisma. Features: markdown posts, server-side search, comments saved to DB, auth via email link.',
    icon: '📝'
  },
  {
    title: 'Express + React ToDo',
    description: 'Create a lightweight Express + React ToDo app with JWT auth, Postgres DB, Dockerfile, and Github Actions CI.',
    icon: '✅'
  },
  {
    title: 'Landing Page with i18n',
    description: 'Scaffold a landing page with hero, pricing, and contact form that posts to an API route. Provide i18n keys for English and Odia.',
    icon: '🌐'
  }
]

export default function PromptBox({ onSubmit, isLoading }: PromptBoxProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = () => {
    if (prompt.trim() && !isLoading) {
      onSubmit(prompt)
    }
  }

  const handleExampleClick = (example: string) => {
    setPrompt(example)
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2">What would you like to build?</h2>
        <p className="text-gray-300">
          Describe your web application in natural language, and I'll create a complete, production-ready project for you.
        </p>
      </div>

      {/* Example Prompts */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
          <FiZap className="text-yellow-500" />
          Example Prompts
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {examplePrompts.map((example, idx) => (
            <button
              key={idx}
              onClick={() => handleExampleClick(example.description)}
              className="text-left p-4 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 hover:border-blue-500/50 rounded-xl transition-all group"
            >
              <div className="text-3xl mb-2">{example.icon}</div>
              <h4 className="text-sm font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors">
                {example.title}
              </h4>
              <p className="text-xs text-gray-400 line-clamp-3">{example.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Prompt Input */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
              handleSubmit()
            }
          }}
          placeholder="Describe your application in detail... (e.g., 'Create a real-time chat app with Next.js, Socket.io, MongoDB, user authentication, and dark mode')"
          className="w-full h-40 bg-transparent text-white placeholder-gray-500 border-none focus:outline-none resize-none"
          disabled={isLoading}
        />
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-2 py-1 bg-gray-700 rounded">Ctrl</kbd> + <kbd className="px-2 py-1 bg-gray-700 rounded">Enter</kbd> to submit
          </p>
          <motion.button
            onClick={handleSubmit}
            disabled={!prompt.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
              !prompt.trim() || isLoading
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/50'
            }`}
          >
            {isLoading ? (
              <>
                <FiLoader className="animate-spin" />
                Creating Plan...
              </>
            ) : (
              <>
                <FiSend />
                Create Plan
              </>
            )}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
