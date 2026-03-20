
import { useState, useEffect } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    // Persist preference across reloads
    const saved = localStorage.getItem('vandrishti_theme')
    if (saved) return saved === 'dark'
    // Default to OS preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('vandrishti_theme', isDark ? 'dark' : 'light')
  }, [isDark])

  return {
    isDark,
    toggle: () => setIsDark(prev => !prev),
    set: (dark) => setIsDark(dark),
  }
}