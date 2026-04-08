"use client"

import * as React from "react"

const THEME_STORAGE_KEY = "budget-system-ui-theme"
type ThemeMode = "light" | "dark" | "system"

type ThemeContextValue = {
  theme: ThemeMode
  setTheme: (value: ThemeMode) => void
  resolvedTheme: "light" | "dark"
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null)

/**
 * Lightweight theme provider:
 * - stores preference in localStorage
 * - supports light / dark / system
 * - toggles `dark` class on html element
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>("system")
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    "light"
  )
  const [mounted, setMounted] = React.useState(false)

  const applyTheme = React.useCallback((mode: ThemeMode) => {
    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    const effective = mode === "system" ? (prefersDark ? "dark" : "light") : mode
    const root = document.documentElement
    root.classList.toggle("dark", effective === "dark")
    setResolvedTheme(effective)
  }, [])

  React.useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null
    const initial: ThemeMode =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system"
    setThemeState(initial)
    applyTheme(initial)

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onMediaChange = () => {
      setThemeState((current) => {
        if (current === "system") applyTheme("system")
        return current
      })
    }
    media.addEventListener("change", onMediaChange)
    setMounted(true)
    return () => media.removeEventListener("change", onMediaChange)
  }, [applyTheme])

  const setTheme = React.useCallback(
    (value: ThemeMode) => {
      setThemeState(value)
      localStorage.setItem(THEME_STORAGE_KEY, value)
      applyTheme(value)
    },
    [applyTheme]
  )

  const contextValue = React.useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
    }),
    [theme, setTheme, resolvedTheme]
  )

  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{ theme: "system", setTheme: () => {}, resolvedTheme: "light" }}
      >
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider")
  }
  return context
}
