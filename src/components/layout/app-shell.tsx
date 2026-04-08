"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { RoutePageGuard } from "@/components/auth/route-page-guard"
import { PageLoadingSkeleton } from "@/components/loading/page-loading-skeleton"

import { Header } from "./header"
import { Sidebar } from "./sidebar"
import { Brand } from "@/components/brand/brand"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/login" || pathname === "/register") {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <header className="bg-background/90 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Brand href={pathname} size="sm" showFullName />
            <div className="text-muted-foreground text-xs">
              预算管理平台
            </div>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t py-6">
          <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-1 px-4 text-center text-xs sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <span>© {new Date().getFullYear()} 西安辰航卓越科技有限公司</span>
            <span>辰航卓越预算系统</span>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="bg-background flex min-h-screen w-full">
      <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground hidden w-56 shrink-0 border-r md:sticky md:top-0 md:flex md:h-screen md:flex-col">
        <Sidebar />
      </aside>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1">
          <React.Suspense fallback={<PageLoadingSkeleton />}>
            <RoutePageGuard>{children}</RoutePageGuard>
          </React.Suspense>
        </main>
      </div>
    </div>
  )
}
