import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  budgetDimensionValue: {
    findMany: vi.fn(),
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

import { GET } from "@/app/api/master-data/dimension-values/route"
import { requireApiPermission } from "@/lib/api/require-permission"
import { requireAuth } from "@/lib/api/request-auth"

const authCtx = {
  userId: "user-1",
  organizationId: "org-1",
  role: "ADMIN" as const,
}

describe("GET /api/master-data/dimension-values?slot=1", () => {
  beforeEach(() => {
    vi.mocked(requireAuth).mockResolvedValue(authCtx)
    vi.mocked(requireApiPermission).mockResolvedValue(authCtx)
    vi.mocked(prismaMock.budgetDimensionValue.findMany).mockResolvedValue([
      {
        id: "v1",
        slot: 1,
        code: "P-A",
        name: "项目A",
        sortOrder: 0,
        isActive: true,
      },
    ] as never)
  })

  it("returns items for org and slot", async () => {
    const url = new URL("http://localhost/api/master-data/dimension-values")
    url.searchParams.set("slot", "1")
    const res = await GET(new Request(url.toString()))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      success: boolean
      data?: { items: { code: string }[] }
    }
    expect(body.success).toBe(true)
    expect(body.data?.items?.[0]?.code).toBe("P-A")
    expect(prismaMock.budgetDimensionValue.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: "org-1",
          slot: 1,
          isActive: true,
        }),
      })
    )
  })
})
