"use client"

import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/lib/i18n"

interface BlockTabProps {
  blockDomains: string
  setBlockDomains: (v: string) => void
  blockIps: string
  setBlockIps: (v: string) => void
  enableBlockAds: boolean
  setEnableBlockAds: (v: boolean) => void
}

export function BlockTab({
  blockDomains,
  setBlockDomains,
  blockIps,
  setBlockIps,
  enableBlockAds,
  setEnableBlockAds,
}: BlockTabProps) {
  const { t } = useTranslation("routing")

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">{t("blockDesc")}</p>
      <div className="space-y-2">
        <Label>{t("domainListLabel")}</Label>
        <Textarea
          placeholder={t("blockDomainsPlaceholder")}
          value={blockDomains}
          onChange={(e) => setBlockDomains(e.target.value)}
          className="font-mono text-xs min-h-[150px]"
        />
        <p className="text-xs text-muted-foreground">{t("domainSuffixMethod")}</p>
      </div>
      <div className="space-y-2">
        <Label>{t("ipListLabel")}</Label>
        <Textarea
          placeholder={t("blockIpsPlaceholder")}
          value={blockIps}
          onChange={(e) => setBlockIps(e.target.value)}
          className="font-mono text-xs min-h-[120px]"
        />
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="pw_blockAds"
          checked={enableBlockAds}
          onChange={() => setEnableBlockAds(!enableBlockAds)}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="pw_blockAds" className="text-sm font-normal cursor-pointer">
          {t("blockAdsLabel")}
        </Label>
      </div>
    </div>
  )
}
