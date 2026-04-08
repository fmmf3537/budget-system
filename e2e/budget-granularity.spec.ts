import { test, expect } from "@playwright/test"

/**
 * 预算编制粒度 UI 回归（对应手工清单：列表筛选、新建表单粒度与期间预览）。
 * 需 webServer（npm run dev）；依赖 TEST_USER_* 登录。
 */
test.describe("budget compilation granularity UI", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(90_000)

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

  test("budget list shows granularity filters and period column", async ({
    page,
  }) => {
    await page.goto("/budget")
    await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)
    await expect(
      page.getByRole("heading", { name: "预算编制" })
    ).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText("预算列表", { exact: true })).toBeVisible()
    await expect(page.getByText("编制粒度", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("预算年度", { exact: true })).toBeVisible()
    await expect(
      page.getByRole("columnheader", { name: "编制期间" })
    ).toBeVisible()
  })

  test("new budget form: MONTHLY + March shows UTC period preview", async ({
    page,
  }) => {
    await page.goto("/budget/new")
    await expect(page).toHaveURL(/\/budget\/new(?:\?.*)?$/)
    await expect(
      page.getByRole("heading", { name: "新建预算" })
    ).toBeVisible({ timeout: 60_000 })

    await expect(
      page.getByText("期间预览（UTC 日历边界）", { exact: true })
    ).toBeVisible()

    const granCombo = page.getByRole("combobox", { name: "编制粒度" })
    await granCombo.click()
    await page.getByRole("option", { name: "月度" }).click()

    const monthCombo = page.getByRole("combobox", { name: "月份" })
    await monthCombo.click()
    await page.getByRole("option", { name: "3 月" }).click()

    await expect(
      page.getByText(/\d{4}-03-01.*\d{4}-03-31/)
    ).toBeVisible()
  })
})
