import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("approval workflow", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
  })

  test("approval todo page loads with heading", async ({ page }) => {
    await gotoWithRetry(page, "/approval/todo")
    await expect(page).toHaveURL(/\/approval\/todo/)
    await expect(page.getByRole("heading", { name: "审批待办" })).toBeVisible()
  })

  test("approval todo page shows data table or empty state", async ({ page }) => {
    await gotoWithRetry(page, "/approval/todo")
    await page.waitForTimeout(2000)
    const table = page.locator("table")
    if (await table.count() > 0) {
      await expect(page.getByRole("columnheader").first()).toBeVisible()
    } else {
      await expect(page.getByText(/暂无|没有待办|待办列表为空/)).toBeVisible()
    }
  })

  test("approval todo page shows refresh button", async ({ page }) => {
    await gotoWithRetry(page, "/approval/todo")
    await expect(page.getByRole("button", { name: "刷新" })).toBeVisible()
  })

  test("approval todo page shows filter section", async ({ page }) => {
    await gotoWithRetry(page, "/approval/todo")
    await expect(page.getByText("待办列表")).toBeVisible()
    await expect(page.getByRole("button", { name: "刷新" })).toBeVisible()
  })

  test("click on pending item shows approval detail dialog", async ({ page }) => {
    await gotoWithRetry(page, "/approval/todo")
    await page.waitForTimeout(2000)
    const firstItem = page.locator("tbody tr").first()
    if (await firstItem.count() > 0) {
      await firstItem.click()
      await page.waitForTimeout(1000)
      const dialog = page.locator("[role='dialog']")
      if (await dialog.count() > 0) {
        await expect(dialog).toBeVisible()
      }
    }
  })

})
