"use client"

import * as React from "react"

import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  type AppLocale,
  isAppLocale,
} from "@/lib/i18n/types"
import { createTranslator } from "@/lib/i18n/translate"

type I18nContextValue = {
  locale: AppLocale
  setLocale: (next: AppLocale) => void
  t: (path: string) => string
}

const I18nContext = React.createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<AppLocale>(DEFAULT_LOCALE)
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCALE_STORAGE_KEY)
      if (raw && isAppLocale(raw)) {
        setLocaleState(raw)
      }
    } catch {
      /* ignore */
    }
    setReady(true)
  }, [])

  const setLocale = React.useCallback((next: AppLocale) => {
    setLocaleState(next)
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = next === "en-US" ? "en" : "zh-CN"
    }
  }, [])

  React.useEffect(() => {
    if (!ready) return
    document.documentElement.lang = locale === "en-US" ? "en" : "zh-CN"
  }, [locale, ready])

  const t = React.useMemo(() => createTranslator(locale), [locale])

  const value = React.useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = React.useContext(I18nContext)
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider")
  }
  return ctx
}
