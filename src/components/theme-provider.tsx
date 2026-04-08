"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

const THEME_STORAGE_KEY = "budget-system-ui-theme"

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

/**
 * Shadcn 推荐：class 策略 + next-themes，与 globals.css / .dark 配套。
 */
export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <NextThemesProvider
      storageKey={THEME_STORAGE_KEY}
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}
