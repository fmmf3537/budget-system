import { test, expect } from "@playwright/test"

const hasTestCreds =
  Boolean(process.env.TEST_USER_EMAIL) && Boolean(process.env.TEST_USER_PASSWORD)

test.describe("auth login", () => {
  test("full login with TEST_USER_*", async ({ page }) => {
    test.skip(!hasTestCreds, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD for this test")

    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD
    if (!email || !password) return

    await page.goto("/login")
    await page.getByLabel("邮箱").fill(email)
    await page.getByLabel("密码").fill(password)
    await page.getByRole("button", { name: "登录" }).click()

    await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name === "bs_session" && c.value.length > 0)).toBeTruthy()
  })
})
