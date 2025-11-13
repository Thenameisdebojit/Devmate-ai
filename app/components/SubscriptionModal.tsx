'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiCheck, FiZap, FiStar, FiCrown } from 'react-icons/fi'
import toast from 'react-hot-toast'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  currentPlan?: string
}

export default function SubscriptionModal({ isOpen, onClose, currentPlan = 'free' }: SubscriptionModalProps) {
  const [plans, setPlans] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      fetch('/api/subscription/plans')
        .then(res => res.json())
        .then(data => setPlans(data.plans))
        .catch(() => toast.error('Failed to load plans'))
    }
  }, [isOpen])

  const handleUpgrade = async (planId: string) => {
    if (planId === currentPlan) {
      toast.success('You are already on this plan')
      return
    }

    if (planId === 'free') {
      toast.error('Please contact support to downgrade')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/subscription/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upgrade')
      }

      toast.success(data.message)
      onClose()
      window.location.reload()
    } catch (error: any) {
      toast.error(error.message || 'Failed to upgrade subscription')
    } finally {
      setLoading(false)
    }
  }

  if (!plans) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div className="relative w-full max-w-6xl bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl border border-gray-700 shadow-2xl p-8">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <FiX className="text-white text-xl" />
              </button>

              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold text-white mb-2">Upgrade Your Plan</h2>
                <p className="text-gray-400">Choose the perfect plan for your development needs</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(plans).map(([id, plan]: [string, any]) => {
                  const isCurrentPlan = id === currentPlan
                  const Icon = id === 'pro_plus' ? FiCrown : id === 'pro' ? FiStar : FiZap

                  return (
                    <motion.div
                      key={id}
                      whileHover={{ scale: 1.02 }}
                      className={`relative rounded-2xl p-6 border-2 ${
                        id === 'pro_plus'
                          ? 'bg-gradient-to-br from-purple-900/40 to-blue-900/40 border-purple-500'
                          : id === 'pro'
                          ? 'bg-gradient-to-br from-blue-900/40 to-indigo-900/40 border-blue-500'
                          : 'bg-gray-800/50 border-gray-700'
                      }`}
                    >
                      {id === 'pro_plus' && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-xs font-semibold text-white">
                          MOST POPULAR
                        </div>
                      )}

                      <div className="text-center mb-6">
                        <div className={`inline-flex p-3 rounded-full mb-4 ${
                          id === 'pro_plus'
                            ? 'bg-purple-600'
                            : id === 'pro'
                            ? 'bg-blue-600'
                            : 'bg-gray-700'
                        }`}>
                          <Icon className="text-white text-2xl" />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-white">${plan.price}</span>
                          <span className="text-gray-400">/{plan.interval}</span>
                        </div>
                      </div>

                      <ul className="space-y-3 mb-6">
                        {plan.features.map((feature: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <FiCheck className="text-green-500 mt-1 flex-shrink-0" />
                            <span className="text-gray-300 text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <button
                        onClick={() => handleUpgrade(id)}
                        disabled={loading || isCurrentPlan}
                        className={`w-full py-3 rounded-xl font-semibold transition-all ${
                          isCurrentPlan
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : id === 'pro_plus'
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg hover:shadow-purple-500/50'
                            : id === 'pro'
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-lg hover:shadow-blue-500/50'
                            : 'bg-gray-700 text-white hover:bg-gray-600'
                        }`}
                      >
                        {isCurrentPlan ? 'Current Plan' : loading ? 'Processing...' : `Upgrade to ${plan.name}`}
                      </button>
                    </motion.div>
                  )
                })}
              </div>

              <div className="mt-8 p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl">
                <p className="text-sm text-gray-300 text-center">
                  🔒 Secure payment processing • Cancel anytime • 30-day money-back guarantee
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
