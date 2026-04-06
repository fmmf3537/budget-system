"use client"

import { AuthCookieSync } from "@/components/auth/auth-cookie-sync"
import { SessionProvider } from "@/components/auth/session-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { I18nProvider } from "@/contexts/i18n-context"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthCookieSync />
        <SessionProvider>{children}</SessionProvider>
        <Toaster />
      </I18nProvider>
    </ThemeProvider>
  )
}
