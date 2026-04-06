"use client"

import * as React from "react"

import {
  hasAnyPermission,
  hasEveryPermission,
  hasPermission,
} from "@/lib/auth/permissions"
import type { PermissionKey } from "@/lib/auth/permissions"
import { useBudgetStore } from "@/stores/budget-store"

type CanProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/** 满足任一权限即渲染 */
export function CanAny({
  anyOf,
  children,
  fallback = null,
}: CanProps & { anyOf: PermissionKey[] }) {
  const role = useBudgetStore((s) => s.mockUserRole)
  if (!hasAnyPermission(role, anyOf)) return fallback
  return <>{children}</>
}

/** 需同时具备所列权限 */
export function CanEvery({
  allOf,
  children,
  fallback = null,
}: CanProps & { allOf: PermissionKey[] }) {
  const role = useBudgetStore((s) => s.mockUserRole)
  if (!hasEveryPermission(role, allOf)) return fallback
  return <>{children}</>
}

/** 单一权限 */
export function Can({
  permission,
  children,
  fallback = null,
}: CanProps & { permission: PermissionKey }) {
  const role = useBudgetStore((s) => s.mockUserRole)
  if (!hasPermission(role, permission)) return fallback
  return <>{children}</>
}
