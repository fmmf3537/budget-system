"use client"

import { LanguagesIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/contexts/i18n-context"
import { APP_LOCALES, type AppLocale } from "@/lib/i18n/types"

const LOCALE_META: Record<AppLocale, { labelKey: string }> = {
  "zh-CN": { labelKey: "locale.zhCN" },
  "en-US": { labelKey: "locale.enUS" },
}

/** 预留：语言切换；文案走 i18n messages */
export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("locale.switchAria")}
        >
          <LanguagesIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{t("locale.label")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(v) => setLocale(v as AppLocale)}
        >
          {APP_LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {t(LOCALE_META[code].labelKey)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
