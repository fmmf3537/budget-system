"use client"

import { usePathname } from "next/navigation"

import { hasPermission } from "@/lib/auth/permissions"
import type { PermissionKey } from "@/lib/auth/permissions"
import { requiredPermissionForPath } from "@/lib/auth/route-access"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useBudgetStore } from "@/stores/budget-store"

import { Can } from "./can"

export function RoutePageGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/"
  const role = useBudgetStore((s) => s.mockUserRole)
  const required = requiredPermissionForPath(pathname)

  if (required === null) {
    return <>{children}</>
  }

  if (!hasPermission(role, required)) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTitle>页面权限不足</AlertTitle>
          <AlertDescription>
            当前模拟角色不具备「{required}」。请通过顶栏切换到具备权限的角色。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return <>{children}</>
}

/** 细粒度区块守卫（与 Can 类似，便于语义化包裹整段布局） */
export function PageSection({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionKey
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  return (
    <Can permission={permission} fallback={fallback}>
      {children}
    </Can>
  )
}

/** 无权限时提示（非隐藏） */
export function PageSectionOrDeny({
  permission,
  children,
}: {
  permission: PermissionKey
  children: React.ReactNode
}) {
  const role = useBudgetStore((s) => s.mockUserRole)
  if (!hasPermission(role, permission)) {
    return (
      <Alert>
        <AlertTitle>需要权限</AlertTitle>
        <AlertDescription>
          需要「{permission}」。当前角色：{role}
        </AlertDescription>
      </Alert>
    )
  }
  return <>{children}</>
}
