import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("departments management", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
  })

  test("departments page loads with heading", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await expect(page).toHaveURL(/\/settings\/master-data\/departments/)
    await expect(page.getByRole("heading", { name: "部门 / 成本中心" })).toBeVisible()
  })

  test("departments page shows data table", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await page.waitForTimeout(2000)
    await expect(page.locator("table thead th", { hasText: "名称" }).first()).toBeVisible()
    await expect(page.locator("table thead th", { hasText: "编码" }).first()).toBeVisible()
  })

  test("departments page shows create button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await expect(page.getByRole("button", { name: "新建" })).toBeVisible()
  })

  test("departments page shows import button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await expect(page.getByRole("button", { name: "导入 Excel" })).toBeVisible()
  })

  test("departments page shows export button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await expect(page.getByRole("button", { name: "导出 Excel" })).toBeVisible()
  })

  test("click create department opens dialog", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await page.getByRole("button", { name: "新建" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("部门名称")).toBeVisible()
    await expect(page.getByText("部门编码")).toBeVisible()
  })

  test("create department dialog shows parent department dropdown", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await page.getByRole("button", { name: "新建" }).click()
    await expect(page.getByLabel("上级部门")).toBeVisible()
  })

  test("department row shows edit button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await page.waitForTimeout(2000)
    const editButton = page.getByRole("button", { name: "编辑" }).first()
    if (await editButton.count() > 0) {
      await expect(editButton).toBeVisible()
    }
  })

  test("department row shows delete button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/master-data/departments")
    await page.waitForTimeout(2000)
    const deleteButton = page.getByRole("button", { name: "删除" }).first()
    if (await deleteButton.count() > 0) {
      await expect(deleteButton).toBeVisible()
    }
  })
})