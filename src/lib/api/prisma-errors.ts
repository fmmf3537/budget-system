import { Prisma } from "@/generated/prisma/client"
import { fail } from "@/lib/api/response"
import type { NextResponse } from "next/server"

export function handleRouteError(e: unknown): NextResponse {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    switch (e.code) {
      case "P2002":
        return fail(
          "CONFLICT",
          "数据已存在或违反唯一约束",
          409,
          { field: e.meta?.target }
        )
      case "P2003":
        return fail("BAD_REFERENCE", "关联数据不存在或无法删除", 400)
      case "P2025":
        return fail("NOT_FOUND", "记录不存在", 404)
      case "P2022":
        return fail(
          "DATABASE_SCHEMA",
          "数据库表结构与当前应用不一致（例如缺少新列）。请在部署环境执行 npx prisma migrate deploy，本地可执行 npx prisma migrate dev；然后重新运行 npx prisma generate。",
          503,
          process.env.NODE_ENV === "development"
            ? { code: e.code, meta: e.meta }
            : undefined
        )
      default:
        return fail(
          "DATABASE_ERROR",
          "数据库操作失败。若刚更新过代码，请确认已执行 npx prisma migrate deploy 且数据库可连接。",
          400,
          process.env.NODE_ENV === "development" ? { code: e.code, meta: e.meta } : undefined
        )
    }
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    const raw = e.message
    // 部分环境/版本下，库表缺列等问题也可能以 ValidationError 形式抛出
    const looksLikeSchemaMismatch =
      /does not exist in the current database/i.test(raw) ||
      (raw.includes("Unknown field") &&
        raw.includes("for select statement on model")) ||
      raw.includes("Unknown arg ")
    if (looksLikeSchemaMismatch) {
      return fail(
        "DATABASE_SCHEMA",
        "数据库表结构与当前应用不一致（例如缺少新列）。请在部署环境执行 npx prisma migrate deploy，本地可执行 npx prisma migrate dev；然后重新运行 npx prisma generate。",
        503,
        process.env.NODE_ENV === "development"
          ? { prismaMessage: raw }
          : undefined
      )
    }
    return fail(
      "VALIDATION_ERROR",
      process.env.NODE_ENV === "development"
        ? `数据校验失败：${raw.slice(0, 500)}`
        : "数据校验失败",
      400,
      process.env.NODE_ENV === "development" ? { prismaMessage: raw } : undefined
    )
  }

  console.error("[api] unhandled error", e)
  return fail(
    "INTERNAL_ERROR",
    "服务器内部错误，请稍后重试",
    500,
    process.env.NODE_ENV === "development" && e instanceof Error
      ? { message: e.message }
      : undefined
  )
}
