import { NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/api/request-auth"
import { fail } from "@/lib/api/response"
import { createObjectDownloadUrl } from "@/lib/storage/object-storage"

export async function GET(request: Request) {
  const authOr = await requireAuth(request)
  if (authOr instanceof Response) return authOr
  const auth = authOr

  const reqUrl = new URL(request.url)
  const attachmentUrl = reqUrl.searchParams.get("url")?.trim() || ""
  if (!attachmentUrl) {
    return fail("VALIDATION_ERROR", "缺少附件地址参数", 400)
  }

  const [mainIncome, mainExpense, subIncome, subExpense] = await Promise.all([
    prisma.cashPlanIncome.findFirst({
      where: { attachmentUrl, header: { organizationId: auth.organizationId } },
      select: { id: true },
    }),
    prisma.cashPlanExpense.findFirst({
      where: { attachmentUrl, header: { organizationId: auth.organizationId } },
      select: { id: true },
    }),
    prisma.cashPlanSubPlanIncome.findFirst({
      where: { attachmentUrl, subPlan: { organizationId: auth.organizationId } },
      select: { id: true },
    }),
    prisma.cashPlanSubPlanExpense.findFirst({
      where: { attachmentUrl, subPlan: { organizationId: auth.organizationId } },
      select: { id: true },
    }),
  ])

  if (!mainIncome && !mainExpense && !subIncome && !subExpense) {
    return fail("NOT_FOUND", "附件不存在或无权访问", 404)
  }

  try {
    const signedUrl = await createObjectDownloadUrl({ attachmentUrl })
    return NextResponse.redirect(signedUrl, 302)
  } catch (e) {
    return fail(
      "INTERNAL_ERROR",
      e instanceof Error ? e.message : "附件签名失败",
      500
    )
  }
}
