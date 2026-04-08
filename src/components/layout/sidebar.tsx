"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { useBudgetStore } from "@/stores/budget-store"
import { Brand } from "@/components/brand/brand"

import {
  HOME_HREF,
  MAIN_NAV,
  SETTINGS_GROUP_LABEL,
  SETTINGS_ICON,
  SETTINGS_NAV,
} from "./nav-config"

function navActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarNavList({
  className,
  onNavigate,
}: {
  className?: string
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const role = useBudgetStore((s) => s.mockUserRole)
  const SettingsIcon = SETTINGS_ICON

  return (
    <nav className={cn("flex flex-col gap-1", className)}>
      {MAIN_NAV.filter((item) => hasPermission(role, item.permission)).map(
        (item) => {
        const Icon = item.icon
        const active = navActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
            )}
          >
            <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
            {item.label}
          </Link>
        )
      })}

      <Separator className="my-2 bg-sidebar-border" />
      <p className="text-sidebar-foreground/55 flex items-center gap-2 px-3 text-xs font-medium tracking-wide">
        <SettingsIcon className="size-3.5" aria-hidden />
        {SETTINGS_GROUP_LABEL}
      </p>
      {SETTINGS_NAV.filter((item) =>
        hasPermission(role, item.permission)
      ).map((item) => {
        const active = navActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "rounded-md px-3 py-2 pl-10 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground"
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export function Sidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-sidebar-border flex h-14 items-center border-b px-4">
        <Brand href={HOME_HREF} size="sm" />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <SidebarNavList className="px-2" />
      </div>
    </div>
  )
}
