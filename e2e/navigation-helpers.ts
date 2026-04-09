import type { Page } from "@playwright/test"

const GOTO_TIMEOUT_MS = 60_000
const GOTO_RETRIES = 3

function isRetriableNavigationError(message: string): boolean {
  return (
    message.includes("ERR_ABORTED") ||
    message.includes("net::ERR") ||
    message.includes("Target page, context or browser has been closed") ||
    message.includes("Navigation interrupted")
  )
}

/**
 * 单进程 next dev 被多测试并发访问时，page.goto 偶发 net::ERR_ABORTED。
 * domcontentloaded 比 load 更快结束，减少与后续导航重叠的概率。
 */
export async function gotoWithRetry(
  page: Page,
  path: string,
  options?: { timeout?: number }
): Promise<void> {
  const timeout = options?.timeout ?? GOTO_TIMEOUT_MS
  let lastError: unknown
  for (let attempt = 0; attempt < GOTO_RETRIES; attempt++) {
    try {
      await page.goto(path, {
        waitUntil: "domcontentloaded",
        timeout,
      })
      return
    } catch (e) {
      lastError = e
      const msg = e instanceof Error ? e.message : String(e)
      if (attempt < GOTO_RETRIES - 1 && isRetriableNavigationError(msg)) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)))
        continue
      }
      throw e
    }
  }
  throw lastError
}
