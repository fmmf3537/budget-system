import { prisma } from "@/lib/prisma"

/** UTC calendar months touched by [start, end] inclusive, as YYYY-MM. */
export function utcYearMonthsBetweenInclusive(
  periodStart: Date,
  periodEnd: Date
): Set<string> {
  const keys = new Set<string>()
  let y = periodStart.getUTCFullYear()
  let m = periodStart.getUTCMonth()
  const endY = periodEnd.getUTCFullYear()
  const endM = periodEnd.getUTCMonth()
  for (;;) {
    keys.add(`${y}-${String(m + 1).padStart(2, "0")}`)
    if (y === endY && m === endM) break
    m++
    if (m > 11) {
      m = 0
      y++
    }
  }
  return keys
}

function monthSetsOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const k of a) {
    if (b.has(k)) return true
  }
  return false
}

/**
 * One master cash plan per top-level department per calendar month (UTC):
 * same organization + same rootDepartmentCode must not have overlapping months in period range.
 * Skips when rootDepartmentCode is null (legacy whole-org header).
 */
export async function findConflictingCashPlanHeaderForDepartmentMonths(params: {
  organizationId: string
  rootDepartmentCode: string | null
  periodStart: Date
  periodEnd: Date
  excludeHeaderId?: string
}): Promise<{ id: string } | null> {
  const {
    organizationId,
    rootDepartmentCode,
    periodStart,
    periodEnd,
    excludeHeaderId,
  } = params
  if (!rootDepartmentCode) return null

  const newMonths = utcYearMonthsBetweenInclusive(periodStart, periodEnd)
  const candidates = await prisma.cashPlanHeader.findMany({
    where: {
      organizationId,
      rootDepartmentCode,
      ...(excludeHeaderId ? { id: { not: excludeHeaderId } } : {}),
    },
    select: { id: true, periodStart: true, periodEnd: true },
  })

  for (const h of candidates) {
    const existingMonths = utcYearMonthsBetweenInclusive(
      h.periodStart,
      h.periodEnd
    )
    if (monthSetsOverlap(newMonths, existingMonths)) {
      return { id: h.id }
    }
  }
  return null
}
