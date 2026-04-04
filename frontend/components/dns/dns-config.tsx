"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus, Globe } from "lucide-react"
import { useSingboxConfigStore, DnsServer, DnsRule } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"
import { ServerCard } from "./server-card"
import { RuleCard } from "./rule-card"
import { Templates } from "./templates"
import { GlobalSettings } from "./global-settings"

interface DnsConfigProps {
  showCard?: boolean
}

export function DnsConfigComponent({ showCard = true }: DnsConfigProps) {
  const { t } = useTranslation("dns")
  const { config, setDns } = useSingboxConfigStore()
  const dns = config.dns || {}
  const servers: DnsServer[] = dns.servers || []
  const rules: DnsRule[] = dns.rules || []
  const finalServer: string = dns.final || ""
  const independentCache: boolean = dns.independent_cache ?? true

  const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set())
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set())

  const availableServerTags = servers.filter((s) => s.tag).map((s) => s.tag)

  const addServer = () => {
    setDns({ ...dns, servers: [...servers, { tag: `dns_${servers.length + 1}`, server: "", type: "udp" as const }] })
  }

  const removeServer = (index: number) => {
    setDns({ ...dns, servers: servers.filter((_, i) => i !== index) })
  }

  const updateServer = (index: number, field: keyof DnsServer, value: any) => {
    const updated = servers.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    setDns({ ...dns, servers: updated })
  }

  const toggleServerExpanded = (index: number) => {
    const next = new Set(expandedServers)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedServers(next)
  }

  const addRule = () => {
    setDns({ ...dns, rules: [...rules, { action: "route" as const, server: availableServerTags[0] || "" }] })
  }

  const removeRule = (index: number) => {
    setDns({ ...dns, rules: rules.filter((_, i) => i !== index) })
  }

  const updateRule = (index: number, field: keyof DnsRule, value: any) => {
    const updated = rules.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    setDns({ ...dns, rules: updated })
  }

  const updateRuleArray = (
    index: number,
    field: "domain" | "domain_suffix" | "rule_set" | "query_type",
    value: string
  ) => {
    const updated = rules.map((r, i) => {
      if (i !== index) return r
      if (field === "query_type") {
        const nums = value
          .split(",")
          .map((v) => parseInt(v.trim(), 10))
          .filter((v) => !isNaN(v))
        return { ...r, [field]: nums.length > 0 ? nums : undefined }
      } else {
        const arr = value
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v)
        return { ...r, [field]: arr.length > 0 ? arr : undefined }
      }
    })
    setDns({ ...dns, rules: updated })
  }

  const toggleRuleExpanded = (index: number) => {
    const next = new Set(expandedRules)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedRules(next)
  }

  const handleApplyTemplate = (templateServers: DnsServer[], templateRules: DnsRule[], templateFinal: string) => {
    setDns({ ...dns, servers: templateServers, rules: templateRules, final: templateFinal })
  }

  const setFinalServer = (val: string) => setDns({ ...dns, final: val || undefined })
  const setIndependentCache = (val: boolean) => setDns({ ...dns, independent_cache: val })

  const content = (
    <div className="space-y-4">
      <Templates onApply={handleApplyTemplate} />

      {/* DNS server list */}
      <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
        <div className="flex items-center justify-between">
          <Label>{t("servers")}</Label>
          <Button type="button" size="sm" variant="outline" onClick={addServer}>
            <Plus className="h-4 w-4 mr-1" />
            {t("addServer")}
          </Button>
        </div>

        {servers.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
            {t("noServersHint")}
          </div>
        )}

        {servers.map((server, index) => (
          <ServerCard
            key={index}
            server={server}
            index={index}
            expanded={expandedServers.has(index)}
            onToggleExpand={() => toggleServerExpanded(index)}
            onUpdate={(field, value) => updateServer(index, field, value)}
            onRemove={() => removeServer(index)}
          />
        ))}
      </div>

      {/* DNS rules */}
      <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
        <div className="flex items-center justify-between">
          <Label>{t("rules")}</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addRule}
            disabled={availableServerTags.length === 0}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("addRule")}
          </Button>
        </div>

        {rules.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            {t("noRulesHint")}
          </div>
        )}

        {rules.map((rule, index) => (
          <RuleCard
            key={index}
            rule={rule}
            index={index}
            expanded={expandedRules.has(index)}
            onToggleExpand={() => toggleRuleExpanded(index)}
            onUpdate={(field, value) => updateRule(index, field, value)}
            onUpdateArray={(field, value) => updateRuleArray(index, field, value)}
            onRemove={() => removeRule(index)}
            availableServerTags={availableServerTags}
          />
        ))}
      </div>

      <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
        <GlobalSettings
          finalServer={finalServer}
          setFinalServer={setFinalServer}
          independentCache={independentCache}
          setIndependentCache={setIndependentCache}
          availableServerTags={availableServerTags}
        />
      </div>
    </div>
  )

  if (!showCard) {
    return content
  }

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-500 text-white shadow-sm">
          <Globe className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("description")}</p>
        </div>
      </div>
      {content}
    </div>
  )
}
