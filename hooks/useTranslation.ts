import { useState, useEffect } from 'react'

type Language = 'en' | 'od'

interface Translations {
  [key: string]: string | Translations
}

export function useTranslation() {
  const [language, setLanguage] = useState<Language>('en')
  const [translations, setTranslations] = useState<Translations>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load saved language preference
    const saved = localStorage.getItem('language') as Language
    if (saved && (saved === 'en' || saved === 'od')) {
      setLanguage(saved)
    }
  }, [])

  useEffect(() => {
    // Load translation file
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
        return key // Fallback to key if not found
      }
    }
    
    return typeof value === 'string' ? value : key
  }

  const changeLanguage = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('language', lang)
  }

  return { t, language, changeLanguage, loading }
}
