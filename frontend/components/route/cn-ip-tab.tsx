"use client"

import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"

interface CnIpTabProps {
  enableCnIp: boolean
  setEnableCnIp: (v: boolean) => void
}

export function CnIpTab({ enableCnIp, setEnableCnIp }: CnIpTabProps) {
  const { t } = useTranslation("routing")

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="pw_cnIp"
          checked={enableCnIp}
          onChange={() => setEnableCnIp(!enableCnIp)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="pw_cnIp" className="text-sm font-normal cursor-pointer">
          {t("enableCnIp")}
        </Label>
      </div>
      <p className="text-sm text-muted-foreground">{t("cnIpDesc")}</p>
      <p className="text-xs text-muted-foreground">{t("cnIpSource")}</p>
    </div>
  )
}
