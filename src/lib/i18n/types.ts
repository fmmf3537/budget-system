/** 预留：新增语言时在此扩展并补充 messages 文件 */
export const APP_LOCALES = ["zh-CN", "en-US"] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export const DEFAULT_LOCALE: AppLocale = "zh-CN"

export const LOCALE_STORAGE_KEY = "budget-system-locale"

export function isAppLocale(v: string): v is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(v)
}
