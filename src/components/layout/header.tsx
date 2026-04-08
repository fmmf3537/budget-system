"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BellIcon, LogOutIcon, MenuIcon, UserIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LocaleSwitcher } from "@/components/i18n/locale-switcher"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { buildMockHeaders } from "@/lib/api/mock-headers"
import { ROLE_LABEL, USER_ROLE_VALUES, type UserRoleType } from "@/lib/auth/roles"
import { useI18n } from "@/contexts/i18n-context"
import { useBudgetStore } from "@/stores/budget-store"

import { Brand } from "@/components/brand/brand"
import { SidebarNavList } from "./sidebar"

type ApiSuccess<T> = { success: true; data: T }
type TodoPayload = {
  pagination: { total: number }
}

const TODO_CACHE_TTL_MS = 30_000
const todoCountCache = new Map<
  string,
  { total: number; expiresAt: number }
>()

function initialsFromNameOrId(nameOrId: string) {
  const t = nameOrId.trim()
  if (t.length <= 2) return t.toUpperCase() || "?"
  return t.slice(0, 2).toUpperCase()
}

export function Header() {
  const { t } = useI18n()
  const router = useRouter()
  const mockOrgId = useBudgetStore((s) => s.mockOrgId)
  const mockUserId = useBudgetStore((s) => s.mockUserId)
  const mockUserRole = useBudgetStore((s) => s.mockUserRole)
  const setMockUserRole = useBudgetStore((s) => s.setMockUserRole)
  const sessionActive = useBudgetStore((s) => s.sessionActive)
  const profileDisplayName = useBudgetStore((s) => s.profileDisplayName)
  const clearSessionAndResetMock = useBudgetStore(
    (s) => s.clearSessionAndResetMock
  )
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [todoTotal, setTodoTotal] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (!sessionActive) {
      setTodoTotal(null)
      return
    }

    let cancelled = false
    const cacheKey = `${mockOrgId}:${mockUserId}:${mockUserRole}`
    const cached = todoCountCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      setTodoTotal(cached.total)
      return
    }

    async function load() {
      try {
        const res = await fetch("/api/approval/todo?page=1&pageSize=1", {
          headers: buildMockHeaders(mockOrgId, mockUserId, mockUserRole),
        })
        const json = (await res.json()) as
          | ApiSuccess<TodoPayload>
          | { success: false }
        if (!cancelled && json.success) {
          setTodoTotal(json.data.pagination.total)
          todoCountCache.set(cacheKey, {
            total: json.data.pagination.total,
            expiresAt: Date.now() + TODO_CACHE_TTL_MS,
          })
        }
      } catch {
        if (!cancelled) setTodoTotal(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [mockOrgId, mockUserId, mockUserRole, sessionActive])

  const showTodoBadge =
    todoTotal !== null && todoTotal > 0 ? String(todoTotal) : null

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      })
    } finally {
      clearSessionAndResetMock()
      router.refresh()
      router.push("/login")
    }
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur md:px-6">
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="打开菜单"
          >
            <MenuIcon className="size-5" />
          </Button>
        </DialogTrigger>
        <DialogContent
          className="gap-0 p-0 sm:max-w-sm"
          showCloseButton
        >
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle>
              <Brand size="sm" />
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto py-3">
            <SidebarNavList
              className="px-2"
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      <div className="hidden md:block">
        <Brand size="sm" />
      </div>
      <div className="text-muted-foreground min-w-0 flex-1 text-sm md:hidden">
        {t("app.shortTitle")}
      </div>
      <div className="hidden flex-1 md:block" />

      <div className="flex items-center gap-1 sm:gap-2">
        <LocaleSwitcher />
        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="消息与通知"
            >
              <BellIcon className="size-5" />
              {showTodoBadge ? (
                <Badge
                  variant="destructive"
                  className="absolute -right-0.5 -top-0.5 h-5 min-w-5 px-1 text-[10px] leading-none"
                >
                  {showTodoBadge}
                </Badge>
              ) : null}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>通知</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link
                href="/approval/todo"
                className="flex cursor-pointer items-center gap-2"
              >
                <span className="flex-1">审批待办</span>
                {todoTotal !== null && todoTotal > 0 ? (
                  <Badge variant="secondary">{todoTotal}</Badge>
                ) : null}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/cash-plan/dashboard" className="cursor-pointer">
                现金流看板
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-9 gap-2 rounded-full px-1.5 sm:px-2"
              aria-label="用户菜单"
            >
              <Avatar size="sm" className="size-8">
                <AvatarFallback className="text-xs">
                  {initialsFromNameOrId(
                    sessionActive && profileDisplayName
                      ? profileDisplayName
                      : mockUserId
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="text-muted-foreground hidden max-w-[120px] truncate text-sm sm:inline">
                {sessionActive && profileDisplayName
                  ? profileDisplayName
                  : "未登录演示"}
              </span>
              <UserIcon className="text-muted-foreground hidden size-4 sm:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              {sessionActive ? "当前用户" : "演示身份（未登录）"}
            </DropdownMenuLabel>
            <div className="text-muted-foreground space-y-1 px-2 py-1.5 text-xs">
              <p className="break-all">
                <span className="text-foreground font-medium">用户 ID</span>
                <br />
                {mockUserId}
              </p>
              <p className="break-all">
                <span className="text-foreground font-medium">组织 ID</span>
                <br />
                {mockOrgId}
              </p>
              <p className="break-all">
                <span className="text-foreground font-medium">当前角色</span>
                <br />
                {ROLE_LABEL[mockUserRole]}
              </p>
            </div>
            {sessionActive ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => void logout()}>
                  <LogOutIcon className="mr-2 size-4" />
                  退出登录
                </DropdownMenuItem>
              </>
            ) : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>切换模拟角色</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={mockUserRole}
                  onValueChange={(v) => setMockUserRole(v as UserRoleType)}
                >
                  {USER_ROLE_VALUES.map((r) => (
                    <DropdownMenuRadioItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/login" className="cursor-pointer">
                    使用账号登录
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/budget" className="cursor-pointer">
                进入预算编制
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
