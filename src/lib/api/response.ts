import { NextResponse } from "next/server"
import type { ZodError } from "zod"

export type ApiSuccess<T> = {
  success: true
  data: T
  error: null
}

export type ApiErrorBody = {
  code: string
  message: string
  details?: unknown
}

export type ApiFailure = {
  success: false
  data: null
  error: ApiErrorBody
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(
    { success: true, data, error: null } satisfies ApiSuccess<T>,
    { status: 200, ...init }
  )
}

export function created<T>(data: T) {
  return NextResponse.json(
    { success: true, data, error: null } satisfies ApiSuccess<T>,
    { status: 201 }
  )
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse {
  const error: ApiErrorBody = { code, message }
  if (details !== undefined) error.details = details
  return NextResponse.json(
    { success: false, data: null, error } satisfies ApiFailure,
    { status }
  )
}

export function fromZodError(err: ZodError) {
  return fail(
    "VALIDATION_ERROR",
    "请求参数不符合要求",
    400,
    err.flatten()
  )
}
