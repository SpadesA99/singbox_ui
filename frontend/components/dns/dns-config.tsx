"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Plus, Globe } from "lucide-react"
import { useSingboxConfigStore, DnsServer, DnsRule, DnsConfig } from "@/lib/store/singbox-config"
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
  const initialConfig = config.dns

  const [servers, setServers] = useState<DnsServer[]>([])
  const [rules, setRules] = useState<DnsRule[]>([])
  const [finalServer, setFinalServer] = useState("")
  const [independentCache, setIndependentCache] = useState(true)
  const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set())
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set())

  const isInitializedRef = useRef(false)

  // Initialize from initialConfig (first load only)
  useEffect(() => {
    if (isInitializedRef.current) return

    if (initialConfig) {
      if (initialConfig.servers) setServers(initialConfig.servers)
      if (initialConfig.rules) setRules(initialConfig.rules)
      if (initialConfig.final) setFinalServer(initialConfig.final)
      if (initialConfig.independent_cache !== undefined) setIndependentCache(initialConfig.independent_cache)
    }
    isInitializedRef.current = true
  }, [initialConfig])

  // Sync to store on every state change
  useEffect(() => {
    if (!isInitializedRef.current) return

    const dnsConfig: DnsConfig = {
      servers: servers.filter(
        (s) =>
          s.tag &&
          (s.type === "local" || s.type === "fakeip" || s.type === "dhcp" || s.type === "hosts" || s.server)
      ),
      rules: rules.length > 0 ? rules : undefined,
      final: finalServer || undefined,
      independent_cache: independentCache,
    }

    setDns(dnsConfig)
  }, [servers, rules, finalServer, independentCache, setDns])

  const availableServerTags = servers.filter((s) => s.tag).map((s) => s.tag)

  const addServer = () => {
    setServers([...servers, { tag: `dns_${servers.length + 1}`, server: "", type: "udp" }])
  }

  const removeServer = (index: number) => {
    setServers(servers.filter((_, i) => i !== index))
  }

  const updateServer = (index: number, field: keyof DnsServer, value: any) => {
    const updated = [...servers]
    updated[index] = { ...updated[index], [field]: value }
    setServers(updated)
  }

  const toggleServerExpanded = (index: number) => {
    const next = new Set(expandedServers)
    if (next.has(index)) next.delete(index)
    else next.add(index)
    setExpandedServers(next)
  }

  const addRule = () => {
    setRules([...rules, { action: "route", server: availableServerTags[0] || "" }])
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const updateRule = (index: number, field: keyof DnsRule, value: any) => {
    const updated = [...rules]
    updated[index] = { ...updated[index], [field]: value }
    setRules(updated)
  }

  const updateRuleArray = (
    index: number,
    field: "domain" | "domain_suffix" | "rule_set" | "query_type",
    value: string
  ) => {
    const updated = [...rules]
    if (field === "query_type") {
      const nums = value
        .split(",")
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !isNaN(v))
      updated[index] = { ...updated[index], [field]: nums.length > 0 ? nums : undefined }
    } else {
      const arr = value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v)
      updated[index] = { ...updated[index], [field]: arr.length > 0 ? arr : undefined }
    }
    setRules(updated)
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
    setFinalServer(templateFinal)
  }

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
