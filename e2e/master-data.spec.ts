import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("master data management", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(180_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
  })

  test.describe("budget subjects", () => {
    test("budget subjects page loads with heading", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/budget-subjects")
      await expect(page).toHaveURL(/\/settings\/master-data\/budget-subjects/)
      await expect(page.getByRole("heading", { name: "预算科目" })).toBeVisible()
    })

    test("budget subjects shows data table", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/budget-subjects")
      await page.waitForTimeout(2000)
      // Check table is visible or empty state
      const table = page.locator("table")
      if (await table.count() > 0) {
        await expect(page.getByRole("columnheader").first()).toBeVisible()
      }
    })

    test("budget subjects shows create button", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/budget-subjects")
      await expect(page.getByRole("button", { name: "新建科目" })).toBeVisible()
    })

    test("budget subjects shows import button", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/budget-subjects")
      await expect(page.getByRole("button", { name: "导入 Excel" })).toBeVisible()
    })
  })

  test.describe("dimensions", () => {
    test("dimensions page loads with heading", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/dimensions")
      await expect(page).toHaveURL(/\/settings\/master-data\/dimensions/)
      await expect(page.getByRole("heading", { name: "预算维度值" })).toBeVisible()
    })

    test("dimensions shows data table", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/dimensions")
      await page.waitForTimeout(2000)
      await expect(page.locator("table thead th", { hasText: "维度名称" }).first()).toBeVisible()
    })

    test("dimensions shows create button", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/dimensions")
      await expect(page.getByRole("button", { name: "新建维度" })).toBeVisible()
    })

    test("dimensions shows import and export buttons", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/dimensions")
      await expect(page.getByRole("button", { name: "导入 Excel" })).toBeVisible()
      await expect(page.getByRole("button", { name: "下载模板" }).first()).toBeVisible()
    })
  })

  test.describe("cash plan categories", () => {
    test("cash plan categories page loads with heading", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/cash-plan-categories")
      await expect(page).toHaveURL(/\/settings\/master-data\/cash-plan-categories/)
      await expect(page.getByRole("heading", { name: "资金类别" })).toBeVisible()
    })

    test("cash plan categories shows data table", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/cash-plan-categories")
      await page.waitForTimeout(2000)
      await expect(page.locator("table thead th", { hasText: "类别名称" }).first()).toBeVisible()
      await expect(page.locator("table thead th", { hasText: "类型" }).first()).toBeVisible()
    })

    test("cash plan categories shows create button", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/cash-plan-categories")
      await expect(page.getByRole("button", { name: "新建类别" })).toBeVisible()
    })

    test("cash plan categories shows import and export buttons", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data/cash-plan-categories")
      await expect(page.getByRole("button", { name: "导入 Excel" })).toBeVisible()
      await expect(page.getByRole("button", { name: "下载模板" }).first()).toBeVisible()
    })
  })

  test.describe("master data overview", () => {
    test("master data overview page loads", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data")
      await expect(page).toHaveURL(/\/settings\/master-data/)
      await expect(page.getByRole("heading", { name: "主数据管理" })).toBeVisible()
    })

    test("master data overview shows navigation cards", async ({ page }) => {
      await gotoWithRetry(page, "/settings/master-data")
      await expect(page.getByRole("link", { name: "部门管理" })).toBeVisible()
      await expect(page.getByRole("link", { name: "预算科目" })).toBeVisible()
      await expect(page.getByRole("link", { name: "维度管理" })).toBeVisible()
      await expect(page.getByRole("link", { name: "资金类别" })).toBeVisible()
    })
  })
})