import { test, expect } from "@playwright/test"
import { submitLoginWithCredentials } from "./login-helpers"

const hasTestCreds =
  Boolean(process.env.TEST_USER_EMAIL) && Boolean(process.env.TEST_USER_PASSWORD)

test.describe("auth login", () => {
  test("full login with TEST_USER_*", async ({ page }) => {
    test.skip(!hasTestCreds, "Set TEST_USER_EMAIL and TEST_USER_PASSWORD for this test")

    const email = process.env.TEST_USER_EMAIL
    const password = process.env.TEST_USER_PASSWORD
    if (!email || !password) return

    await submitLoginWithCredentials(page, email, password)

    await expect(page).toHaveURL(/\/budget(?:\?.*)?$/)

    const cookies = await page.context().cookies()
    expect(cookies.some((c) => c.name === "bs_session" && c.value.length > 0)).toBeTruthy()
  })
})
