export type ThemePreference = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'web-authenticator:theme'

export function getStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored
  return 'system'
}

export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement
  root.classList.remove('theme-dark', 'theme-light', 'theme-system')
  root.classList.add(`theme-${theme}`)
}

export function setStoredTheme(theme: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}
