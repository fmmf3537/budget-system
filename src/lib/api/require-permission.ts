import type { PermissionKey } from "@/lib/auth/permissions"
import { hasPermission } from "@/lib/auth/permissions"
import type { MockAuthContext } from "@/lib/api/mock-auth"
import { getRequestAuth } from "@/lib/api/request-auth"
import { fail } from "@/lib/api/response"
import type { NextResponse } from "next/server"

/**
 * 校验当前请求（会话或 Mock）是否具备 API 所需权限；未登录返回 401，无权限返回 403。
 */
export async function requireApiPermission(
  request: Request,
  key: PermissionKey
): Promise<MockAuthContext | NextResponse> {
  const auth = await getRequestAuth(request)
  if (!auth) {
    return fail("UNAUTHORIZED", "请先登录", 401)
  }
  if (!hasPermission(auth.role, key)) {
    return fail("FORBIDDEN", "当前角色无权执行此操作", 403)
  }
  return auth
}
