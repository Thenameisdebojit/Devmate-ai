'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaCode, FaComments, FaCog, FaHistory, FaKeyboard } from 'react-icons/fa';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const guides = [
    {
      icon: <FaComments className="w-6 h-6" />,
      title: 'Starting a Chat',
      steps: [
        'Click "New Chat" in the sidebar',
        'Select a domain (General, Web Dev, ML, etc.)',
        'Choose an action: Generate, Explain, Rewrite, or Fix',
        'Enter your prompt or paste code',
        'Click "Send" or press Ctrl/Cmd + Enter'
      ]
    },
    {
      icon: <FaHistory className="w-6 h-6" />,
      title: 'Managing Chat History',
      steps: [
        'All chats are auto-saved when logged in',
        'View past conversations in "History"',
        'Click any chat to resume the conversation',
        'Up to 50 recent chats are stored per user'
      ]
    },
    {
      icon: <FaCode className="w-6 h-6" />,
      title: 'Using AI Actions',
      steps: [
        'Generate: Create new code from description',
        'Explain: Understand existing code',
        'Rewrite: Improve code quality & style',
        'Fix: Debug and resolve errors'
      ]
    },
    {
      icon: <FaCog className="w-6 h-6" />,
      title: 'Customizing Appearance',
      steps: [
        'Click theme toggle (sun/moon icon)',
        'Cycles: Dark → Light → System',
        'Update profile in Settings',
        'Export conversations with download icon'
      ]
    },
    {
      icon: <FaKeyboard className="w-6 h-6" />,
      title: 'Keyboard Shortcuts',
      steps: [
        'Ctrl/Cmd + K: Open command palette',
        'Ctrl/Cmd + Enter: Send message',
        'Esc: Close modals',
        'Ctrl/Cmd + /: Toggle this help'
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Quick Guide</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <p className="text-purple-100 mt-2">Everything you need to know about Devmate</p>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {guides.map((guide, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                        {guide.icon}
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        {guide.title}
                      </h3>
                    </div>
                    <ul className="space-y-2">
                      {guide.steps.map((step, stepIndex) => (
                        <li key={stepIndex} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <span className="text-purple-600 dark:text-purple-400 mt-0.5">•</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
              </div>

              {/* Additional Tips */}
              <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                  💡 Pro Tips
                </h3>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <li>• Be specific in your prompts for better AI responses</li>
                  <li>• Use domain selection to get context-specific code</li>
                  <li>• Copy code directly from the Monaco editor</li>
                  <li>• Export important conversations for offline reference</li>
                </ul>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
