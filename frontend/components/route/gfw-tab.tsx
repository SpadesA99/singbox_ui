"use client"

import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"

interface GfwTabProps {
  enableGfw: boolean
  setEnableGfw: (v: boolean) => void
}

export function GfwTab({ enableGfw, setEnableGfw }: GfwTabProps) {
  const { t } = useTranslation("routing")

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="pw_gfw"
          checked={enableGfw}
          onChange={() => setEnableGfw(!enableGfw)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="pw_gfw" className="text-sm font-normal cursor-pointer">
          {t("enableGfw")}
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">{t("gfwDesc")}</p>
      <p className="text-xs text-muted-foreground">{t("gfwSource")}</p>
    </div>
  )
}
