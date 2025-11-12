'use client'

import { motion } from 'framer-motion'
import { FiCheck, FiFile, FiDatabase, FiSettings, FiArrowLeft, FiPlay } from 'react-icons/fi'

interface PlanViewProps {
  plan: {
    architecture: string
    files: string[]
    database?: string
    routes?: string[]
    dependencies?: string[]
  }
  onGenerate: () => void
  onBack: () => void
  isGenerating: boolean
}

export default function PlanView({ plan, onGenerate, onBack, isGenerating }: PlanViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Project Plan</h2>
          <p className="text-gray-400">Review the architecture and files that will be generated</p>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-all"
        >
          <FiArrowLeft />
          Back
        </button>
      </div>

      {/* Architecture Overview */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiSettings className="text-blue-500" />
          Architecture
        </h3>
        <p className="text-gray-300 whitespace-pre-wrap">{plan.architecture}</p>
      </div>

      {/* Files */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FiFile className="text-green-500" />
          Files to Create ({plan.files.length})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {plan.files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-gray-900/50 rounded-lg">
              <FiCheck className="text-green-500 flex-shrink-0" />
              <span className="text-sm text-gray-300 font-mono">{file}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Database Schema */}
      {plan.database && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-2xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FiDatabase className="text-purple-500" />
            Database Schema
          </h3>
          <pre className="text-sm text-gray-300 bg-gray-900/50 p-4 rounded-lg overflow-x-auto">
            {plan.database}
          </pre>
        </div>
      )}

      {/* Generate Button */}
      <div className="flex justify-end">
        <motion.button
          onClick={onGenerate}
          disabled={isGenerating}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg transition-all ${
            isGenerating
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:shadow-lg hover:shadow-blue-500/50'
          }`}
        >
          <FiPlay />
          {isGenerating ? 'Generating...' : 'Generate Project'}
        </motion.button>
      </div>
    </div>
  )
}
