import { prisma } from "@/lib/prisma"
import { getRequestAuth } from "@/lib/api/request-auth"
import { ok } from "@/lib/api/response"
import { normalizeRole } from "@/lib/auth/roles"

export async function GET(request: Request) {
  const auth = await getRequestAuth(request)
  if (!auth) {
    return ok({ user: null })
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: {
      organization: { select: { id: true, name: true, code: true } },
    },
  })

  if (!user) {
    return ok({ user: null })
  }

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: normalizeRole(user.role),
      organizationId: user.organizationId,
      organizationName: user.organization.name,
      organizationCode: user.organization.code,
    },
  })
}
