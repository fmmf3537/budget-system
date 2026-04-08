import type { PermissionKey } from "./permissions"
import { Permission } from "./permissions"

/**
 * 无需登录检查的公开路由前缀或精确路径。
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true
  if (pathname === "/unauthorized") return true
  if (pathname === "/login") return true
  if (pathname === "/register") return true
  return false
}

type RouteRule = { match: (p: string) => boolean; permission: PermissionKey }

/** 先匹配先生效（更具体的规则在前） */
const ROUTE_RULES: RouteRule[] = [
  {
    match: (p) => p.startsWith("/settings/users"),
    permission: Permission.USER_MANAGE,
  },
  {
    match: (p) => p.startsWith("/settings"),
    permission: Permission.SETTINGS_MANAGE,
  },
  {
    match: (p) => p === "/budget/new",
    permission: Permission.BUDGET_CREATE,
  },
  {
    match: (p) => /\/budget\/[^/]+\/edit/.test(p),
    permission: Permission.BUDGET_EDIT,
  },
  {
    match: (p) => p.startsWith("/adjustment/new"),
    permission: Permission.ADJUSTMENT_CREATE,
  },
  {
    match: (p) => p.startsWith("/adjustment"),
    permission: Permission.ADJUSTMENT_VIEW,
  },
  {
    match: (p) => p.startsWith("/approval"),
    permission: Permission.APPROVAL_VIEW,
  },
  {
    match: (p) => p.startsWith("/budget"),
    permission: Permission.BUDGET_VIEW,
  },
  {
    match: (p) => p.startsWith("/cash-plan"),
    permission: Permission.CASH_PLAN_VIEW,
  },
]

/**
 * 返回访问该路径所需权限；`null` 表示公开路由。
 */
export function requiredPermissionForPath(pathname: string): PermissionKey | null {
  if (isPublicPath(pathname)) return null
  for (const rule of ROUTE_RULES) {
    if (rule.match(pathname)) return rule.permission
  }
  return Permission.BUDGET_VIEW
}
