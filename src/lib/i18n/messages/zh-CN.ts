/**
 * 中文文案（默认）。业务页可逐步改为 t('xxx')，此处先放通用与布局相关。
 */
export const messages = {
  app: {
    shortTitle: "预算系统",
    title: "预算系统",
    description: "预算编制、审批、调整与资金计划",
  },
  theme: {
    label: "主题",
    light: "浅色",
    dark: "深色",
    system: "跟随系统",
    toggleAria: "切换主题",
  },
  locale: {
    label: "语言",
    zhCN: "简体中文",
    enUS: "English",
    switchAria: "切换语言",
  },
  loading: {
    page: "页面加载中…",
    hint: "正在获取内容，请稍候",
  },
  error: {
    title: "页面出错了",
    description: "发生意外错误，请重试或返回首页。",
    retry: "重试",
    home: "返回首页",
    detail: "错误详情（开发）",
  },
  globalError: {
    title: "应用加载失败",
    description: "根布局出现异常，请刷新页面。",
    reload: "刷新页面",
  },
}

export type MessageTree = typeof messages
