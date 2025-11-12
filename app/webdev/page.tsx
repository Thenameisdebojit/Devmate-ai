'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import PromptBox from '@/components/webdev/PromptBox'
import PlanView from '@/components/webdev/PlanView'
import GeneratorView from '@/components/webdev/GeneratorView'
import HistoryPanel from '@/components/webdev/HistoryPanel'
import LanguageSelector from '@/components/webdev/LanguageSelector'
import { FiCode, FiBookOpen } from 'react-icons/fi'

export default function WebDevPage() {
  const [currentStep, setCurrentStep] = useState<'prompt' | 'plan' | 'generate'>('prompt')
  const [prompt, setPrompt] = useState('')
  const [plan, setPlan] = useState<any>(null)
  const [generatedProject, setGeneratedProject] = useState<any>(null)
  const [isPlanning, setIsPlanning] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const handlePromptSubmit = async (userPrompt: string) => {
    setPrompt(userPrompt)
    setIsPlanning(true)
    setCurrentStep('plan')

    try {
      const response = await fetch('/api/webdev/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userPrompt }),
      })

      if (!response.ok) throw new Error('Failed to create plan')
      
      const data = await response.json()
      setPlan(data.plan)
    } catch (error) {
      console.error('Planning error:', error)
    } finally {
      setIsPlanning(false)
    }
  }

  const handleGenerateProject = async () => {
    if (!plan) return
    
    setIsGenerating(true)
    setCurrentStep('generate')

    try {
      const response = await fetch('/api/webdev/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, plan }),
      })

      if (!response.ok) throw new Error('Failed to generate project')
      
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response stream')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'project') {
                setGeneratedProject(parsed.data)
                
                // Save to history
                const { addWebDevHistoryItem } = await import('@/lib/webdevHistory')
                addWebDevHistoryItem({
                  prompt,
                  framework: parsed.data.framework || 'Unknown',
                  fileCount: parsed.data.files?.length || 0,
                  modelUsed: parsed.data.modelUsed,
                })
                
                // Trigger history update event
                window.dispatchEvent(new Event('webdev-history-updated'))
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <FiCode className="text-white text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Web Development Studio</h1>
                <p className="text-sm text-gray-400">Build full-stack applications from natural language</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <LanguageSelector />
              <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-all">
                <FiBookOpen />
                <span className="text-sm">Documentation</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {currentStep === 'prompt' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <PromptBox onSubmit={handlePromptSubmit} isLoading={isPlanning} />
              </motion.div>
            )}

            {currentStep === 'plan' && plan && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <PlanView 
                  plan={plan} 
                  onGenerate={handleGenerateProject}
                  onBack={() => setCurrentStep('prompt')}
                  isGenerating={isGenerating}
                />
              </motion.div>
            )}

            {currentStep === 'generate' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <GeneratorView 
                  project={generatedProject}
                  isGenerating={isGenerating}
                />
              </motion.div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <HistoryPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
