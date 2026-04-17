import { randomUUID } from "node:crypto"

import { uploadObject } from "@/lib/storage/object-storage"

export const CASH_PLAN_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

const ALLOWED_MIME_SET = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
])

export type IncomingAttachment = {
  name: string
  mime: string | null
  dataBase64: string
}

export type StoredAttachment = {
  attachmentName: string
  attachmentMime: string | null
  attachmentUrl: string
  attachmentSize: number
}

function stripDataUrlBase64(raw: string): string {
  const s = raw.trim()
  const idx = s.indexOf("base64,")
  return idx >= 0 ? s.slice(idx + "base64,".length) : s
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .slice(0, 200)
}

function assertAttachmentPayload(att: IncomingAttachment): {
  fileName: string
  mime: string
  bytes: Uint8Array
  byteLength: number
} {
  const fileName = sanitizeFileName(att.name)
  if (!fileName) throw new Error("附件文件名不能为空")

  const mime = (att.mime || "").trim().toLowerCase()
  if (!mime || !ALLOWED_MIME_SET.has(mime)) {
    throw new Error("附件类型不支持，仅允许 pdf/jpg/jpeg/png/xlsx/doc/docx")
  }

  const rawBase64 = stripDataUrlBase64(att.dataBase64)
  const bytes = Uint8Array.from(Buffer.from(rawBase64, "base64"))
  if (bytes.length <= 0) throw new Error("附件内容为空")
  if (bytes.length > CASH_PLAN_ATTACHMENT_MAX_BYTES) {
    throw new Error("附件过大，单个文件上限 10MB")
  }
  return { fileName, mime, bytes, byteLength: bytes.length }
}

export async function uploadCashPlanAttachment(params: {
  organizationId: string
  docId: string
  lineType: "income" | "expense" | "sub-income" | "sub-expense"
  attachment: IncomingAttachment
}): Promise<StoredAttachment> {
  const validated = assertAttachmentPayload(params.attachment)
  const key = [
    "org",
    params.organizationId,
    "cash-plan",
    params.docId,
    params.lineType,
    `${Date.now()}_${randomUUID()}_${validated.fileName}`,
  ].join("/")

  const uploaded = await uploadObject({
    key,
    body: validated.bytes,
    contentType: validated.mime,
  })

  return {
    attachmentName: validated.fileName,
    attachmentMime: validated.mime,
    attachmentUrl: uploaded.url,
    attachmentSize: validated.byteLength,
  }
}
