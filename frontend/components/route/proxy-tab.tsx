"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/lib/i18n"

interface ProxyTabProps {
  proxyDomains: string
  setProxyDomains: (v: string) => void
  proxyIps: string
  setProxyIps: (v: string) => void
}

export function ProxyTab({ proxyDomains, setProxyDomains, proxyIps, setProxyIps }: ProxyTabProps) {
  const { t } = useTranslation("routing")

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("proxyDesc")}</p>
      <div className="space-y-2">
        <Label>{t("domainListLabel")}</Label>
        <Textarea
          placeholder={t("proxyDomainsPlaceholder")}
          value={proxyDomains}
          onChange={(e) => setProxyDomains(e.target.value)}
          className="font-mono text-xs min-h-[150px]"
        />
        <p className="text-xs text-muted-foreground">
          {t("domainSuffixHint", { example: "google.com" })}
        </p>
      </div>
      <div className="space-y-2">
        <Label>{t("ipListLabel")}</Label>
        <Textarea
          placeholder={t("proxyIpsPlaceholder")}
          value={proxyIps}
          onChange={(e) => setProxyIps(e.target.value)}
          className="font-mono text-xs min-h-[120px]"
        />
      </div>
    </div>
  )
}
