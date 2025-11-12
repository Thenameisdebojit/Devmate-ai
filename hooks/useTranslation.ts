import { useLanguage } from '@/contexts/LanguageContext'

export function useTranslation() {
  const { t, language, changeLanguage, loading } = useLanguage()
  return { t, language, changeLanguage, loading }
}
