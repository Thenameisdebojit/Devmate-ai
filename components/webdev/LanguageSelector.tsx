'use client'

import { FiGlobe } from 'react-icons/fi'
import { useTranslation } from '@/hooks/useTranslation'

export default function LanguageSelector() {
  const { language, changeLanguage } = useTranslation()

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg">
      <FiGlobe className="text-gray-400" />
      <select
        value={language}
        onChange={(e) => changeLanguage(e.target.value as 'en' | 'od')}
        className="bg-transparent text-sm text-white outline-none cursor-pointer"
      >
        <option value="en">English</option>
        <option value="od">ଓଡ଼ିଆ (Odia)</option>
      </select>
    </div>
  )
}
