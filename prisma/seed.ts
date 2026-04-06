import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import {
  PrismaClient,
  Prisma,
} from "../src/generated/prisma/client"
import {
  BudgetStatus,
  OrgStatus,
  UserStatus,
} from "../src/generated/prisma/enums"
import { hashPassword } from "../src/lib/auth/password"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: ["warn", "error"],
})

const dec = (v: string | number) => new Prisma.Decimal(String(v))

async function seedOrganizations() {
  const hq = await prisma.organization.upsert({
    where: { id: "seed-hq" },
    create: {
      id: "seed-hq",
      code: "HQ",
      name: "集团总部",
      status: OrgStatus.ACTIVE,
    },
    update: { name: "集团总部", code: "HQ", status: OrgStatus.ACTIVE },
  })

  await prisma.organization.upsert({
    where: { id: "demo-org" },
    create: {
      id: "demo-org",
      code: "DEMO",
      name: "示例科技有限公司",
      status: OrgStatus.ACTIVE,
    },
    update: {
      name: "示例科技有限公司",
      code: "DEMO",
      status: OrgStatus.ACTIVE,
    },
  })

  await prisma.organization.upsert({
    where: { id: "seed-bj" },
    create: {
      id: "seed-bj",
      code: "BJ",
      name: "北京分公司",
      parentId: hq.id,
      status: OrgStatus.ACTIVE,
    },
    update: {
      name: "北京分公司",
      code: "BJ",
      parentId: hq.id,
      status: OrgStatus.ACTIVE,
    },
  })

  await prisma.organization.upsert({
    where: { id: "seed-sh" },
    create: {
      id: "seed-sh",
      code: "SH",
      name: "上海运营中心",
      parentId: hq.id,
      status: OrgStatus.ACTIVE,
    },
    update: {
      name: "上海运营中心",
      code: "SH",
      parentId: hq.id,
      status: OrgStatus.ACTIVE,
    },
  })

  await prisma.organization.upsert({
    where: { id: "seed-sz" },
    create: {
      id: "seed-sz",
      code: "SZ",
      name: "深圳创新中心",
      parentId: hq.id,
      status: OrgStatus.ACTIVE,
    },
    update: {
      name: "深圳创新中心",
      code: "SZ",
      parentId: hq.id,
      status: OrgStatus.ACTIVE,
    },
  })

  console.log("Organizations: demo-org, seed-hq + 3 subsidiaries (bj/sh/sz)")
}

async function seedUsers() {
  const defaultPasswordHash = hashPassword("ChangeMe123!")
  const users: Array<{
    id?: string
    email: string
    name: string
    role: string
    organizationId: string
  }> = [
    {
      id: "demo-user",
      email: "demo-user@example.com",
      name: "演示用户（编制）",
      role: "BUDGET_MANAGER",
      organizationId: "demo-org",
    },
    {
      email: "admin@example.com",
      name: "系统管理员",
      role: "ADMIN",
      organizationId: "demo-org",
    },
    {
      email: "finance@example.com",
      name: "张财务",
      role: "BUDGET_MANAGER",
      organizationId: "demo-org",
    },
    {
      email: "employee@example.com",
      name: "李员工",
      role: "VIEWER",
      organizationId: "demo-org",
    },
    {
      email: "exec@example.com",
      name: "王管理层",
      role: "ADMIN",
      organizationId: "seed-hq",
    },
    {
      email: "finance.bj@example.com",
      name: "赵财务（北京）",
      role: "BUDGET_MANAGER",
      organizationId: "seed-bj",
    },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: {
        ...(u.id ? { id: u.id } : {}),
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash: defaultPasswordHash,
        organizationId: u.organizationId,
        status: UserStatus.ACTIVE,
      },
      update: {
        name: u.name,
        role: u.role,
        organizationId: u.organizationId,
        status: UserStatus.ACTIVE,
        passwordHash: defaultPasswordHash,
      },
    })
  }

  console.log(
    "Users: 财务×2、员工(VIEWER)、管理层(ADMIN)、演示用户；统一初始密码 ChangeMe123!"
  )
}

async function seedBudgetSubjects(orgId: string, label: string) {
  const rootIncome = await prisma.budgetSubject.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "10000" } },
    create: {
      organizationId: orgId,
      code: "10000",
      name: "收入类",
      level: 1,
      sortOrder: 10,
      isActive: true,
    },
    update: { name: "收入类", level: 1, sortOrder: 10, isActive: true },
  })

  await prisma.budgetSubject.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "10100" } },
    create: {
      organizationId: orgId,
      parentId: rootIncome.id,
      code: "10100",
      name: "主营业务收入",
      level: 2,
      sortOrder: 11,
      isActive: true,
    },
    update: {
      parentId: rootIncome.id,
      name: "主营业务收入",
      level: 2,
      sortOrder: 11,
      isActive: true,
    },
  })

  const rootExpense = await prisma.budgetSubject.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "20000" } },
    create: {
      organizationId: orgId,
      code: "20000",
      name: "费用类",
      level: 1,
      sortOrder: 20,
      isActive: true,
    },
    update: { name: "费用类", level: 1, sortOrder: 20, isActive: true },
  })

  await prisma.budgetSubject.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "20100" } },
    create: {
      organizationId: orgId,
      parentId: rootExpense.id,
      code: "20100",
      name: "管理费用",
      level: 2,
      sortOrder: 21,
      isActive: true,
    },
    update: {
      parentId: rootExpense.id,
      name: "管理费用",
      level: 2,
      sortOrder: 21,
      isActive: true,
    },
  })

  await prisma.budgetSubject.upsert({
    where: { organizationId_code: { organizationId: orgId, code: "20200" } },
    create: {
      organizationId: orgId,
      parentId: rootExpense.id,
      code: "20200",
      name: "销售费用",
      level: 2,
      sortOrder: 22,
      isActive: true,
    },
    update: {
      parentId: rootExpense.id,
      name: "销售费用",
      level: 2,
      sortOrder: 22,
      isActive: true,
    },
  })

  console.log(`Budget subjects (${label}): 10000/10100, 20000/20100/20200`)
}

async function seedBudgetData() {
  const demoOrgId = "demo-org"
  const fiscalYear = new Date().getFullYear()

  const sub101 = await prisma.budgetSubject.findUniqueOrThrow({
    where: {
      organizationId_code: { organizationId: demoOrgId, code: "10100" },
    },
  })
  const sub201 = await prisma.budgetSubject.findUniqueOrThrow({
    where: {
      organizationId_code: { organizationId: demoOrgId, code: "20100" },
    },
  })
  const sub202 = await prisma.budgetSubject.findUniqueOrThrow({
    where: {
      organizationId_code: { organizationId: demoOrgId, code: "20200" },
    },
  })

  const demoUser = await prisma.user.findUniqueOrThrow({
    where: { email: "demo-user@example.com" },
  })

  const code = `SEED-${fiscalYear}-DEMO`
  let header = await prisma.budgetHeader.findFirst({
    where: { organizationId: demoOrgId, code },
  })

  if (!header) {
    header = await prisma.budgetHeader.create({
      data: {
        organizationId: demoOrgId,
        fiscalYear,
        code,
        name: `${fiscalYear} 年度示例预算（种子数据）`,
        status: BudgetStatus.DRAFT,
        currency: "CNY",
        compilationMethod: "INCREMENTAL",
        totalAmount: dec(0),
        periodStart: new Date(`${fiscalYear}-01-01`),
        periodEnd: new Date(`${fiscalYear}-12-31`),
        createdById: demoUser.id,
        updatedById: demoUser.id,
      },
    })

    await prisma.budgetLine.createMany({
      data: [
        {
          headerId: header.id,
          subjectId: sub101.id,
          amount: dec("1200000.00"),
          remark: "种子：主营业务收入预算",
          departmentCode: "DEPT-SALES",
        },
        {
          headerId: header.id,
          subjectId: sub201.id,
          amount: dec("350000.50"),
          remark: "种子：管理费用",
          departmentCode: "DEPT-ADM",
        },
        {
          headerId: header.id,
          subjectId: sub202.id,
          amount: dec("180000.00"),
          remark: "种子：销售费用",
          departmentCode: "DEPT-MKT",
        },
      ],
    })

    const total = dec("1730000.50")
    await prisma.budgetHeader.update({
      where: { id: header.id },
      data: { totalAmount: total },
    })
  }

  console.log(
    `Budget: header code ${code} for demo-org FY${fiscalYear} (skipped if exists)`
  )
}

async function main() {
  console.log("Seeding…")
  await seedOrganizations()
  await seedUsers()
  await seedBudgetSubjects("demo-org", "示例科技")
  await seedBudgetSubjects("seed-bj", "北京分公司")
  await seedBudgetData()
  console.log("Seed completed.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
