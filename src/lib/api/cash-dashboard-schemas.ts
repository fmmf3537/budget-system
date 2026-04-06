import { z } from "zod"

export const cashDashboardQuerySchema = z.object({
  /** 概览所属年，默认当前 UTC 年 */
  periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
  /** 概览所属月 1-12，默认当前 UTC 月 */
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  /** 未来趋势月数（从概览月的下一月起算） */
  trendMonths: z.coerce.number().int().min(2).max(24).default(6),
  /** 估算期末余额时的期初基数（与本期净流入相加） */
  baseBalance: z
    .union([z.coerce.number(), z.string()])
    .optional()
    .transform((v) => (v === undefined ? undefined : String(v))),
  /** 大额收支金额下限 */
  largeAmountMin: z.coerce.number().min(0).default(50_000),
  /** 大额列表条数上限 */
  largeListLimit: z.coerce.number().int().min(5).max(50).default(20),
  /** 预警列表条数 */
  warningsLimit: z.coerce.number().int().min(5).max(100).default(30),
})
