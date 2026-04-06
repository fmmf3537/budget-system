#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDir, "..")

function fsSafeIsoTimestamp() {
  return new Date().toISOString().replace(/:/g, "-").replace(/\.\d{3}Z$/, "Z")
}

function readGitSha(cwd) {
  const r = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32",
  })
  if (r.error || r.status !== 0) return null
  return r.stdout.trim() || null
}

const runId = `run-${fsSafeIsoTimestamp()}`
const runDir = path.join(projectRoot, "test-runs", runId)
mkdirSync(runDir, { recursive: true })

const pkgPath = path.join(projectRoot, "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))

const manifest = {
  startedAt: new Date().toISOString(),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
  node: process.version,
  vitest: pkg.devDependencies?.vitest ?? null,
  playwright: pkg.devDependencies?.["@playwright/test"] ?? null,
  gitSha: readGitSha(projectRoot),
  runDir: path.relative(projectRoot, runDir),
}

writeFileSync(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8")

const vitestCli = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs")
const vitestJson = path.join(runDir, "vitest-results.json")

const vitestArgs = [
  vitestCli,
  "run",
  "--reporter=default",
  "--reporter=json",
  `--outputFile.json=${vitestJson}`,
]

const vitestResult = spawnSync(process.execPath, vitestArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: { ...process.env, VITEST_JSON_OUTPUT: vitestJson },
})

const vitestOk = vitestResult.status === 0

const pwHtml = path.join(runDir, "playwright-report")
const pwJson = path.join(runDir, "playwright-results.json")
const pwJunit = path.join(runDir, "junit.xml")

const pwCli = path.join(projectRoot, "node_modules", "@playwright", "test", "cli.js")
const pwArgs = [pwCli, "test"]

const pwResult = spawnSync(process.execPath, pwArgs, {
  cwd: projectRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    PW_HTML_DIR: pwHtml,
    PW_JSON_FILE: pwJson,
    PW_JUNIT_FILE: pwJunit,
  },
})

const pwOk = pwResult.status === 0

const summary = {
  finishedAt: new Date().toISOString(),
  vitest: { exitCode: vitestResult.status ?? 1, ok: vitestOk },
  playwright: { exitCode: pwResult.status ?? 1, ok: pwOk },
}
writeFileSync(path.join(runDir, "summary.json"), JSON.stringify(summary, null, 2), "utf8")

process.exit(vitestOk && pwOk ? 0 : 1)
