'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaArrowRight, FaArrowLeft, FaCheck } from 'react-icons/fa';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to Devmate! 👋',
      description: 'Let\'s take a quick tour to help you get started with your AI coding assistant.',
      image: '🚀'
    },
    {
      title: 'Start a Conversation',
      description: 'Click "New Chat" in the sidebar to begin. Select a domain (Web Dev, ML, etc.) and choose an action: Generate, Explain, Rewrite, or Fix.',
      image: '💬'
    },
    {
      title: 'View Chat History',
      description: 'All your conversations are automatically saved. Access them anytime from the History section in the sidebar.',
      image: '📚'
    },
    {
      title: 'Customize Your Experience',
      description: 'Switch between light and dark themes using the toggle in the top-right. Update your profile in Settings.',
      image: '🎨'
    },
    {
      title: 'You\'re All Set! ✨',
      description: 'Start chatting with AI to generate code, debug issues, and improve your development workflow!',
      image: '🎉'
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('onboardingCompleted', 'true');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleSkip}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-lg w-full p-8 relative"
          >
            {/* Close Button */}
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <FaTimes className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>

            {/* Content */}
            <div className="text-center mb-8">
              <div className="text-6xl mb-6">{steps[currentStep].image}</div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
                {steps[currentStep].title}
              </h2>
              <p className="text-gray-600 dark:text-gray-300">
                {steps[currentStep].description}
              </p>
            </div>

            {/* Progress Dots */}
            <div className="flex items-center justify-center gap-2 mb-8">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentStep
                      ? 'w-8 bg-purple-600'
                      : 'w-2 bg-gray-300 dark:bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between">
              <button
                onClick={handlePrev}
                disabled={currentStep === 0}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                  currentStep === 0
                    ? 'opacity-0 pointer-events-none'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <FaArrowLeft className="w-4 h-4" />
                Back
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all"
              >
                {currentStep === steps.length - 1 ? (
                  <>
                    <FaCheck className="w-4 h-4" />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <FaArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
