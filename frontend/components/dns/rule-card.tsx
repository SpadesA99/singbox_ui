"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { DnsRule } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"

interface RuleCardProps {
  rule: DnsRule
  index: number
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (field: keyof DnsRule, value: any) => void
  onUpdateArray: (field: "domain" | "domain_suffix" | "rule_set" | "query_type", value: string) => void
  onRemove: () => void
  availableServerTags: string[]
}

export function RuleCard({
  rule,
  index,
  expanded,
  onToggleExpand,
  onUpdate,
  onUpdateArray,
  onRemove,
  availableServerTags,
}: RuleCardProps) {
  const { t } = useTranslation("dns")

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[90px]"
          value={rule.action || "route"}
          onChange={(e) => onUpdate("action", e.target.value)}
        >
          <option value="route">route</option>
          <option value="reject">reject</option>
        </select>
        {(rule.action === "route" || !rule.action) && (
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[120px]"
            value={rule.server || ""}
            onChange={(e) => onUpdate("server", e.target.value)}
          >
            <option value="">{t("selectServer")}</option>
            {availableServerTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        )}
        <Input
          placeholder={t("ruleSetPlaceholder")}
          value={rule.rule_set?.join(", ") || ""}
          onChange={(e) => onUpdateArray("rule_set", e.target.value)}
          className="h-8 text-sm flex-1"
        />
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Advanced options */}
      <div className="border-t pt-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 text-xs w-full justify-between px-1"
          onClick={onToggleExpand}
        >
          <span>{t("advancedOptions")}</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {expanded && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("domainCommaSeparated")}</Label>
              <Input
                placeholder="google.com, github.com"
                value={rule.domain?.join(", ") || ""}
                onChange={(e) => onUpdateArray("domain", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("domainSuffix")}</Label>
              <Input
                placeholder=".cn, .com.cn"
                value={rule.domain_suffix?.join(", ") || ""}
                onChange={(e) => onUpdateArray("domain_suffix", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">{t("clashMode")}</Label>
              <select
                className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={rule.clash_mode || ""}
                onChange={(e) => onUpdate("clash_mode", e.target.value || undefined)}
              >
                <option value="">{t("noLimit")}</option>
                <option value="Direct">Direct</option>
                <option value="Global">Global</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
