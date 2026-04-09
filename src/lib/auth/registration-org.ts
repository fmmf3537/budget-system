import { prisma } from "@/lib/prisma"
import { UserRole } from "@/lib/auth/roles"
import { OrgStatus, UserStatus } from "@/generated/prisma/enums"

/**
 * 自助注册用户归属的组织：
 * 1. 环境变量 DEFAULT_REGISTRATION_ORGAN_ID（须为 ACTIVE）
 * 2. 否则：数据库中最早创建的 ACTIVE 管理员所在组织（与常见「主租户」一致）
 * 3. 否则：按创建时间最早的 ACTIVE 组织（与历史行为一致）
 */
export async function resolveRegistrationOrganizationId(): Promise<
  string | null
> {
  const fromEnv = process.env.DEFAULT_REGISTRATION_ORGAN_ID?.trim()
  if (fromEnv) {
    const o = await prisma.organization.findFirst({
      where: { id: fromEnv, status: OrgStatus.ACTIVE },
      select: { id: true },
    })
    if (o) return o.id
  }

  const adminUser = await prisma.user.findFirst({
    where: {
      status: UserStatus.ACTIVE,
      role: { equals: UserRole.ADMIN, mode: "insensitive" },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  })
  if (adminUser?.organizationId) return adminUser.organizationId

  const org = await prisma.organization.findFirst({
    where: { status: OrgStatus.ACTIVE },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  return org?.id ?? null
}
