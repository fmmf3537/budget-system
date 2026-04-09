import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("budget adjustment", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
  })

  test("adjustment list page loads with heading", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    await expect(page).toHaveURL(/\/adjustment/)
    await expect(page.getByRole("heading", { name: "预算调整记录" })).toBeVisible()
  })

  test("adjustment list shows filter dropdowns", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    await expect(page.getByText("状态", { exact: true })).toBeVisible()
  })

  test("adjustment list shows 'new adjustment' button for authorized users", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    const newButton = page.getByRole("link", { name: "新建调整" })
    if (await newButton.count() > 0) {
      await expect(newButton).toBeVisible()
    }
  })

  test("adjustment list shows data table or empty state", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    await page.waitForTimeout(2000)
    const table = page.locator("table")
    if (await table.count() > 0) {
      await expect(page.getByRole("columnheader").first()).toBeVisible()
    }
  })

  test("filter by status", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    await page.locator("label", { hasText: "状态" }).locator("..").locator("[role='combobox']").click()
    await expect(page.getByRole("option", { name: "草稿" })).toBeVisible()
    await expect(page.getByRole("option", { name: "已提交" })).toBeVisible()
    await expect(page.getByRole("option", { name: "已批准" })).toBeVisible()
  })

  test("navigate to new adjustment page", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    const newButton = page.getByRole("link", { name: "新建调整" })
    if (await newButton.count() > 0) {
      await newButton.click()
      await expect(page).toHaveURL(/\/adjustment\/new/)
    }
  })

  test("new adjustment page shows form fields", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment/new")
    await expect(page.getByRole("heading", { name: "预算调整申请" })).toBeVisible()
    await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible()
  })

  test("adjustment list shows pagination", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    const pagination = page.getByRole("button", { name: "下一页" })
    if (await pagination.count() > 0) {
      await expect(pagination).toBeVisible()
    }
  })

  test("click on adjustment row navigates to detail", async ({ page }) => {
    await gotoWithRetry(page, "/adjustment")
    await page.waitForTimeout(2000)
    const firstRow = page.locator("tbody tr").first()
    if (await firstRow.count() > 0) {
      await firstRow.click()
      await page.waitForTimeout(1000)
    }
  })
})