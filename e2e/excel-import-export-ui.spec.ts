import { test, expect } from "@playwright/test"
import { gotoWithRetry } from "./navigation-helpers"
import { submitLoginWithCredentials } from "./login-helpers"

const EXCEL_DIALOG_TIMEOUT = 20_000

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
    await submitLoginWithCredentials(page, email, password)
    await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)
  })

  test("new budget page shows Excel export/import and import dialog", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/budget/new")
    await expect(page).toHaveURL(/\/budget\/new(?:\?.*)?$/)
    await expect(
      page.getByRole("heading", { name: "新建预算" })
    ).toBeVisible({ timeout: 60_000 })

    await expect(
      page.getByRole("button", { name: "Excel 导出" })
    ).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole("button", { name: "Excel 导入" })
    ).toBeVisible({ timeout: 30_000 })

    await page.getByRole("button", { name: "Excel 导入" }).click()
    const excelDialog = page.getByRole("dialog", { name: "Excel 导入" })
    await expect(excelDialog).toBeVisible({ timeout: EXCEL_DIALOG_TIMEOUT })
    await expect(
      excelDialog.getByRole("button", { name: "下载空模板" })
    ).toBeVisible({ timeout: EXCEL_DIALOG_TIMEOUT })
    await expect(
      excelDialog.getByRole("button", { name: "选择 Excel 文件" })
    ).toBeVisible({ timeout: EXCEL_DIALOG_TIMEOUT })
    await expect(
      excelDialog.getByRole("button", { name: "关闭" })
    ).toBeVisible({ timeout: EXCEL_DIALOG_TIMEOUT })
    await excelDialog.getByRole("button", { name: "关闭" }).click()
    await expect(excelDialog).not.toBeVisible({ timeout: EXCEL_DIALOG_TIMEOUT })
  })

  test("master data departments page shows export Excel", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await expect(page).toHaveURL(/\/settings\/master-data\/departments(?:\?.*)?$/)
    await ensureSettingsManageRole(page)
    const forbidden = page.getByText("页面权限不足", { exact: true })
    if ((await forbidden.count()) > 0 && (await forbidden.first().isVisible())) return
    await expect(
      page.getByRole("heading", { name: /部门/ })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole("button", { name: "导出 Excel" })
    ).toBeVisible({ timeout: 30_000 })
  })

  test("master data budget subjects page shows export Excel", async ({
    page,
  }) => {
    await gotoWithRetry(page, "/settings/master-data/budget-subjects")
    await expect(page).toHaveURL(/\/settings\/master-data\/budget-subjects(?:\?.*)?$/)
    await ensureSettingsManageRole(page)
    const forbidden = page.getByText("页面权限不足", { exact: true })
    if ((await forbidden.count()) > 0 && (await forbidden.first().isVisible())) return
    await expect(
      page.getByRole("heading", { name: "预算科目" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(
      page.getByRole("button", { name: "导出 Excel" })
    ).toBeVisible({ timeout: 30_000 })
  })

  test("master data dimensions page shows export Excel", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/dimensions")
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
    await gotoWithRetry(page, "/settings/master-data/cash-plan-categories")
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
    await gotoWithRetry(page, "/cash-plan")
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
    ).toBeVisible({ timeout: 30_000 })
  })
})
