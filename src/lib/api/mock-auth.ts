import { DEFAULT_USER_ROLE, normalizeRole } from "@/lib/auth/roles"
import type { UserRoleType } from "@/lib/auth/roles"
import { fail } from "@/lib/api/response"
import type { NextResponse } from "next/server"

export type MockAuthContext = {
  userId: string
  organizationId: string
  role: UserRoleType
}

/**
 * 模拟登录用户。可通过请求头覆盖：
 * - `x-mock-user-id`
 * - `x-mock-org-id`
 * - `x-mock-user-role`（ADMIN | BUDGET_MANAGER | APPROVER | VIEWER）
 * 或通过环境变量 `MOCK_USER_ID` / `MOCK_ORG_ID` / `MOCK_USER_ROLE`。
 */
export function getMockAuth(request: Request): MockAuthContext {
  const userId =
    request.headers.get("x-mock-user-id")?.trim() ||
    process.env.MOCK_USER_ID ||
    "demo-user"
  const organizationId =
    request.headers.get("x-mock-org-id")?.trim() ||
    process.env.MOCK_ORG_ID ||
    "demo-org"
  const roleHeader = request.headers.get("x-mock-user-role")?.trim()
  const role = normalizeRole(
    roleHeader || process.env.MOCK_USER_ROLE || DEFAULT_USER_ROLE
  )
  return { userId, organizationId, role }
}

export function requireMockAuth(request: Request): MockAuthContext | NextResponse {
  const ctx = getMockAuth(request)
  if (!ctx.userId || !ctx.organizationId) {
    return fail(
      "UNAUTHORIZED",
      "缺少模拟用户身份（请设置 x-mock-user-id / x-mock-org-id）",
      401
    )
  }
  return ctx
}
