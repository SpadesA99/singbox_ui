"use client"

import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"

interface GlobalSettingsProps {
  finalServer: string
  setFinalServer: (v: string) => void
  independentCache: boolean
  setIndependentCache: (v: boolean) => void
  availableServerTags: string[]
}

export function GlobalSettings({
  finalServer,
  setFinalServer,
  independentCache,
  setIndependentCache,
  availableServerTags,
}: GlobalSettingsProps) {
  const { t } = useTranslation("dns")

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">{t("defaultDnsServer")}</Label>
          <select
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={finalServer}
            onChange={(e) => setFinalServer(e.target.value)}
          >
            <option value="">{t("selectDefaultServer")}</option>
            {availableServerTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="independent_cache"
            checked={independentCache}
            onChange={(e) => setIndependentCache(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="independent_cache" className="text-xs">
            {t("independentCache")}
          </Label>
        </div>
      </div>
    </div>
  )
}
