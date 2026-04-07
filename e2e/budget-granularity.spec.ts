import { test, expect } from "@playwright/test"

/**
 * 预算编制粒度 UI 回归（对应手工清单：列表筛选、新建表单粒度与期间预览）。
 * 需 webServer（npm run dev）；不依赖登录 Cookie，使用 mock 角色 Cookie 进入预算页。
 */
test.describe("budget compilation granularity UI", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(90_000)

  test.beforeEach(async ({ context }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    await context.clearCookies()
    await context.addCookies([
      { name: "mock_user_role", value: "ADMIN", url: base },
    ])
  })

  test("budget list shows granularity filters and period column", async ({
    page,
  }) => {
    await page.goto("/budget")
    await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)
    await expect(
      page.getByRole("heading", { name: "预算编制" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText("预算列表", { exact: true })).toBeVisible()
    await expect(page.getByText("编制粒度", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("预算年度", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: "编制期间" })
    ).toBeVisible()
  })

  test("new budget form: MONTHLY + March shows UTC period preview", async ({
    page,
  }) => {
    await page.goto("/budget/new")
    await expect(page).toHaveURL(/\/budget\/new(?:\?.*)?$/)
    await expect(
      page.getByRole("heading", { name: "新建预算" })
    ).toBeVisible({ timeout: 60_000 })

    await expect(
      page.getByText("期间预览（UTC 日历边界）", { exact: true })
    ).toBeVisible()

    const granCombo = page.getByRole("combobox", { name: "编制粒度" })
    await granCombo.click()
    await page.getByRole("option", { name: "月度" }).click()

    const monthCombo = page.getByRole("combobox", { name: "月份" })
    await monthCombo.click()
    await page.getByRole("option", { name: "3 月" }).click()

    await expect(
      page.getByText(/\d{4}-03-01.*\d{4}-03-31/)
    ).toBeVisible()
  })
})
