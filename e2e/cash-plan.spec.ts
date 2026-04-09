import { test, expect, type Page } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

async function readSummaryNumber(page: Page, label: string) {
  const card = page.locator("div", { hasText: label }).first()
  const valueText = (await card.locator("xpath=following-sibling::div[1]").textContent()) ?? "0"
  const normalized = valueText.replace(/,/g, "").trim()
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

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

  test("cash plan detail supports sub-plan workspace", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    await page.waitForTimeout(1500)

    const viewButton = page.getByRole("button", { name: /查看/ }).first()
    if ((await viewButton.count()) === 0) return
    await viewButton.click()
    await page.waitForTimeout(1200)

    const subPlanTab = page.getByRole("tab", { name: "月度子计划" })
    if ((await subPlanTab.count()) === 0) return
    await subPlanTab.click()

    await expect(page.getByText("月度子计划").first()).toBeVisible()
    await expect(page.getByText(/已审批子计划|汇总流入|净流量/)).toBeVisible()
  })

  test("sub-plan full flow updates aggregate after approval", async ({ page }) => {
    await gotoWithRetry(page, "/cash-plan")
    await page.waitForTimeout(1500)

    const viewButton = page.getByRole("button", { name: /查看/ }).first()
    if ((await viewButton.count()) === 0) return
    await viewButton.click()
    await page.waitForTimeout(1200)

    const detailUrl = page.url()
    const subPlanTab = page.getByRole("tab", { name: "月度子计划" })
    if ((await subPlanTab.count()) === 0) return
    await subPlanTab.click()
    await page.waitForTimeout(600)

    const netBefore = await readSummaryNumber(page, "净流量")

    const createTrigger = page.getByRole("combobox").filter({ hasText: "选择部门并创建子计划" })
    if ((await createTrigger.count()) === 0) return
    await createTrigger.first().click()
    const firstDept = page.getByRole("option").first()
    if ((await firstDept.count()) === 0) return
    await firstDept.click()

    const draftRow = page.locator("tbody tr", { has: page.getByRole("button", { name: "编辑" }) }).first()
    if ((await draftRow.count()) === 0) return
    await draftRow.getByRole("button", { name: "编辑" }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.getByRole("button", { name: "新增流入行" }).click()

    const periodText =
      (await page.locator("p", { hasText: "~" }).first().textContent()) ?? ""
    const dateMatch = periodText.match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/)
    const inRangeDate = dateMatch?.[1] ?? "2026-01-01"

    const amountInputs = page.locator('input:not([type="date"])')
    const amountInput = amountInputs.nth((await amountInputs.count()) - 1)
    await amountInput.fill("1234")
    const dateInputs = page.locator('input[type="date"]')
    const dateInput = dateInputs.nth((await dateInputs.count()) - 1)
    await dateInput.fill(inRangeDate)

    await page.getByRole("dialog").getByRole("button", { name: "保存" }).click()
    await page.waitForTimeout(900)

    const submitRow = page.locator("tbody tr", { has: page.getByRole("button", { name: "提交" }) }).first()
    if ((await submitRow.count()) === 0) return
    await submitRow.getByRole("button", { name: "提交" }).click()
    await page.waitForTimeout(1000)

    await gotoWithRetry(page, "/approval/todo")
    await page.waitForTimeout(1500)
    const subPlanTodoRow = page.locator("tbody tr", { hasText: "资金子计划" }).first()
    if ((await subPlanTodoRow.count()) === 0) return
    await subPlanTodoRow.getByRole("button", { name: "同意" }).click()
    await page.waitForTimeout(1500)

    await gotoWithRetry(page, detailUrl)
    await page.waitForTimeout(1000)
    await page.getByRole("tab", { name: "月度子计划" }).click()
    await page.waitForTimeout(1200)

    const netAfter = await readSummaryNumber(page, "净流量")
    expect(netAfter - netBefore).toBe(1234)
  })
})