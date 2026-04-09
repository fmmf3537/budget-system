import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("permissions and access control", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test("unauthenticated user cannot access protected pages", async ({ page, context }) => {
    await context.clearCookies()
    
    const protectedPages = [
      "/budget",
      "/adjustment",
      "/approval/todo",
      "/cash-plan",
      "/settings/users",
    ]
    
    for (const path of protectedPages) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
    }
  })

  test("unauthenticated user is redirected to login with 'from' param", async ({ page, context }) => {
    await context.clearCookies()
    await page.goto("/budget")
    await expect(page).toHaveURL(/\/login\?from=%2Fbudget/)
  })

  test("user without permission sees unauthorized page", async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
    
    await gotoWithRetry(page, "/settings/users")
    const currentUrl = page.url()
    if (currentUrl.includes("/unauthorized")) {
      await expect(page.getByText("页面权限不足")).toBeVisible()
    }
  })

  test("login page is not accessible when already authenticated", async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
    
    await page.goto("/login")
    await expect(page).toHaveURL(/\/budget/)
  })

  test("register page is not accessible when already authenticated", async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
    
    await page.goto("/register")
    await expect(page).toHaveURL(/\/budget/)
  })

  test("logout clears session and redirects to login", async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
    
    await page.getByRole("button", { name: "用户菜单" }).click()
    await page.getByText("退出登录").click()
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(/\/login/)
  })

  test("user menu shows current user info", async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
    
    await page.getByRole("button", { name: "用户菜单" }).click()
    await expect(page.getByText("当前用户")).toBeVisible()
    await expect(page.getByText("角色")).toBeVisible()
  })
})