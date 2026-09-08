"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

export type ThemePreference = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
}

const THEME_STORAGE_KEY = "cloudberry.theme"
const ThemeContext = createContext<ThemeContextValue | null>(null)

function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system")

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
        if (isThemePreference(storedTheme)) setThemeState(storedTheme)
      } catch {
        // Restricted storage should not prevent the dashboard from rendering.
      }
    })

    function handleStorage(event: StorageEvent) {
      if (event.key !== THEME_STORAGE_KEY) return
      setThemeState(
        isThemePreference(event.newValue) ? event.newValue : "system"
      )
    }

    window.addEventListener("storage", handleStorage)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")

    const applyTheme = () => {
      const resolvedTheme =
        theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme
      root.dataset.theme = resolvedTheme
      root.dataset.themePreference = theme
      root.style.colorScheme = resolvedTheme
    }

    applyTheme()
    if (theme !== "system") return

    mediaQuery.addEventListener("change", applyTheme)
    return () => mediaQuery.removeEventListener("change", applyTheme)
  }, [theme])

  function setTheme(nextTheme: ThemePreference) {
    setThemeState(nextTheme)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme)
    } catch {
      // Restricted storage only makes the preference session-local.
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error("useTheme must be used inside ThemeProvider")
  return context
}
