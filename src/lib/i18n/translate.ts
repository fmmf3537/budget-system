import type { AppLocale } from "./types"
import { messages as enUS } from "./messages/en-US"
import { messages as zhCN } from "./messages/zh-CN"

const byLocale = {
  "zh-CN": zhCN,
  "en-US": enUS,
} as const

export function getMessages(locale: AppLocale) {
  return byLocale[locale]
}

type Leaf = string | number | boolean | null | undefined
type Tree = { [k: string]: Tree | Leaf }

function getPath(obj: Tree, path: string): string {
  const parts = path.split(".").filter(Boolean)
  let cur: unknown = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return path
    cur = (cur as Record<string, unknown>)[p]
  }
  if (typeof cur === "string") return cur
  if (typeof cur === "number" || typeof cur === "boolean") return String(cur)
  return path
}

export function createTranslator(locale: AppLocale) {
  const messages = getMessages(locale) as unknown as Tree
  return function t(path: string) {
    return getPath(messages, path)
  }
}
