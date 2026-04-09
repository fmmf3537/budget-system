import type { Page } from "@playwright/test"
import { gotoWithRetry } from "./navigation-helpers"

/**
 * 登录页为客户端受控表单；在 React 水合前用 fill() 常导致 state 仍为空，点击「登录」不会发出有效请求。
 * pressSequentially 会触发 onChange，与水合时机无关。
 */
export async function submitLoginWithCredentials(
  page: Page,
  email: string,
  password: string
) {
  await gotoWithRetry(page, "/login")
  const emailInput = page.getByLabel("邮箱")
  const passwordInput = page.getByLabel("密码")
  await emailInput.waitFor({ state: "visible" })
  await passwordInput.waitFor({ state: "visible" })
  await emailInput.click()
  await emailInput.clear()
  await emailInput.pressSequentially(email, { delay: 5 })
  await passwordInput.click()
  await passwordInput.clear()
  await passwordInput.pressSequentially(password, { delay: 5 })
  await page.getByRole("button", { name: "登录" }).click()
  await page.waitForURL(/\/budget(?:\?.*)?$/, { timeout: 30_000 })
}
