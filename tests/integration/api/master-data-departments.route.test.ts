import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  budgetDepartment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}))

vi.mock("@/lib/api/require-permission", () => ({
  requireApiPermission: vi.fn(),
}))

vi.mock("@/lib/api/request-auth", () => ({
  requireAuth: vi.fn(),
}))

import { GET, POST } from "@/app/api/master-data/departments/route"
import { requireApiPermission } from "@/lib/api/require-permission"
import { requireAuth } from "@/lib/api/request-auth"

const authCtx = {
  userId: "user-1",
  organizationId: "org-1",
  role: "ADMIN" as const,
}

async function json(res: Response) {
  return res.json() as Promise<{
    success: boolean
    data?: { items?: unknown[]; id?: string; code?: string }
    error?: { code?: string; message?: string }
  }>
}

describe("GET /api/master-data/departments", () => {
  beforeEach(() => {
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
    vi.mocked(requireAuth).mockResolvedValue(authCtx)
    vi.mocked(prismaMock.budgetDepartment.findMany).mockResolvedValue([
      {
        id: "d1",
        code: "HQ",
        name: "总部",
        sortOrder: 0,
        isActive: true,
      },
    ] as never)
  })

  it("manage=1 lists all activity states via prisma", async () => {
    const url = new URL("http://localhost/api/master-data/departments")
    url.searchParams.set("manage", "1")
    const res = await GET(new Request(url.toString()))
    expect(res.status).toBe(200)
    const body = await json(res)
    expect(body.success).toBe(true)
    expect(body.data?.items).toHaveLength(1)
    expect(vi.mocked(prismaMock.budgetDepartment.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
        }),
      })
    )
  })

  it("non-manage filters isActive true", async () => {
    const res = await GET(new Request("http://localhost/api/master-data/departments"))
    expect(res.status).toBe(200)
    expect(vi.mocked(prismaMock.budgetDepartment.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
        }),
      })
    )
  })
})

describe("POST /api/master-data/departments", () => {
  beforeEach(() => {
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
    vi.mocked(prismaMock.budgetDepartment.findFirst).mockResolvedValue(null)
    vi.mocked(prismaMock.budgetDepartment.create).mockResolvedValue({
      id: "new-1",
      code: "BR01",
      name: "分部",
      sortOrder: 1,
      isActive: true,
    } as never)
  })

  it("returns 201 when create succeeds", async () => {
    const req = new Request("http://localhost/api/master-data/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "BR01",
        name: "分部",
        sortOrder: 1,
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await json(res)
    expect(body.success).toBe(true)
    expect(body.data?.code).toBe("BR01")
  })

  it("returns 409 when code already exists", async () => {
    vi.mocked(prismaMock.budgetDepartment.findFirst).mockResolvedValue({
      id: "x",
    } as never)
    const req = new Request("http://localhost/api/master-data/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "DUP", name: "重复" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const body = await json(res)
    expect(body.success).toBe(false)
    expect(body.error?.code).toBe("DUPLICATE")
  })

  it("returns 400 for invalid JSON body", async () => {
    const req = new Request("http://localhost/api/master-data/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
