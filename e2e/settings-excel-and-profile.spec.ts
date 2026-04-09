import { expect, test, type Page } from "@playwright/test"
import { gotoWithRetry } from "./navigation-helpers"
import { submitLoginWithCredentials } from "./login-helpers"

const hasTestCreds =
  Boolean(process.env.TEST_USER_EMAIL) && Boolean(process.env.TEST_USER_PASSWORD)
const enableMutableProfileTests = process.env.E2E_PROFILE_MUTATION === "1"
const e2eNewPassword = process.env.TEST_USER_NEW_PASSWORD

async function login(page: Page) {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  if (!email || !password) return
  await submitLoginWithCredentials(page, email, password)
  await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)
}

async function loginWith(page: Page, email: string, password: string) {
  await submitLoginWithCredentials(page, email, password)
  await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)
}

async function gotoOrSkipUnauthorized(page: Page, path: string) {
  await gotoWithRetry(page, path)
  if (page.url().includes("/unauthorized")) {
    test.skip(true, `Current test account has no access to ${path}`)
  }
}

test.describe("settings excel + profile e2e", () => {
  test.describe.configure({ mode: "serial" })
  test.setTimeout(90_000)

  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !hasTestCreds,
      "Set TEST_USER_EMAIL and TEST_USER_PASSWORD for authenticated e2e"
    )
    await context.clearCookies()
    await login(page)
  })

  test("master-data pages show import and template download", async ({ page }) => {
    const pages = [
      "/settings/master-data/departments",
      "/settings/master-data/budget-subjects",
      "/settings/master-data/dimensions",
      "/settings/master-data/cash-plan-categories",
    ]
    for (const p of pages) {
      await gotoOrSkipUnauthorized(page, p)
      await expect(page).toHaveURL(new RegExp(`${p}(?:\\?.*)?$`))
      await expect(page.getByRole("button", { name: "导入 Excel" }).first()).toBeVisible({
        timeout: 30_000,
      })
      await page.getByRole("button", { name: "导入 Excel" }).first().click()
      await expect(page.getByRole("button", { name: "下载模板" }).first()).toBeVisible({
        timeout: 20_000,
      })
      await page.keyboard.press("Escape")
    }
  })

  test("budget-template and approval-flow show import + template", async ({ page }) => {
    const pages = ["/settings/budget-template", "/settings/approval-flow"]
    for (const p of pages) {
      await gotoOrSkipUnauthorized(page, p)
      await expect(page).toHaveURL(new RegExp(`${p}(?:\\?.*)?$`))
      await expect(page.getByRole("button", { name: "导入 Excel" }).first()).toBeVisible({
        timeout: 30_000,
      })
      await page.getByRole("button", { name: "导入 Excel" }).first().click()
      await expect(page.getByRole("button", { name: "下载模板" }).first()).toBeVisible({
        timeout: 20_000,
      })
      await page.keyboard.press("Escape")
    }
  })

  test("profile page updates password with validation messages", async ({ page }) => {
    await gotoOrSkipUnauthorized(page, "/settings/profile")
    await expect(page).toHaveURL(/\/settings\/profile(?:\?.*)?$/)
    await expect(page.getByRole("heading", { name: "个人信息" })).toBeVisible({
      timeout: 30_000,
    })

    await page.getByLabel("原密码").fill("wrong-password")
    await page.getByLabel("新密码（至少 8 位）").fill("NewPassw0rd!")
    await page.getByLabel("确认新密码").fill("Mismatch123!")
    await page.getByRole("button", { name: "修改密码" }).click()
    await expect(page.getByText("两次输入的新密码不一致")).toBeVisible()
  })

  test("profile base info can update and rollback", async ({ page }) => {
    test.skip(
      !enableMutableProfileTests,
      "Set E2E_PROFILE_MUTATION=1 to run mutable profile tests"
    )
    const email = process.env.TEST_USER_EMAIL
    const oldName = process.env.TEST_USER_NAME
    test.skip(!email || !oldName, "Set TEST_USER_EMAIL and TEST_USER_NAME")

    await gotoOrSkipUnauthorized(page, "/settings/profile")
    await expect(page).toHaveURL(/\/settings\/profile(?:\?.*)?$/)

    const tempName = `${oldName}-e2e`
    await page.getByLabel("姓名").fill(tempName)
    await page.getByRole("button", { name: "保存基础信息" }).click()
    await expect(page.getByText("个人信息已保存")).toBeVisible()

    await page.reload()
    await expect(page.getByLabel("姓名")).toHaveValue(tempName)

    await page.getByLabel("姓名").fill(oldName)
    await page.getByRole("button", { name: "保存基础信息" }).click()
    await expect(page.getByText("个人信息已保存")).toBeVisible()
  })

  test("profile password can change and rollback", async ({ page, context }) => {
    test.skip(
      !enableMutableProfileTests,
      "Set E2E_PROFILE_MUTATION=1 to run mutable profile tests"
    )
    const email = process.env.TEST_USER_EMAIL
    const oldPassword = process.env.TEST_USER_PASSWORD
    test.skip(
      !email || !oldPassword || !e2eNewPassword,
      "Set TEST_USER_EMAIL, TEST_USER_PASSWORD and TEST_USER_NEW_PASSWORD"
    )

    await gotoOrSkipUnauthorized(page, "/settings/profile")
    await expect(page).toHaveURL(/\/settings\/profile(?:\?.*)?$/)

    await page.getByLabel("原密码").fill(oldPassword!)
    await page.getByLabel("新密码（至少 8 位）").fill(e2eNewPassword!)
    await page.getByLabel("确认新密码").fill(e2eNewPassword!)
    await page.getByRole("button", { name: "修改密码" }).click()
    await expect(page.getByText("密码修改成功")).toBeVisible()

    await context.clearCookies()
    await loginWith(page, email!, e2eNewPassword!)

    await gotoOrSkipUnauthorized(page, "/settings/profile")
    await page.getByLabel("原密码").fill(e2eNewPassword!)
    await page.getByLabel("新密码（至少 8 位）").fill(oldPassword!)
    await page.getByLabel("确认新密码").fill(oldPassword!)
    await page.getByRole("button", { name: "修改密码" }).click()
    await expect(page.getByText("密码修改成功")).toBeVisible()
  })
})
