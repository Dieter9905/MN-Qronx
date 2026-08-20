import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mn-qronx-lang') || 'vi'
    }
    return 'vi'
  })

  useEffect(() => {
    document.documentElement.lang = lang
    localStorage.setItem('mn-qronx-lang', lang)
  }, [lang])

  const toggleLang = () => setLang(prev => (prev === 'vi' ? 'en' : 'vi'))

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
