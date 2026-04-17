import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

type ObjectStorageConfig = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicBaseUrl: string | null
}

const DOWNLOAD_SIGNED_URL_TTL_SECONDS = 5 * 60

function normalizePublicBaseUrl(
  publicBaseUrl: string | null,
  bucket: string
): string | null {
  if (!publicBaseUrl) return null
  try {
    const u = new URL(publicBaseUrl)
    const cleaned = u.pathname.replace(/\/+$/, "")
    const bucketSuffix = `/${bucket}`
    if (!cleaned || cleaned === "/") {
      u.pathname = bucketSuffix
      return u.toString().replace(/\/+$/, "")
    }
    if (!cleaned.endsWith(bucketSuffix)) {
      u.pathname = `${cleaned}${bucketSuffix}`
      return u.toString().replace(/\/+$/, "")
    }
    return u.toString().replace(/\/+$/, "")
  } catch {
    return publicBaseUrl
  }
}

function readConfig(): ObjectStorageConfig {
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT?.trim() || ""
  const region = process.env.OBJECT_STORAGE_REGION?.trim() || ""
  const bucket = process.env.OBJECT_STORAGE_BUCKET?.trim() || ""
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID?.trim() || ""
  const secretAccessKey =
    process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY?.trim() || ""
  const publicBaseUrl = process.env.OBJECT_STORAGE_PUBLIC_BASE_URL?.trim() || null

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "Object storage is not configured. Please set OBJECT_STORAGE_ENDPOINT/REGION/BUCKET/ACCESS_KEY_ID/SECRET_ACCESS_KEY."
    )
  }
  return {
    endpoint,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: normalizePublicBaseUrl(publicBaseUrl, bucket),
  }
}

function buildClient(cfg: ObjectStorageConfig) {
  return new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
  })
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith("/") ? base.slice(0, -1) : base
  const p = path.startsWith("/") ? path : `/${path}`
  return `${b}${p}`
}

export async function uploadObject(params: {
  key: string
  body: Uint8Array
  contentType: string
}): Promise<{ url: string; bucket: string; key: string }> {
  const cfg = readConfig()
  const client = buildClient(cfg)
  const key = params.key.replace(/^\/+/, "")
  await client.send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: params.body,
      ContentType: params.contentType,
    })
  )

  const url = cfg.publicBaseUrl
    ? joinUrl(cfg.publicBaseUrl, key)
    : joinUrl(cfg.endpoint, `${cfg.bucket}/${key}`)
  return { url, bucket: cfg.bucket, key }
}

function extractObjectKeyFromUrl(attachmentUrl: string, cfg: ObjectStorageConfig) {
  const directPrefix = joinUrl(cfg.endpoint, `${cfg.bucket}/`)
  if (attachmentUrl.startsWith(directPrefix)) {
    return attachmentUrl.slice(directPrefix.length)
  }
  const endpointPrefix = joinUrl(cfg.endpoint, "")
  if (attachmentUrl.startsWith(endpointPrefix)) {
    const remainder = attachmentUrl.slice(endpointPrefix.length)
    if (remainder) return remainder
  }
  if (cfg.publicBaseUrl) {
    const publicPrefix = joinUrl(cfg.publicBaseUrl, "")
    if (attachmentUrl.startsWith(publicPrefix)) {
      return attachmentUrl.slice(publicPrefix.length)
    }
  }
  throw new Error("无法解析附件对象路径，请检查对象存储 URL 配置")
}

export async function createObjectDownloadUrl(params: { attachmentUrl: string }) {
  const cfg = readConfig()
  const key = extractObjectKeyFromUrl(params.attachmentUrl, cfg)
  const client = buildClient(cfg)
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
    }),
    { expiresIn: DOWNLOAD_SIGNED_URL_TTL_SECONDS }
  )
}
