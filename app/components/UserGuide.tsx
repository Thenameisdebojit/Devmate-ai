'use client';

import { motion } from 'framer-motion';
import { FaTimes, FaRocket, FaComments, FaHistory, FaCog, FaCode, FaKeyboard } from 'react-icons/fa';

interface UserGuideProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UserGuide({ isOpen, onClose }: UserGuideProps) {
  if (!isOpen) return null;

  const sections = [
    {
      icon: <FaRocket className="w-6 h-6" />,
      title: 'Getting Started',
      content: [
        {
          subtitle: 'Creating Your First Chat',
          steps: [
            'Click "New Chat" button in the sidebar',
            'Select your domain from the dropdown (General, Web Dev, ML, etc.)',
            'Choose an AI action: Generate, Explain, Rewrite, or Fix',
            'Enter your prompt or paste code in the input area',
            'Hit Send or press Ctrl/Cmd + Enter'
          ]
        },
        {
          subtitle: 'Understanding AI Actions',
          steps: [
            'Generate: Create new code from scratch based on your description',
            'Explain: Get detailed explanations of code concepts or snippets',
            'Rewrite: Improve existing code for better quality and performance',
            'Fix: Debug and resolve errors in your code'
          ]
        }
      ]
    },
    {
      icon: <FaComments className="w-6 h-6" />,
      title: 'Chat Features',
      content: [
        {
          subtitle: 'Message Formatting',
          steps: [
            'Code snippets are automatically syntax-highlighted',
            'Use the Monaco editor to view and edit generated code',
            'Copy code directly from the code output panel',
            'Download conversations for offline reference'
          ]
        },
        {
          subtitle: 'Best Practices',
          steps: [
            'Be specific in your prompts for better results',
            'Include error messages when asking for debugging help',
            'Mention the programming language or framework explicitly',
            'Break complex tasks into smaller, manageable prompts'
          ]
        }
      ]
    },
    {
      icon: <FaHistory className="w-6 h-6" />,
      title: 'Chat History',
      content: [
        {
          subtitle: 'Saving & Accessing Chats',
          steps: [
            'All conversations are automatically saved when logged in',
            'View past chats in the "History" section of the sidebar',
            'Click any chat to resume the conversation',
            'Chat titles are generated from the first message',
            'Up to 50 recent chats are stored per user'
          ]
        },
        {
          subtitle: 'Managing History',
          steps: [
            'Delete individual chats by clicking the trash icon',
            'Clear current conversation with the clear button',
            'Export conversations as text files for backup',
            'Search through chat titles to find specific conversations'
          ]
        }
      ]
    },
    {
      icon: <FaCog className="w-6 h-6" />,
      title: 'Settings & Customization',
      content: [
        {
          subtitle: 'Theme Options',
          steps: [
            'Click the sun/moon icon to toggle themes',
            'Available modes: Dark, Light, and System preference',
            'Theme preference is saved automatically',
            'Optimized contrast for both day and night coding'
          ]
        },
        {
          subtitle: 'Profile Settings',
          steps: [
            'Click Settings in the sidebar to update your profile',
            'Change your display name',
            'View your account information',
            'Logout from your account securely'
          ]
        }
      ]
    },
    {
      icon: <FaCode className="w-6 h-6" />,
      title: 'Domain-Specific Features',
      content: [
        {
          subtitle: 'Available Domains',
          steps: [
            'General: All-purpose coding assistance',
            'Web Development: HTML, CSS, JavaScript, React, Vue, Angular',
            'Mobile Development: React Native, Flutter, Swift, Kotlin',
            'Data Science: Python, R, Pandas, NumPy',
            'Machine Learning: TensorFlow, PyTorch, Scikit-learn',
            'DevOps: Docker, Kubernetes, CI/CD, Cloud services'
          ]
        },
        {
          subtitle: 'Domain Benefits',
          steps: [
            'Get context-aware code suggestions',
            'Receive framework-specific best practices',
            'Access specialized debugging tips',
            'Get relevant library and tool recommendations'
          ]
        }
      ]
    },
    {
      icon: <FaKeyboard className="w-6 h-6" />,
      title: 'Keyboard Shortcuts',
      content: [
        {
          subtitle: 'Essential Shortcuts',
          steps: [
            'Ctrl/Cmd + K: Open command palette (coming soon)',
            'Ctrl/Cmd + Enter: Send your message',
            'Ctrl/Cmd + /: Open this help guide',
            'Esc: Close any open modal or dialog'
          ]
        },
        {
          subtitle: 'Navigation Tips',
          steps: [
            'Use Tab to navigate between input fields',
            'Arrow keys to scroll through chat history',
            'Ctrl/Cmd + N: Start a new chat (coming soon)',
            'Click sidebar items for quick access'
          ]
        }
      ]
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold">User Guide</h2>
              <p className="text-purple-100 mt-1">Complete documentation for Devmate</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <FaTimes className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-100px)]">
          {sections.map((section, sectionIndex) => (
            <motion.div
              key={sectionIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
              className="mb-12 last:mb-0"
            >
              {/* Section Header */}
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl text-white">
                  {section.icon}
                </div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">
                  {section.title}
                </h3>
              </div>

              {/* Section Content */}
              <div className="space-y-6 ml-2">
                {section.content.map((subsection, subIndex) => (
                  <div key={subIndex} className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-6">
                    <h4 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">
                      {subsection.subtitle}
                    </h4>
                    <ul className="space-y-2">
                      {subsection.steps.map((step, stepIndex) => (
                        <li
                          key={stepIndex}
                          className="flex items-start gap-3 text-gray-600 dark:text-gray-300"
                        >
                          <span className="text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                            {stepIndex + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}

          {/* Footer */}
          <div className="mt-12 p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl text-center">
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Need more help? Press <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Ctrl+/</kbd> for quick guide
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Devmate v2.0 - Powered by Google Gemini Pro
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
