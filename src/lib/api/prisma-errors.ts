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
      default:
        return fail(
          "DATABASE_ERROR",
          "数据库操作失败",
          400,
          process.env.NODE_ENV === "development" ? { code: e.code, meta: e.meta } : undefined
        )
    }
  }

  if (e instanceof Prisma.PrismaClientValidationError) {
    return fail("VALIDATION_ERROR", "数据校验失败", 400)
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
