'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiCode, FiDownload, FiEye, FiCheck, FiLoader, FiAlertCircle } from 'react-icons/fi'
import toast from 'react-hot-toast'

interface GenerationStep {
  step: number
  total: number
  message: string
  status: 'in_progress' | 'completed' | 'error'
}

interface ProjectFile {
  path: string
  content: string
}

interface GeneratedProject {
  projectName: string
  framework: string
  description: string
  files: ProjectFile[]
  setupInstructions: string
}

export default function AppGeneratorPanel() {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [steps, setSteps] = useState<GenerationStep[]>([])
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [generationLogs, setGenerationLogs] = useState<string[]>([])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please describe the app you want to build')
      return
    }

    setIsGenerating(true)
    setSteps([])
    setGeneratedProject(null)
    setGenerationLogs([])
    setShowPreview(false)

    try {
      const response = await fetch('/api/generate-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, stream: true }),
      })

      if (!response.ok) {
        throw new Error('Failed to start generation')
      }

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

              if (parsed.type === 'step') {
                setSteps(prev => {
                  const existing = prev.find(s => s.step === parsed.step)
                  if (existing) {
                    return prev.map(s => s.step === parsed.step ? parsed : s)
                  }
                  return [...prev, parsed]
                })
              } else if (parsed.type === 'generation') {
                setGenerationLogs(prev => [...prev, parsed.text])
              } else if (parsed.type === 'result') {
                setGeneratedProject(parsed.project)
              } else if (parsed.type === 'error') {
                toast.error(parsed.message)
              }
            } catch (e) {
              console.error('Parse error:', e)
            }
          }
        }
      }

      toast.success('Application generated successfully!')
    } catch (error: any) {
      console.error('Generation error:', error)
      toast.error(error.message || 'Failed to generate application')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCreateInWorkspace = async () => {
    if (!generatedProject) return

    try {
      const loadingToast = toast.loading('Creating project in workspace...')
      
      const response = await fetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: generatedProject.projectName,
          files: generatedProject.files,
        }),
      })

      toast.dismiss(loadingToast)

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create project')
      }

      const data = await response.json()
      toast.success(`Project created at: ${data.projectPath}`)
      toast.success('Files ready! Check the file explorer on the left.', { duration: 5000 })
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project in workspace')
    }
  }

  const handleDownload = async () => {
    if (!generatedProject) return

    try {
      const response = await fetch('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: generatedProject.projectName,
          files: generatedProject.files,
        }),
      })

      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${generatedProject.projectName}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.success('Project downloaded!')
    } catch (error) {
      toast.error('Failed to download project')
    }
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
          <FiCode className="text-white text-xl" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Full App Generator</h2>
          <p className="text-sm text-gray-400">Generate complete applications from your description</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Describe your application
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="E.g., Build me a responsive portfolio website with dark mode, contact form, and project showcase using Next.js and Tailwind CSS..."
            className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            disabled={isGenerating}
          />
        </div>

        <motion.button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className={`w-full py-3 px-6 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            isGenerating || !prompt.trim()
              ? 'bg-gray-600 cursor-not-allowed opacity-50'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg hover:scale-105'
          } text-white`}
          whileTap={{ scale: 0.95 }}
        >
          {isGenerating ? (
            <>
              <FiLoader className="animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FiCode />
              Generate Full App
            </>
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {steps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-medium text-gray-300">Generation Progress</h3>
            {steps.map((step) => (
              <div
                key={step.step}
                className="flex items-center gap-3 p-3 bg-white/5 rounded-lg border border-white/10"
              >
                {step.status === 'completed' && (
                  <FiCheck className="text-green-500 flex-shrink-0" />
                )}
                {step.status === 'in_progress' && (
                  <FiLoader className="text-blue-500 animate-spin flex-shrink-0" />
                )}
                {step.status === 'error' && (
                  <FiAlertCircle className="text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm text-gray-300">{step.message}</p>
                  <p className="text-xs text-gray-500">
                    Step {step.step} of {step.total}
                  </p>
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {generatedProject && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 p-4 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-xl border border-green-500/20"
          >
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">
                {generatedProject.projectName}
              </h3>
              <p className="text-sm text-gray-400">{generatedProject.description}</p>
              <p className="text-xs text-gray-500 mt-1">
                Framework: {generatedProject.framework} | Files: {generatedProject.files.length}
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={handleCreateInWorkspace}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:shadow-lg rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all hover:scale-105"
                >
                  <FiCode />
                  Create in Workspace
                </button>
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all"
                >
                  <FiDownload />
                  Download ZIP
                </button>
              </div>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white font-medium flex items-center justify-center gap-2 transition-all"
              >
                <FiEye />
                {showPreview ? 'Hide' : 'Preview'} Files
              </button>
            </div>

            {showPreview && (
              <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                <h4 className="text-sm font-medium text-gray-300">Project Files:</h4>
                {generatedProject.files.map((file, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-black/30 rounded-lg border border-white/10"
                  >
                    <p className="text-xs font-mono text-blue-400 mb-2">{file.path}</p>
                    <pre className="text-xs text-gray-300 overflow-x-auto max-h-32">
                      {file.content.substring(0, 500)}
                      {file.content.length > 500 && '...'}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
