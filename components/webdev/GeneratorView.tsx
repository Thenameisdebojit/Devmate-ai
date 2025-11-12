'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiCheck, FiLoader, FiDownload, FiCode, FiEye, FiFolder } from 'react-icons/fi'

interface GeneratorViewProps {
  project: any
  isGenerating: boolean
}

export default function GeneratorView({ project, isGenerating }: GeneratorViewProps) {
  const [showFiles, setShowFiles] = useState(false)
  const [selectedFile, setSelectedFile] = useState<any>(null)

  const handleDownload = async () => {
    if (!project) return
    
    const response = await fetch('/api/webdev/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
    })

    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${project.name}.zip`
    a.click()
  }

  if (isGenerating) {
    return (
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-12">
        <div className="text-center">
          <FiLoader className="text-6xl text-blue-500 animate-spin mx-auto mb-6" />
          <h3 className="text-2xl font-bold text-white mb-2">Generating Your Project</h3>
          <p className="text-gray-400">This may take a minute... AI is writing production-ready code</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-gradient-to-r from-green-600/20 to-blue-600/20 border border-green-500/30 rounded-2xl p-6"
      >
        <div className="flex items-center gap-4">
          <div className="p-4 bg-green-500 rounded-full">
            <FiCheck className="text-3xl text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Project Generated Successfully!</h2>
            <p className="text-gray-300">{project.name} is ready to use</p>
          </div>
        </div>
      </motion.div>

      {/* Project Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Framework</div>
          <div className="text-lg font-semibold text-white">{project.framework || 'Next.js'}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Files Generated</div>
          <div className="text-lg font-semibold text-white">{project.files?.length || 0}</div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4">
          <div className="text-sm text-gray-400 mb-1">Status</div>
          <div className="text-lg font-semibold text-green-500">Ready</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:shadow-lg rounded-xl text-white font-semibold transition-all"
        >
          <FiDownload />
          Download Project
        </button>
        <button
          onClick={() => setShowFiles(!showFiles)}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-semibold transition-all"
        >
          <FiEye />
          {showFiles ? 'Hide Files' : 'View Files'}
        </button>
      </div>

      {/* File Explorer */}
      {showFiles && project.files && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiFolder className="text-yellow-500" />
            Project Files
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              {project.files.map((file: any, idx: number) => (
                <button
                  key={idx}
                  onClick={() => setSelectedFile(file)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    selectedFile?.path === file.path
                      ? 'bg-blue-500/20 border border-blue-500'
                      : 'bg-gray-900/50 border border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <FiCode className="text-blue-400" />
                    <span className="text-sm text-gray-300 font-mono">{file.path}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
              {selectedFile ? (
                <>
                  <div className="text-xs text-gray-400 mb-2 font-mono">{selectedFile.path}</div>
                  <pre className="text-sm text-gray-300 overflow-x-auto max-h-96">
                    {selectedFile.content}
                  </pre>
                </>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  Select a file to view its contents
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Setup Instructions */}
      {project.setup && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Setup Instructions</h3>
          <pre className="text-sm text-gray-300 bg-gray-900/50 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap">
            {project.setup}
          </pre>
        </div>
      )}
    </div>
  )
}
