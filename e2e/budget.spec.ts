import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("budget management", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
  })

  test("budget list page loads with heading", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await expect(page).toHaveURL(/\/budget/)
    await expect(page.getByRole("heading", { name: "预算编制" })).toBeVisible()
  })

  test("budget list shows search input", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await expect(page.getByLabel("名称搜索")).toBeVisible()
  })

  test("budget list shows filter dropdowns", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await expect(page.getByText("预算年度", { exact: true })).toBeVisible()
    await expect(page.getByText("编制粒度", { exact: true })).toBeVisible()
  })

  test("budget list shows 'new budget' button", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await expect(page.getByRole("link", { name: "新建预算" })).toBeVisible()
  })

  test("budget list shows data table when data exists", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await page.waitForTimeout(2000)
    const table = page.locator("table")
    const hasTable = await table.count() > 0
    if (hasTable) {
      await expect(page.getByRole("columnheader").first()).toBeVisible()
    }
  })

  test("navigate to new budget page", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await page.getByRole("link", { name: "新建预算" }).click()
    await expect(page).toHaveURL(/\/budget\/new/)
    await expect(page.getByRole("heading", { name: "新建预算" })).toBeVisible()
  })

  test("new budget page shows form fields", async ({ page }) => {
    await gotoWithRetry(page, "/budget/new")
    await expect(page.getByLabel("预算名称")).toBeVisible()
    await expect(page.getByLabel("预算年度")).toBeVisible()
    await expect(page.getByLabel("编制粒度")).toBeVisible()
    await expect(page.getByRole("button", { name: "保存草稿" })).toBeVisible()
  })

  test("new budget page allows selecting granularity", async ({ page }) => {
    await gotoWithRetry(page, "/budget/new")
    await page.getByLabel("编制粒度").click()
    await expect(page.getByRole("option", { name: "年度" })).toBeVisible()
    await expect(page.getByRole("option", { name: "季度" })).toBeVisible()
    await expect(page.getByRole("option", { name: "月度" })).toBeVisible()
  })

  test("create new budget as draft", async ({ page }) => {
    await gotoWithRetry(page, "/budget/new")
    const budgetName = `测试预算-${Date.now()}`
    await page.getByLabel("预算名称").fill(budgetName)
    await page.getByRole("button", { name: "保存草稿" }).click()
    await expect(page.getByText(/保存成功|已保存|草稿/)).toBeVisible({ timeout: 10000 })
  })

  test("budget list filter by year", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await page.locator("label", { hasText: "预算年度" }).locator("..").locator("[role='combobox']").click()
    await page.getByRole("option", { name: "2026 年" }).click()
    await page.waitForTimeout(1000)
  })

  test("budget list filter by granularity", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await page.locator("label", { hasText: "编制粒度" }).locator("..").locator("[role='combobox']").click()
    await page.getByRole("option", { name: "年度" }).click()
    await page.waitForTimeout(1000)
  })

  test("click on budget row navigates to detail", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await page.waitForTimeout(2000)
    const firstRow = page.locator("tbody tr").first()
    if (await firstRow.count() > 0) {
      await firstRow.click()
      await page.waitForTimeout(2000)
      const url = page.url()
      expect(url).toMatch(/\/budget\//)
    }
  })

  test("click MoreActions shows dropdown menu", async ({ page }) => {
    await gotoWithRetry(page, "/budget")
    await page.waitForTimeout(2000)
    const moreButton = page.getByRole("button", { name: "更多" }).first()
    if (await moreButton.count() > 0) {
      await moreButton.click()
      await expect(page.getByRole("menuitem", { name: "编辑" })).toBeVisible()
    }
  })
})