import { test, expect } from "@playwright/test"

/**
 * Excel 导入/导出相关 UI（预算表单、主数据导出）。
 * 使用 mock 角色 Cookie（与 budget-granularity.spec 一致）；依赖 dev 服务与可访问的页面。
 */
test.describe("excel import/export UI", () => {
  test.beforeEach(async ({ context }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    await context.addCookies([
      { name: "mock_user_role", value: "ADMIN", url: base },
    ])
  })

  test("new budget page shows Excel export/import and import dialog", async ({
    page,
  }) => {
    await page.goto("/budget/new")
    await expect(
      page.getByRole("heading", { name: "新建预算" })
    ).toBeVisible({ timeout: 60_000 })

    await expect(
      page.getByRole("button", { name: "Excel 导出" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Excel 导入" })
    ).toBeVisible()

    await page.getByRole("button", { name: "Excel 导入" }).click()
    await expect(
      page.getByRole("dialog", { name: "Excel 导入" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "下载空模板" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "选择 Excel 文件" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "关闭" })
    ).toBeVisible()
    await page.getByRole("button", { name: "关闭" }).click()
    await expect(
      page.getByRole("dialog", { name: "Excel 导入" })
    ).not.toBeVisible()
  })

  test("master data departments page shows export Excel", async ({ page }) => {
    await page.goto("/settings/master-data/departments")
    await expect(
      page.getByRole("heading", { name: /部门/ })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole("button", { name: "导出 Excel" })
    ).toBeVisible()
  })

  test("master data budget subjects page shows export Excel", async ({
    page,
  }) => {
    await page.goto("/settings/master-data/budget-subjects")
    await expect(
      page.getByRole("heading", { name: "预算科目" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole("button", { name: "导出 Excel" })
    ).toBeVisible()
  })

  test("master data dimensions page shows export Excel", async ({ page }) => {
    await page.goto("/settings/master-data/dimensions")
    await expect(
      page.getByRole("heading", { name: "预算维度值" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole("button", { name: "导出 Excel" }).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test("master data cash plan categories page shows export Excel", async ({
    page,
  }) => {
    await page.goto("/settings/master-data/cash-plan-categories")
    await expect(
      page.getByRole("heading", { name: "资金计划类别" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole("button", { name: "导出 Excel" })
    ).toBeVisible({ timeout: 30_000 })
  })

  test("cash plan list: detail shows Excel buttons when a plan exists", async ({
    page,
  }) => {
    await page.goto("/cash-plan")
    await expect(
      page.getByRole("heading", { name: "资金计划" })
    ).toBeVisible({ timeout: 60_000 })

    const detailLink = page.locator(
      'a[href^="/cash-plan/"]:not([href="/cash-plan/dashboard"])'
    )

    if ((await detailLink.count()) === 0) {
      return
    }

    await detailLink.first().click()
    await expect(
      page.getByRole("button", { name: "Excel 导出" })
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole("button", { name: "Excel 导入" })
    ).toBeVisible()
  })
})
