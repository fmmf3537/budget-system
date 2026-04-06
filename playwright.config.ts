import path from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig, devices } from "@playwright/test"

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const htmlDir = process.env.PW_HTML_DIR ?? "playwright-report"
const jsonFile = process.env.PW_JSON_FILE ?? "playwright-results.json"
const junitFile = process.env.PW_JUNIT_FILE ?? "playwright-junit.xml"

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["list"],
    ["html", { outputFolder: htmlDir, open: "never" }],
    ["json", { outputFile: jsonFile }],
    ["junit", { outputFile: junitFile }],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
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
