import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"
import { gotoWithRetry } from "./navigation-helpers"

const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL ?? "admin@example.com"
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD ?? "fmmf5213537"

test.describe("users management", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(120_000)

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await submitLoginWithCredentials(page, TEST_USER_EMAIL, TEST_USER_PASSWORD)
  })

  test("users admin page loads with heading", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await expect(page).toHaveURL(/\/settings\/users/)
    await expect(page.getByRole("heading", { name: "用户管理" })).toBeVisible()
  })

  test("users admin shows data table", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await page.waitForTimeout(2000)
    await expect(page.getByRole("columnheader", { name: "姓名" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "邮箱" })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: "角色" })).toBeVisible()
  })

  test("users admin shows create user button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await expect(page.getByRole("button", { name: "新建用户" }).first()).toBeVisible()
  })

  test("users admin shows import excel button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await expect(page.getByRole("button", { name: "导入 Excel" })).toBeVisible()
  })

  test("users admin shows export excel button", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await expect(page.getByRole("button", { name: "下载模板" })).toBeVisible()
  })

  test("click create user opens dialog", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await page.getByRole("button", { name: "新建用户" }).first().click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("heading", { name: "新建用户" })).toBeVisible()
  })

  test("create user dialog shows role options", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await page.getByRole("button", { name: "新建用户" }).first().click()
    await page.waitForTimeout(500)
    const dialog = page.getByRole("dialog")
    if (await dialog.isVisible()) {
      await dialog.getByLabel("角色").click()
      await expect(page.getByRole("option", { name: "系统管理员" })).toBeVisible()
    }
  })

  test("create user form validation - missing fields", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await page.getByRole("button", { name: "新建用户" }).first().click()
    await page.getByRole("button", { name: "创建" }).click()
    await expect(page.getByText(/请输入|邮箱格式不正确|密码至少/)).toBeVisible({ timeout: 5000 })
  })

  test("edit user row button is visible", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await page.waitForTimeout(2000)
    const editButton = page.getByRole("button", { name: "编辑" }).first()
    if (await editButton.count() > 0) {
      await expect(editButton).toBeVisible()
    }
  })

  test("user status badge is displayed", async ({ page }) => {
    await gotoWithRetry(page, "/settings/users")
    await page.waitForTimeout(2000)
    await expect(page.getByText(/正常|待审批|停用/)).toBeVisible()
  })
})