'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

type Language = 'en' | 'od'

interface Translations {
  [key: string]: string | Translations
}

interface LanguageContextType {
  language: Language
  translations: Translations
  changeLanguage: (lang: Language) => void
  t: (key: string) => string
  loading: boolean
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('en')
  const [translations, setTranslations] = useState<Translations>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('language') as Language
    if (saved && (saved === 'en' || saved === 'od')) {
      setLanguage(saved)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/i18n/${language}.json`)
      .then(res => res.json())
      .then(data => {
        setTranslations(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load translations:', err)
        setLoading(false)
      })
  }, [language])

  const t = (key: string): string => {
    const keys = key.split('.')
    let value: any = translations
    
    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        return key
      }
    }
    
    return typeof value === 'string' ? value : key
  }

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
  }

  return (
    <LanguageContext.Provider value={{ language, translations, changeLanguage, t, loading }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}
