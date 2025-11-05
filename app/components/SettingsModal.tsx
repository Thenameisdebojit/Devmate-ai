'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useTheme } from './ThemeProvider'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FiX, FiUser, FiMail, FiChevronDown, FiChevronRight, FiSettings, 
  FiImage, FiBell, FiDatabase, FiLock, FiUserCheck, FiShield,
  FiSun, FiMoon, FiMonitor, FiCheck
} from 'react-icons/fi'
import toast from 'react-hot-toast'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface UserSettings {
  notifications: {
    email: boolean
    push: boolean
    updates: boolean
  }
  privacy: {
    dataCollection: boolean
    analytics: boolean
    shareData: boolean
  }
  accessibility: {
    fontSize: 'small' | 'medium' | 'large'
    highContrast: boolean
  }
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, logout } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(user?.name || '')
  const [expandedSection, setExpandedSection] = useState<string | null>('my-account')
  
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      push: false,
      updates: true
    },
    privacy: {
      dataCollection: false,
      analytics: true,
      shareData: false
    },
    accessibility: {
      fontSize: 'medium',
      highContrast: false
    }
  })

  useEffect(() => {
    if (isOpen && user) {
      loadUserSettings()
    }
  }, [isOpen, user])

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/settings')
      if (response.ok) {
        const data = await response.json()
        if (data.settings) {
          setSettings(data.settings)
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const saveUserSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })
      if (response.ok) {
        toast.success('Settings saved successfully!')
      }
    } catch (error) {
      toast.error('Failed to save settings')
    }
  }

  const handleSaveProfile = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })

      if (response.ok) {
        toast.success('Profile updated successfully!')
        await saveUserSettings()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update profile')
      }
    } catch (error) {
      toast.error('Failed to update profile')
    }
  }

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  const Section = ({ id, title, icon: Icon, children }: any) => {
    const isExpanded = expandedSection === id

    return (
      <div className="border-b border-gray-200 dark:border-gray-800 last:border-0">
        <button
          onClick={() => toggleSection(id)}
          className="w-full flex items-center justify-between py-4 px-2 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-lg"
        >
          <div className="flex items-center gap-3">
            <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="font-medium text-gray-900 dark:text-white">{title}</span>
          </div>
          {isExpanded ? (
            <FiChevronDown className="w-5 h-5 text-gray-400" />
          ) : (
            <FiChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </button>
        
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-2 pb-4">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const Toggle = ({ checked, onChange, label }: any) => (
    <label className="flex items-center justify-between py-2 cursor-pointer group">
      <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
        {label}
      </span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-1">
            {/* General */}
            <Section id="general" title="General" icon={FiSettings}>
              <div className="space-y-4 pl-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Language
                  </label>
                  <select className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all">
                    <option>English (US)</option>
                    <option>Spanish</option>
                    <option>French</option>
                    <option>German</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Font Size
                  </label>
                  <select 
                    value={settings.accessibility.fontSize}
                    onChange={(e) => setSettings({
                      ...settings,
                      accessibility: { ...settings.accessibility, fontSize: e.target.value as any }
                    })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </Section>

            {/* Personalization */}
            <Section id="personalization" title="Personalization" icon={FiImage}>
              <div className="space-y-4 pl-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Theme
                  </label>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border transition-all ${
                        theme === 'light'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                          : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
                      }`}
                    >
                      <FiSun className="w-4 h-4" />
                      <span className="text-sm font-medium">Light</span>
                      {theme === 'light' && <FiCheck className="w-4 h-4 ml-auto" />}
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border transition-all ${
                        theme === 'dark'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                          : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
                      }`}
                    >
                      <FiMoon className="w-4 h-4" />
                      <span className="text-sm font-medium">Dark</span>
                      {theme === 'dark' && <FiCheck className="w-4 h-4 ml-auto" />}
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border transition-all ${
                        theme === 'system'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
                          : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-600'
                      }`}
                    >
                      <FiMonitor className="w-4 h-4" />
                      <span className="text-sm font-medium">System</span>
                      {theme === 'system' && <FiCheck className="w-4 h-4 ml-auto" />}
                    </button>
                  </div>
                </div>
                <Toggle
                  checked={settings.accessibility.highContrast}
                  onChange={(val: boolean) => setSettings({
                    ...settings,
                    accessibility: { ...settings.accessibility, highContrast: val }
                  })}
                  label="High Contrast Mode"
                />
              </div>
            </Section>

            {/* Notifications */}
            <Section id="notifications" title="Notifications" icon={FiBell}>
              <div className="space-y-2 pl-8">
                <Toggle
                  checked={settings.notifications.email}
                  onChange={(val: boolean) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, email: val }
                  })}
                  label="Email Notifications"
                />
                <Toggle
                  checked={settings.notifications.push}
                  onChange={(val: boolean) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, push: val }
                  })}
                  label="Push Notifications"
                />
                <Toggle
                  checked={settings.notifications.updates}
                  onChange={(val: boolean) => setSettings({
                    ...settings,
                    notifications: { ...settings.notifications, updates: val }
                  })}
                  label="Product Updates"
                />
              </div>
            </Section>

            {/* Data Controls */}
            <Section id="data-controls" title="Data Controls" icon={FiDatabase}>
              <div className="space-y-2 pl-8">
                <Toggle
                  checked={settings.privacy.dataCollection}
                  onChange={(val: boolean) => setSettings({
                    ...settings,
                    privacy: { ...settings.privacy, dataCollection: val }
                  })}
                  label="Allow Data Collection"
                />
                <Toggle
                  checked={settings.privacy.analytics}
                  onChange={(val: boolean) => setSettings({
                    ...settings,
                    privacy: { ...settings.privacy, analytics: val }
                  })}
                  label="Usage Analytics"
                />
                <Toggle
                  checked={settings.privacy.shareData}
                  onChange={(val: boolean) => setSettings({
                    ...settings,
                    privacy: { ...settings.privacy, shareData: val }
                  })}
                  label="Share Data for Improvements"
                />
                <button className="mt-3 text-sm text-red-600 dark:text-red-400 hover:underline">
                  Delete All My Data
                </button>
              </div>
            </Section>

            {/* Security */}
            <Section id="security" title="Security" icon={FiLock}>
              <div className="space-y-3 pl-8">
                <button className="w-full text-left py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Change Password</span>
                </button>
                <button className="w-full text-left py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Two-Factor Authentication</span>
                </button>
                <button className="w-full text-left py-2 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <span className="text-sm text-gray-700 dark:text-gray-300">Active Sessions</span>
                </button>
              </div>
            </Section>

            {/* My Account */}
            <Section id="my-account" title="My Account" icon={FiUserCheck}>
              <div className="space-y-4 pl-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiUser className="inline w-4 h-4 mr-2" />
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <FiMail className="inline w-4 h-4 mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={user?.email || ''}
                    disabled
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Email cannot be changed</p>
                </div>

                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
                      toast.error('Account deletion is not available yet')
                    }
                  }}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete Account
                </button>
              </div>
            </Section>

            {/* Parental Controls */}
            <Section id="parental-controls" title="Parental Controls" icon={FiShield}>
              <div className="space-y-3 pl-8">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage content restrictions and safety settings.
                </p>
                <Toggle
                  checked={false}
                  onChange={() => {}}
                  label="Enable Content Filter"
                />
                <Toggle
                  checked={false}
                  onChange={() => {}}
                  label="Restrict Code Generation"
                />
                <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                  Learn more about parental controls
                </button>
              </div>
            </Section>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex gap-3">
            <button
              onClick={handleSaveProfile}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg shadow-indigo-500/30"
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
