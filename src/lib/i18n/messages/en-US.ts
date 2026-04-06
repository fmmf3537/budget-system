import type { MessageTree } from "./zh-CN"

/** 英文占位文案，结构与 zh-CN 一致，便于后续补全 */
export const messages: MessageTree = {
  app: {
    shortTitle: "Budget",
    title: "Budget System",
    description: "Budgeting, approval, adjustments & cash plan",
  },
  theme: {
    label: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
    toggleAria: "Toggle theme",
  },
  locale: {
    label: "Language",
    zhCN: "简体中文",
    enUS: "English",
    switchAria: "Switch language",
  },
  loading: {
    page: "Loading…",
    hint: "Fetching content, please wait",
  },
  error: {
    title: "Something went wrong",
    description: "An unexpected error occurred. Try again or go home.",
    retry: "Try again",
    home: "Home",
    detail: "Error detail (dev)",
  },
  globalError: {
    title: "Application error",
    description: "The root layout failed. Please reload.",
    reload: "Reload",
  },
}
