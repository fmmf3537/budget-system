import { test, expect } from "@playwright/test"

test.describe("smoke", () => {
  test("root redirects to budget page", async ({ page, context }) => {
    const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
    await context.clearCookies()
    await context.addCookies([{ name: "mock_user_role", value: "ADMIN", url: base }])

    const res = await page.goto("/budget")
    expect(res?.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)
    await expect(page.getByRole("heading", { name: "预算编制" })).toBeVisible()
  })

  test("login page responds and shows form", async ({ page }) => {
    const res = await page.goto("/login")
    expect(res?.ok()).toBeTruthy()
    await expect(page.getByText("辰航卓越", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("西安辰航卓越科技有限公司").first()).toBeVisible()
    await expect(page.getByText("用户登录", { exact: true })).toBeVisible()
    await expect(page.getByLabel("邮箱")).toBeVisible()
    await expect(page.getByLabel("密码")).toBeVisible()
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible()
  })
})
