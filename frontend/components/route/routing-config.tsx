"use client"

import { useState, useEffect, useRef } from "react"
import { Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useSingboxConfigStore, RouteRule, DNSOptions } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"
import { parseLines, normalizeIpCidrs } from "./utils"
import { DirectTab } from "./direct-tab"
import { ProxyTab } from "./proxy-tab"
import { BlockTab } from "./block-tab"
import { GfwTab } from "./gfw-tab"
import { CnDomainTab } from "./cn-domain-tab"
import { CnIpTab } from "./cn-ip-tab"

interface RoutingConfigProps {
  showCard?: boolean
  availableOutbounds?: string[]
}

// Stable default to avoid useEffect infinite loops from reference changes
const EMPTY_OUTBOUNDS: string[] = []

export function RoutingConfig({ showCard = true, availableOutbounds = EMPTY_OUTBOUNDS }: RoutingConfigProps) {
  const { config, setRouting, setDns } = useSingboxConfigStore()
  const { t } = useTranslation("routing")
  const initialConfig = config.route
  const savedDnsRef = useRef<DNSOptions | undefined>(undefined)

  const [finalOutbound, setFinalOutbound] = useState("proxy_out")
  const [rules, setRules] = useState<RouteRule[]>([])
  const [defaultDomainResolver, setDefaultDomainResolver] = useState("local_dns")
  const [activeTab, setActiveTab] = useState("direct")
  const [routeMode, setRouteMode] = useState<"rules" | "global_proxy" | "global_direct">("global_proxy")

  // Passwall-style list state
  const [directDomains, setDirectDomains] = useState("")
  const [directIps, setDirectIps] = useState("")
  const [proxyDomains, setProxyDomains] = useState("")
  const [proxyIps, setProxyIps] = useState("")
  const [blockDomains, setBlockDomains] = useState("")
  const [blockIps, setBlockIps] = useState("")

  // Preset rule set toggles
  const [enableGfw, setEnableGfw] = useState(false)
  const [enableCnDomain, setEnableCnDomain] = useState(false)
  const [enableCnIp, setEnableCnIp] = useState(false)
  const [enableBlockAds, setEnableBlockAds] = useState(false)
  const [enablePrivateIpDirect, setEnablePrivateIpDirect] = useState(false)

  const isInitializedRef = useRef(false)

  // Initialize from initialConfig (first load only)
  useEffect(() => {
    if (isInitializedRef.current) return

    if (initialConfig) {
      if (initialConfig.final) {
        setFinalOutbound(initialConfig.final)
      }
      if (initialConfig.default_domain_resolver) {
        const resolver = initialConfig.default_domain_resolver
        setDefaultDomainResolver(typeof resolver === "string" ? resolver : resolver.server || "")
      }

      // Reverse-parse existing rules into Passwall lists
      const manualRules: RouteRule[] = []
      const dDomains: string[] = []
      const dIps: string[] = []
      const pDomains: string[] = []
      const pIps: string[] = []
      const bDomains: string[] = []
      const bIps: string[] = []

      for (const rule of initialConfig.rules || []) {
        let classified = false

        // Detect preset rule_set rules
        if (rule.rule_set?.length === 1) {
          const rs = rule.rule_set[0]
          if (rs === "geosite-category-ads-all" && rule.outbound === "block") {
            setEnableBlockAds(true); classified = true
          } else if (rs === "geosite-cn" && rule.outbound === "direct") {
            setEnableCnDomain(true); classified = true
          } else if (rs === "geoip-cn" && rule.outbound === "direct") {
            setEnableCnIp(true); classified = true
          } else if (rs === "geosite-gfw") {
            setEnableGfw(true); classified = true
          }
        }

        // Detect ip_is_private direct rule
        if (!classified && rule.ip_is_private && rule.outbound === "direct") {
          setEnablePrivateIpDirect(true); classified = true
        }

        // Detect simple domain/IP rules
        if (!classified) {
          const hasDomains = (rule.domain_suffix?.length || 0) > 0 || (rule.domain?.length || 0) > 0
          const hasIps = (rule.ip_cidr?.length || 0) > 0
          const isSimple = !rule.port && !rule.protocol && !rule.inbound &&
            !rule.network && !rule.clash_mode && !rule.rule_set

          if (isSimple && (hasDomains || hasIps) && rule.action === "route") {
            const targetDomains = [...(rule.domain_suffix || []), ...(rule.domain || [])]
            const targetIps = rule.ip_cidr || []

            if (rule.outbound === "direct") {
              dDomains.push(...targetDomains)
              dIps.push(...targetIps)
              classified = true
            } else if (rule.outbound === "block") {
              bDomains.push(...targetDomains)
              bIps.push(...targetIps)
              classified = true
            } else if (rule.outbound && rule.outbound !== "direct" && rule.outbound !== "block") {
              pDomains.push(...targetDomains)
              pIps.push(...targetIps)
              classified = true
            }
          }
        }

        if (!classified) {
          manualRules.push(rule)
        }
      }

      setDirectDomains(dDomains.join("\n"))
      setDirectIps(dIps.join("\n"))
      setProxyDomains(pDomains.join("\n"))
      setProxyIps(pIps.join("\n"))
      setBlockDomains(bDomains.join("\n"))
      setBlockIps(bIps.join("\n"))
      setRules(manualRules)
    }

    isInitializedRef.current = true
  }, [initialConfig])

  // Sync to global store on every state change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // config.dns is intentionally omitted to avoid re-initialization loops;
  // we only want to capture the initial value once.
  useEffect(() => {
    if (!isInitializedRef.current) return

    const proxyTag = availableOutbounds.includes("proxy_out")
      ? "proxy_out"
      : (availableOutbounds.find((t) => t !== "direct" && t !== "block") || "proxy_out")

    // Global mode: skip all split rules
    if (routeMode === "global_proxy" || routeMode === "global_direct") {
      if (!savedDnsRef.current && config.dns) {
        savedDnsRef.current = config.dns
      }

      let globalDns: DNSOptions
      let dnsTag: string

      if (routeMode === "global_proxy") {
        dnsTag = "cloudflare_doh"
        globalDns = {
          servers: [
            {
              tag: dnsTag,
              type: "https",
              server: "cloudflare-dns.com",
              path: "/dns-query",
              detour: proxyTag,
            },
            {
              tag: "local_resolver",
              type: "udp",
              server: "8.8.8.8",
            },
          ],
          final: dnsTag,
          independent_cache: true,
        }
      } else {
        dnsTag = "alidns"
        globalDns = {
          servers: [
            {
              tag: dnsTag,
              type: "udp",
              server: "223.5.5.5",
            },
          ],
          final: dnsTag,
          independent_cache: true,
        }
      }

      setDns(globalDns)

      const finalTag = routeMode === "global_proxy" ? proxyTag : "direct"
      const routingConfig: any = { rules: [], final: finalTag }
      routingConfig.default_domain_resolver = routeMode === "global_proxy" ? "local_resolver" : dnsTag
      setRouting(routingConfig)
      return
    }

    // Rule split mode: restore saved DNS
    if (savedDnsRef.current) {
      setDns(savedDnsRef.current)
      savedDnsRef.current = undefined
    }

    const generatedRules: RouteRule[] = []

    // Priority 1: block rules
    if (enableBlockAds) {
      generatedRules.push({ action: "route", outbound: "block", rule_set: ["geosite-category-ads-all"] })
    }
    const blockDomainList = parseLines(blockDomains)
    const blockIpList = parseLines(blockIps)
    if (blockDomainList.length > 0) {
      generatedRules.push({ action: "route", outbound: "block", domain_suffix: blockDomainList })
    }
    if (blockIpList.length > 0) {
      generatedRules.push({ action: "route", outbound: "block", ip_cidr: normalizeIpCidrs(blockIpList) })
    }

    // Priority 2: direct rules
    if (enablePrivateIpDirect) {
      generatedRules.push({ action: "route", outbound: "direct", ip_is_private: true })
    }
    const directDomainList = parseLines(directDomains)
    const directIpList = parseLines(directIps)
    if (directDomainList.length > 0) {
      generatedRules.push({ action: "route", outbound: "direct", domain_suffix: directDomainList })
    }
    if (directIpList.length > 0) {
      generatedRules.push({ action: "route", outbound: "direct", ip_cidr: normalizeIpCidrs(directIpList) })
    }
    if (enableCnDomain) {
      generatedRules.push({ action: "route", outbound: "direct", rule_set: ["geosite-cn"] })
    }
    if (enableCnIp) {
      generatedRules.push({ action: "route", outbound: "direct", rule_set: ["geoip-cn"] })
    }

    // Priority 3: proxy rules
    const proxyDomainList = parseLines(proxyDomains)
    const proxyIpList = parseLines(proxyIps)
    if (proxyDomainList.length > 0) {
      generatedRules.push({ action: "route", outbound: proxyTag, domain_suffix: proxyDomainList })
    }
    if (proxyIpList.length > 0) {
      generatedRules.push({ action: "route", outbound: proxyTag, ip_cidr: normalizeIpCidrs(proxyIpList) })
    }
    if (enableGfw) {
      generatedRules.push({ action: "route", outbound: proxyTag, rule_set: ["geosite-gfw"] })
    }

    // Append manual rules
    const allRules = [...generatedRules, ...rules.filter((r) => r.outbound || r.action)]

    const routingConfig: any = { rules: allRules, final: finalOutbound }
    if (defaultDomainResolver) {
      routingConfig.default_domain_resolver = defaultDomainResolver
    }
    setRouting(routingConfig)
  }, [
    routeMode, finalOutbound, rules, defaultDomainResolver,
    directDomains, directIps, proxyDomains, proxyIps,
    blockDomains, blockIps,
    enableGfw, enableCnDomain, enableCnIp,
    enableBlockAds, enablePrivateIpDirect,
    availableOutbounds, setRouting, setDns,
  ])

  const content = (
    <div className="space-y-4">
      {/* Route mode selector */}
      <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
        <div className="space-y-2">
          <Label>{t("routeMode")}</Label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "global_proxy" as const, label: t("globalProxy") },
              { value: "global_direct" as const, label: t("globalDirect") },
              { value: "rules" as const, label: t("ruleRouting") },
            ].map((mode) => (
              <Button
                key={mode.value}
                type="button"
                variant={routeMode === mode.value ? "default" : "outline"}
                size="sm"
                onClick={() => setRouteMode(mode.value)}
                className="w-full"
              >
                {mode.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {routeMode === "global_proxy" && t("globalProxyDesc")}
            {routeMode === "global_direct" && t("globalDirectDesc")}
            {routeMode === "rules" && t("ruleRoutingDesc")}
          </p>
        </div>
      </div>

      {/* Rule split mode: final outbound + domain resolver + tab lists */}
      {routeMode === "rules" && (
        <>
          <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-2">
              <Label>{t("finalOutbound")} (final)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={finalOutbound}
                onChange={(e) => setFinalOutbound(e.target.value)}
              >
                {availableOutbounds.length > 0 ? (
                  availableOutbounds.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="proxy_out">proxy_out</option>
                    <option value="direct">direct</option>
                    <option value="block">block</option>
                  </>
                )}
              </select>
              <p className="text-xs text-muted-foreground">{t("finalOutboundDesc")}</p>
            </div>

            <div className="space-y-2">
              <Label>{t("domainResolverLabel")}</Label>
              <Input
                placeholder={t("domainResolverPlaceholder")}
                value={defaultDomainResolver}
                onChange={(e) => setDefaultDomainResolver(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("domainResolverDesc")}</p>
            </div>
          </div>

          <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-3">
              <Label>{t("routingRules")}</Label>
            <p className="text-xs text-muted-foreground">{t("rulePriority")}</p>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="direct">{t("directList")}</TabsTrigger>
                <TabsTrigger value="proxy">{t("proxyList")}</TabsTrigger>
                <TabsTrigger value="block">{t("blockList")}</TabsTrigger>
              </TabsList>
              <TabsList className="grid w-full grid-cols-3 mt-1">
                <TabsTrigger value="gfw">{t("gfwList")}</TabsTrigger>
                <TabsTrigger value="cnDomain">{t("cnDomainTab")}</TabsTrigger>
                <TabsTrigger value="cnIp">{t("cnIpTab")}</TabsTrigger>
              </TabsList>

              <TabsContent value="direct">
                <DirectTab
                  directDomains={directDomains}
                  setDirectDomains={setDirectDomains}
                  directIps={directIps}
                  setDirectIps={setDirectIps}
                  enablePrivateIpDirect={enablePrivateIpDirect}
                  setEnablePrivateIpDirect={setEnablePrivateIpDirect}
                />
              </TabsContent>

              <TabsContent value="proxy">
                <ProxyTab
                  proxyDomains={proxyDomains}
                  setProxyDomains={setProxyDomains}
                  proxyIps={proxyIps}
                  setProxyIps={setProxyIps}
                />
              </TabsContent>

              <TabsContent value="block">
                <BlockTab
                  blockDomains={blockDomains}
                  setBlockDomains={setBlockDomains}
                  blockIps={blockIps}
                  setBlockIps={setBlockIps}
                  enableBlockAds={enableBlockAds}
                  setEnableBlockAds={setEnableBlockAds}
                />
              </TabsContent>

              <TabsContent value="gfw">
                <GfwTab enableGfw={enableGfw} setEnableGfw={setEnableGfw} />
              </TabsContent>

              <TabsContent value="cnDomain">
                <CnDomainTab enableCnDomain={enableCnDomain} setEnableCnDomain={setEnableCnDomain} />
              </TabsContent>

              <TabsContent value="cnIp">
                <CnIpTab enableCnIp={enableCnIp} setEnableCnIp={setEnableCnIp} />
              </TabsContent>
            </Tabs>
            </div>
          </div>
        </>
      )}
    </div>
  )

  if (!showCard) {
    return content
  }

  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500 text-white shadow-sm">
          <Route className="w-5 h-5" />
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
