#!/usr/bin/env node
/**
 * 将 users.passwordHash 更新为与当前环境变量 TEST_USER_PASSWORD 一致。
 * 需已配置 DATABASE_URL（.env）及 TEST_USER_EMAIL / TEST_USER_PASSWORD（环境或 .env.local）。
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import bcrypt from "bcryptjs"
import dotenv from "dotenv"
import pg from "pg"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
dotenv.config({ path: path.join(projectRoot, ".env") })
dotenv.config({ path: path.join(projectRoot, ".env.local"), override: true })

const email = process.env.TEST_USER_EMAIL
const plain = process.env.TEST_USER_PASSWORD
const databaseUrl = process.env.DATABASE_URL

if (!email || !plain || !databaseUrl) {
  console.error(
    "Missing TEST_USER_EMAIL, TEST_USER_PASSWORD, or DATABASE_URL (.env / shell)"
  )
  process.exit(1)
}

const hash = bcrypt.hashSync(plain, 10)
const pool = new pg.Pool({ connectionString: databaseUrl })
try {
  const r = await pool.query(
    'UPDATE "users" SET "passwordHash" = $1 WHERE "email" = $2',
    [hash, email]
  )
  if (r.rowCount === 0) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }
  console.log(`Updated password hash for ${email} (${r.rowCount} row(s)).`)
} finally {
  await pool.end()
}
