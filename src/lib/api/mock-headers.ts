import type { UserRoleType } from "@/lib/auth/roles"
import { normalizeRole } from "@/lib/auth/roles"

/**
 * 业务请求统一头（与 getMockAuth 一致）。
 */
export function buildMockHeaders(
  orgId: string,
  userId: string,
  role: UserRoleType | string
): HeadersInit {
  return {
    "Content-Type": "application/json",
    "x-mock-org-id": orgId,
    "x-mock-user-id": userId,
    "x-mock-user-role": normalizeRole(String(role)),
  }
}
