"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { RoutePageGuard } from "@/components/auth/route-page-guard"
import { PageLoadingSkeleton } from "@/components/loading/page-loading-skeleton"

import { Header } from "./header"
import { Sidebar } from "./sidebar"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (pathname === "/login") {
    return (
      <div className="bg-background flex min-h-screen flex-col">
        <main className="flex-1">{children}</main>
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
