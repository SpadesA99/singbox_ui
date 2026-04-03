"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/lib/i18n"

interface DirectTabProps {
  directDomains: string
  setDirectDomains: (v: string) => void
  directIps: string
  setDirectIps: (v: string) => void
  enablePrivateIpDirect: boolean
  setEnablePrivateIpDirect: (v: boolean) => void
}

export function DirectTab({
  directDomains,
  setDirectDomains,
  directIps,
  setDirectIps,
  enablePrivateIpDirect,
  setEnablePrivateIpDirect,
}: DirectTabProps) {
  const { t } = useTranslation("routing")

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("directDesc")}</p>
      <div className="space-y-2">
        <Label>{t("domainListLabel")}</Label>
        <Textarea
          placeholder={t("directDomainsPlaceholder")}
          value={directDomains}
          onChange={(e) => setDirectDomains(e.target.value)}
          className="font-mono text-xs min-h-[150px]"
        />
        <p className="text-xs text-muted-foreground">
          {t("domainSuffixHint", { example: "baidu.com" })}
        </p>
      </div>
      <div className="space-y-2">
        <Label>{t("ipListLabel")}</Label>
        <Textarea
          placeholder={t("directIpsPlaceholder")}
          value={directIps}
          onChange={(e) => setDirectIps(e.target.value)}
          className="font-mono text-xs min-h-[120px]"
        />
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="pw_privateIpDirect"
          checked={enablePrivateIpDirect}
          onChange={() => setEnablePrivateIpDirect(!enablePrivateIpDirect)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="pw_privateIpDirect" className="text-sm font-normal cursor-pointer">
          {t("privateIpLabel")}
        </Label>
      </div>
    </div>
  )
}
