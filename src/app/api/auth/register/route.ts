import { prisma } from "@/lib/prisma"
import { userRegisterBodySchema } from "@/lib/api/user-schemas"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { created, fail, fromZodError } from "@/lib/api/response"
import { hashPassword } from "@/lib/auth/password"
import { UserRole } from "@/lib/auth/roles"
import { OrgStatus, UserStatus } from "@/generated/prisma/enums"

export async function POST(request: Request) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = userRegisterBodySchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const { email, name, password, passwordConfirm } = parsed.data
    if (password !== passwordConfirm) {
      return fail("VALIDATION_ERROR", "两次输入的密码不一致", 400)
    }
    const emailNorm = email.toLowerCase()

    const dup = await prisma.user.findUnique({ where: { email: emailNorm } })
    if (dup) {
      if (dup.status === UserStatus.ACTIVE) {
        return fail("EMAIL_EXISTS", "该邮箱已注册，请直接登录", 409)
      }
      return fail("PENDING_APPROVAL", "该账号正在审批中或已停用，请联系管理员", 409)
    }

    const org = await prisma.organization.findFirst({
      where: { status: OrgStatus.ACTIVE },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    })
    if (!org) {
      return fail("ORG_NOT_READY", "系统尚未配置可用组织，请联系管理员", 503)
    }

    const user = await prisma.user.create({
      data: {
        email: emailNorm,
        name,
        passwordHash: hashPassword(password),
        role: UserRole.VIEWER,
        status: UserStatus.INACTIVE,
        organizationId: org.id,
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        organizationId: true,
      },
    })

    return created({
      user,
      message: "注册申请已提交，请等待管理员审批通过后登录。",
    })
  } catch (e) {
    return handleRouteError(e)
  }
}
