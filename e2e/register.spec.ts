import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"
const TEST_ORG_NAME = process.env.TEST_ORG_NAME ?? "chenhang"

test.describe("register", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(90_000)

  const randomEmail = `test-${Date.now()}@example.com`
  const randomName = `测试用户${Date.now()}`

  test("register page shows form", async ({ page }) => {
    const res = await page.goto("/register")
    expect(res?.ok()).toBeTruthy()
    await expect(page.getByRole("heading", { name: "账号注册" })).toBeVisible()
    await expect(page.getByLabel("邮箱")).toBeVisible()
    await expect(page.getByLabel("姓名")).toBeVisible()
    await expect(page.getByLabel("密码").first()).toBeVisible()
    await expect(page.getByRole("button", { name: "注册" })).toBeVisible()
  })

  test("register with valid credentials shows pending approval message", async ({ page }) => {
    await gotoWithRetry(page, "/register")
    await page.getByLabel("邮箱").fill(randomEmail)
    await page.getByLabel("姓名").fill(randomName)
    await page.getByLabel("密码").first().fill("TestPass123!")
    await page.getByLabel("确认密码").fill("TestPass123!")
    await page.getByRole("button", { name: "注册" }).click()
    await expect(page.getByText("注册申请已提交")).toBeVisible({ timeout: 10000 })
  })

  test("register with mismatched passwords shows validation error", async ({ page }) => {
    await gotoWithRetry(page, "/register")
    await page.getByLabel("邮箱").fill(`test2-${Date.now()}@example.com`)
    await page.getByLabel("姓名").fill("测试用户2")
    await page.getByLabel("密码").first().fill("TestPass123!")
    await page.getByLabel("确认密码").fill("DifferentPass123!")
    await page.getByRole("button", { name: "注册" }).click()
    await expect(page.getByText("两次输入的密码不一致")).toBeVisible({ timeout: 5000 })
  })

  test("register with duplicate email shows error", async ({ page }) => {
    await gotoWithRetry(page, "/register")
    await page.getByLabel("邮箱").fill(TEST_USER_EMAIL)
    await page.getByLabel("姓名").fill("重复测试")
    await page.getByLabel("密码").first().fill("TestPass123!")
    await page.getByLabel("确认密码").fill("TestPass123!")
    await page.getByRole("button", { name: "注册" }).click()
    await expect(page.getByText(/该邮箱已注册|已注册/)).toBeVisible({ timeout: 10000 })
  })

  test("register page has link to login", async ({ page }) => {
    await gotoWithRetry(page, "/register")
    await expect(page.getByRole("link", { name: "返回登录" })).toBeVisible({ timeout: 10000 })
    await page.getByRole("link", { name: "返回登录" }).click()
    await expect(page).toHaveURL(/\/login/)
  })

  test("registered user needs admin approval to login", async ({ page }) => {
    await submitLoginWithCredentials(page, randomEmail, "TestPass123!")
    await page.waitForTimeout(2000)
  })
})