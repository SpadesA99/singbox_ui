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

// Filter servers that are valid for sing-box (incomplete entries are kept in draft state only)
function filterValidServers(servers: DnsServer[]): DnsServer[] {
  return servers.filter(
    (s) => s.tag && (s.type === "local" || s.type === "fakeip" || s.type === "dhcp" || s.type === "hosts" || s.server)
  )
}

export function DnsConfigComponent({ showCard = true }: DnsConfigProps) {
  const { t } = useTranslation("dns")
  const { config, setDns } = useSingboxConfigStore()
  const dns = config.dns || {}

  // Draft local state: servers and rules may include incomplete entries being edited
  const [servers, setServers] = useState<DnsServer[]>(() => dns.servers || [])
  const [rules, setRules] = useState<DnsRule[]>(() => dns.rules || [])

  // Scalar config values: read/write directly from store (no draft needed)
  const finalServer: string = dns.final || ""
  const independentCache: boolean = dns.independent_cache ?? true

  const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set())
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set())

  const availableServerTags = servers.filter((s) => s.tag).map((s) => s.tag)

  // Write validated config to store (filters incomplete servers, cleans up empty arrays)
  function commitDns(srv: DnsServer[], rls: DnsRule[], final: string, cache: boolean) {
    setDns({
      servers: filterValidServers(srv),
      rules: rls.length > 0 ? rls : undefined,
      final: final || undefined,
      independent_cache: cache,
    })
  }

  const addServer = () => {
    const next = [...servers, { tag: `dns_${servers.length + 1}`, server: "", type: "udp" as const }]
    setServers(next)
    commitDns(next, rules, finalServer, independentCache)
  }

  const removeServer = (index: number) => {
    const next = servers.filter((_, i) => i !== index)
    setServers(next)
    commitDns(next, rules, finalServer, independentCache)
  }

  const updateServer = (index: number, field: keyof DnsServer, value: any) => {
    const next = servers.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    setServers(next)
    commitDns(next, rules, finalServer, independentCache)
  }

  const toggleServerExpanded = (index: number) => {
    const next = new Set(expandedServers)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedServers(next)
  }

  const addRule = () => {
    const next = [...rules, { action: "route" as const, server: availableServerTags[0] || "" }]
    setRules(next)
    commitDns(servers, next, finalServer, independentCache)
  }

  const removeRule = (index: number) => {
    const next = rules.filter((_, i) => i !== index)
    setRules(next)
    commitDns(servers, next, finalServer, independentCache)
  }

  const updateRule = (index: number, field: keyof DnsRule, value: any) => {
    const next = rules.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    setRules(next)
    commitDns(servers, next, finalServer, independentCache)
  }

  const updateRuleArray = (
    index: number,
    field: "domain" | "domain_suffix" | "rule_set" | "query_type",
    value: string
  ) => {
    const next = rules.map((r, i) => {
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
    setRules(next)
    commitDns(servers, next, finalServer, independentCache)
  }

  const toggleRuleExpanded = (index: number) => {
    const next = new Set(expandedRules)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedRules(next)
  }

  const handleApplyTemplate = (templateServers: DnsServer[], templateRules: DnsRule[], templateFinal: string) => {
    setServers(templateServers)
    setRules(templateRules)
    commitDns(templateServers, templateRules, templateFinal, independentCache)
  }

  const setFinalServer = (val: string) => commitDns(servers, rules, val, independentCache)
  const setIndependentCache = (val: boolean) => commitDns(servers, rules, finalServer, val)

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
