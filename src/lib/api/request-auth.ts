import { prisma } from "@/lib/prisma"
import { getMockAuth, type MockAuthContext } from "@/lib/api/mock-auth"
import { fail } from "@/lib/api/response"
import {
  getSessionTokenFromRequest,
  verifySessionToken,
} from "@/lib/auth/session"
import { normalizeRole } from "@/lib/auth/roles"
import { UserStatus } from "@/generated/prisma/enums"
import type { NextResponse } from "next/server"

function mockHeadersAllowed() {
  return process.env.AUTH_ALLOW_MOCK_HEADERS !== "0"
}

/**
 * 优先校验 HttpOnly 会话（登录用户），否则在允许时回退到 Mock 请求头/环境变量。
 * 设置 AUTH_ALLOW_MOCK_HEADERS=0 时，未登录返回 null（接口应返回 401）。
 */
export async function getRequestAuth(
  request: Request
): Promise<MockAuthContext | null> {
  const token = getSessionTokenFromRequest(request)
  if (token) {
    const payload = await verifySessionToken(token)
    if (payload) {
      const user = await prisma.user.findFirst({
        where: {
          id: payload.sub,
          organizationId: payload.oid,
          status: UserStatus.ACTIVE,
        },
      })
      if (user?.role) {
        return {
          userId: user.id,
          organizationId: user.organizationId,
          role: normalizeRole(user.role),
        }
      }
    }
  }
  if (!mockHeadersAllowed()) return null
  return getMockAuth(request)
}

export async function requireAuth(
  request: Request
): Promise<MockAuthContext | NextResponse> {
  const auth = await getRequestAuth(request)
  if (!auth) {
    return fail("UNAUTHORIZED", "请先登录", 401)
  }
  return auth
}
