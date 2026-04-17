import { CashPlanStatus } from "@/generated/prisma/enums"
import { prisma } from "@/lib/prisma"
import { cashPlanLinePatchSchema } from "@/lib/api/cash-plan-schemas"
import { uploadCashPlanAttachment } from "@/lib/api/cash-plan-attachments"
import {
  findCashPlanHeaderOnly,
  findCashPlanIncomeLine,
} from "@/lib/api/cash-plan-queries"
import { serializeCashPlanIncome } from "@/lib/api/cash-plan-serialize"
import { requireAuth } from "@/lib/api/request-auth"
import { handleRouteError } from "@/lib/api/prisma-errors"
import { fail, fromZodError, ok } from "@/lib/api/response"

type RouteCtx = { params: Promise<{ id: string; lineId: string }> }

export async function PUT(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id: headerId, lineId } = await ctx.params

    const header = await findCashPlanHeaderOnly(headerId, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)
    if (header.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿状态可修改流入明细", 409)
    }

    const existing = await findCashPlanIncomeLine(
      lineId,
      headerId,
      auth.organizationId
    )
    if (!existing) return fail("NOT_FOUND", "明细不存在", 404)

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return fail("INVALID_JSON", "请求体必须是 JSON", 400)
    }

    const parsed = cashPlanLinePatchSchema.safeParse(body)
    if (!parsed.success) return fromZodError(parsed.error)

    const p = parsed.data
    let attachmentPatch:
      | {
          attachmentName: string | null
          attachmentMime: string | null
          attachmentUrl: string | null
          attachmentSize: number | null
        }
      | null = null
    if (p.attachment === null) {
      attachmentPatch = {
        attachmentName: null,
        attachmentMime: null,
        attachmentUrl: null,
        attachmentSize: null,
      }
    } else if (p.attachment !== undefined) {
      if (!p.attachment.dataBase64) {
        return fail("VALIDATION_ERROR", "附件缺少 dataBase64 内容", 400)
      }
      try {
        const uploaded = await uploadCashPlanAttachment({
          organizationId: auth.organizationId,
          docId: headerId,
          lineType: "income",
          attachment: {
            name: p.attachment.name,
            mime: p.attachment.mime ?? null,
            dataBase64: p.attachment.dataBase64,
          },
        })
        attachmentPatch = {
          attachmentName: uploaded.attachmentName,
          attachmentMime: uploaded.attachmentMime,
          attachmentUrl: uploaded.attachmentUrl,
          attachmentSize: uploaded.attachmentSize,
        }
      } catch (e) {
        return fail(
          "VALIDATION_ERROR",
          e instanceof Error ? e.message : "附件上传失败",
          400
        )
      }
    }

    const row = await prisma.cashPlanIncome.update({
      where: { id: lineId },
      data: {
        ...(p.category !== undefined ? { category: p.category } : {}),
        ...(p.amount !== undefined ? { amount: p.amount } : {}),
        ...(p.expectedDate !== undefined
          ? {
              expectedDate: p.expectedDate
                ? new Date(p.expectedDate)
                : null,
            }
          : {}),
        ...(p.remark !== undefined ? { remark: p.remark } : {}),
        ...(attachmentPatch !== null ? attachmentPatch : {}),
      },
    })

    return ok(serializeCashPlanIncome(row))
  } catch (e) {
    return handleRouteError(e)
  }
}

export async function DELETE(request: Request, ctx: RouteCtx) {
  try {
    const authOr = await requireAuth(request)
    if (authOr instanceof Response) return authOr
    const auth = authOr
    const { id: headerId, lineId } = await ctx.params

    const header = await findCashPlanHeaderOnly(headerId, auth.organizationId)
    if (!header) return fail("NOT_FOUND", "资金计划不存在或无权访问", 404)
    if (header.status !== CashPlanStatus.DRAFT) {
      return fail("INVALID_STATE", "仅草稿状态可删除流入明细", 409)
    }

    const existing = await findCashPlanIncomeLine(
      lineId,
      headerId,
      auth.organizationId
    )
    if (!existing) return fail("NOT_FOUND", "明细不存在", 404)

    await prisma.cashPlanIncome.delete({ where: { id: lineId } })
    return ok({ deleted: true })
  } catch (e) {
    return handleRouteError(e)
  }
}
