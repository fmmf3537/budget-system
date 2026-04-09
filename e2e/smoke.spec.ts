import { test, expect } from "@playwright/test"

test.describe("smoke", () => {
  test("unauthenticated user is redirected to login", async ({ page, context }) => {
    await context.clearCookies()

    const res = await page.goto("/")
    expect(res?.ok()).toBeTruthy()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
    await expect(page.getByRole("heading", { name: "预算管理平台" })).toBeVisible()
  })

  test("login page responds and shows form", async ({ page }) => {
    const res = await page.goto("/login")
    expect(res?.ok()).toBeTruthy()
    await expect(page.getByText("辰航卓越", { exact: true }).first()).toBeVisible()
    await expect(page.getByText("西安辰航卓越科技有限公司").first()).toBeVisible()
    await expect(page.getByText("用户登录", { exact: true }).first()).toBeVisible()
    await expect(page.getByLabel("邮箱")).toBeVisible()
    await expect(page.getByLabel("密码")).toBeVisible()
    await expect(page.getByRole("button", { name: "登录" })).toBeVisible()
  })
})
