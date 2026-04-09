import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const htmlDir = process.env.PW_HTML_DIR ?? "playwright-report"
const jsonFile = process.env.PW_JSON_FILE ?? "playwright-results.json"
const junitFile = process.env.PW_JUNIT_FILE ?? "playwright-junit.xml"

/** 本地默认 1：单 next dev 时多 worker 易触发导航中断、对话框竞态。可通过 PW_WORKERS=4 加速。 */
function playwrightWorkers(): number {
  if (process.env.CI) return 1
  const n = Number.parseInt(process.env.PW_WORKERS ?? "1", 10)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: playwrightWorkers(),
  reporter: [
    ["list"],
    ["html", { outputFolder: htmlDir, open: "never" }],
    ["json", { outputFile: jsonFile }],
    ["junit", { outputFile: junitFile }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    navigationTimeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    cwd: projectRoot,
  },
})
