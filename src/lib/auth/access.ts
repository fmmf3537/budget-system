import { hasPermission } from "./permissions"
import type { PermissionKey } from "./permissions"
import { isPublicPath, requiredPermissionForPath } from "./route-access"
import type { UserRoleType } from "./roles"
import { normalizeRole } from "./roles"

export function canAccessPathWithRole(
  pathname: string,
  role: UserRoleType
): boolean {
  const required = requiredPermissionForPath(pathname)
  if (required === null) return true
  return hasPermission(role, required)
}

export function roleFromCookieValue(
  raw: string | undefined | null
): UserRoleType {
  return normalizeRole(raw ?? undefined)
}

export { hasPermission, isPublicPath, requiredPermissionForPath }
