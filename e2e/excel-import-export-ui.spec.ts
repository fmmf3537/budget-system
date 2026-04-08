import { test, expect } from "@playwright/test"

/**
 * Excel 导入/导出相关 UI（预算表单、主数据导出）。
 * 依赖已登录会话（TEST_USER_*）与 dev 服务。
 */
test.describe("excel import/export UI", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(90_000)

  async function ensureSettingsManageRole(page: import("@playwright/test").Page) {
    const forbiddenAlert = page.getByText("页面权限不足", { exact: true })
    if ((await forbiddenAlert.count()) === 0) return
    if (!(await forbiddenAlert.first().isVisible())) return

    await page.getByRole("button", { name: "用户菜单" }).click()
    const adminItem = page.getByText("系统管理员", { exact: true })
    if ((await adminItem.count()) === 0) return
    await adminItem.click({ force: true })
    await page.reload()
  }

  const hasTestCreds =
    Boolean(process.env.TEST_USER_EMAIL) &&
    Boolean(process.env.TEST_USER_PASSWORD)

  test.beforeEach(async ({ page, context }) => {
    test.skip(
      !hasTestCreds,
      "Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated e2e"
    )

    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD
    if (!email || !password) return

    await context.clearCookies()
    await page.goto("/login")
    await page.getByLabel("邮箱").fill(email)
    await page.getByLabel("密码").fill(password)
    await page.getByRole("button", { name: "登录" }).click()
    await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)
  })

  test("new budget page shows Excel export/import and import dialog", async ({
    page,
  }) => {
    await page.goto("/budget/new")
    await expect(page).toHaveURL(/\/budget\/new(?:\?.*)?$/)
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
    await expect(page).toHaveURL(/\/settings\/master-data\/departments(?:\?.*)?$/)
    await ensureSettingsManageRole(page)
    const forbidden = page.getByText("页面权限不足", { exact: true })
    if ((await forbidden.count()) > 0 && (await forbidden.first().isVisible())) return
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
    await expect(page).toHaveURL(/\/settings\/master-data\/budget-subjects(?:\?.*)?$/)
    await ensureSettingsManageRole(page)
    const forbidden = page.getByText("页面权限不足", { exact: true })
    if ((await forbidden.count()) > 0 && (await forbidden.first().isVisible())) return
    await expect(
      page.getByRole("heading", { name: "预算科目" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole("button", { name: "导出 Excel" })
    ).toBeVisible()
  })

  test("master data dimensions page shows export Excel", async ({ page }) => {
    await page.goto("/settings/master-data/dimensions")
    await expect(page).toHaveURL(/\/settings\/master-data\/dimensions(?:\?.*)?$/)
    await ensureSettingsManageRole(page)
    const forbidden = page.getByText("页面权限不足", { exact: true })
    if ((await forbidden.count()) > 0 && (await forbidden.first().isVisible())) return
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
    await expect(page).toHaveURL(/\/settings\/master-data\/cash-plan-categories(?:\?.*)?$/)
    await ensureSettingsManageRole(page)
    const forbidden = page.getByText("页面权限不足", { exact: true })
    if ((await forbidden.count()) > 0 && (await forbidden.first().isVisible())) return
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
    await expect(page).toHaveURL(/\/cash-plan(?:\?.*)?$/)
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
