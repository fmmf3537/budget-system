import { describe, expect, it } from "vitest"

import { GET as GETDimensions } from "@/app/api/master-data/dimension-values/route"
import { GET as GETCashCategories } from "@/app/api/master-data/cash-plan-categories/route"

async function json(res: Response) {
  return res.json() as Promise<{
    success: boolean
    error?: { code?: string; message?: string }
  }>
}

describe("GET /api/master-data/dimension-values — 查询参数校验", () => {
  it("returns 400 when slot is missing", async () => {
    const res = await GETDimensions(
      new Request("http://localhost/api/master-data/dimension-values")
    )
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.success).toBe(false)
    expect(body.error?.message).toMatch(/slot/)
  })
})

describe("GET /api/master-data/cash-plan-categories — 查询参数校验", () => {
  it("returns 400 when kind is missing and not manage mode", async () => {
    const res = await GETCashCategories(
      new Request("http://localhost/api/master-data/cash-plan-categories")
    )
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.success).toBe(false)
    expect(body.error?.message).toMatch(/kind/)
  })

  it("returns 400 when kind is invalid", async () => {
    const url = new URL("http://localhost/api/master-data/cash-plan-categories")
    url.searchParams.set("kind", "INVALID")
    const res = await GETCashCategories(new Request(url.toString()))
    expect(res.status).toBe(400)
    const body = await json(res)
    expect(body.success).toBe(false)
  })
})
