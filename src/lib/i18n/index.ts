/**
 * 国际化入口（预留扩展）。
 * - 客户端：I18nProvider + useI18n()
 * - 服务端：可用 createTranslator(locale) + getMessages(locale) 做 generateMetadata 等
 */
export { createTranslator, getMessages } from "./translate"
export {
  APP_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  type AppLocale,
  isAppLocale,
} from "./types"
