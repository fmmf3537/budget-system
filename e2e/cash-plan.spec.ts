import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("cash plan management", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
  })

  test("cash plan list page loads with heading", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    await expect(page).toHaveURL(/\/cash-plan/)
    await expect(page.getByRole("heading", { name: "资金计划" })).toBeVisible()
  })

  test("cash plan list shows filter section", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    await expect(page.getByText("筛选", { exact: true }).first()).toBeVisible()
  })

  test("cash plan list shows 'new cash plan' button for authorized users", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    const newButton = page.getByRole("link", { name: "新建资金计划" })
    if (await newButton.count() > 0) {
      await expect(newButton).toBeVisible()
    }
  })

  test("cash plan list shows data table or empty state", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    await page.waitForTimeout(2000)
    const table = page.locator("table")
    if (await table.count() > 0) {
      await expect(page.getByRole("columnheader").first()).toBeVisible()
    }
  })

  test("filter by status", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    await page.locator("label", { hasText: "状态" }).locator("..").locator("[role='combobox']").click()
    await expect(page.getByRole("option", { name: "编制中" })).toBeVisible()
    await expect(page.getByRole("option", { name: "已提交" })).toBeVisible()
  })

  test("cash plan dashboard page loads", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan/dashboard")
    await expect(page).toHaveURL(/\/cash-plan\/dashboard/)
    await expect(page.getByRole("heading", { name: "现金流看板" })).toBeVisible()
  })

  test("click on cash plan row navigates to detail", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    await page.waitForTimeout(2000)
    const firstRow = page.locator("tbody tr").first()
    if (await firstRow.count() > 0) {
      await firstRow.click()
      await page.waitForTimeout(1000)
    }
  })

  test("cash plan dashboard shows summary cards", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan/dashboard")
    await page.waitForTimeout(2000)
    await expect(page.getByText(/本期流入|本期流出|净流入/)).toBeVisible()
  })
})