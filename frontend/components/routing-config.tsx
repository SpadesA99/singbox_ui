"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useSingboxConfigStore, RouteRule, DNSOptions } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"

interface RoutingConfigProps {
  showCard?: boolean
  availableOutbounds?: string[]
}

// 解析 Textarea 行为数组（过滤空行和注释）
const parseLines = (text: string): string[] => {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
}

// 标准化 IP 为 CIDR（纯 IP 自动补 /32 或 /128）
const normalizeIpCidrs = (ips: string[]): string[] => {
  return ips.map((ip) => {
    if (ip.includes("/")) return ip
    return ip.includes(":") ? `${ip}/128` : `${ip}/32`
  })
}

// 稳定的默认值，避免每次渲染创建新引用导致 useEffect 无限循环
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
  const [routeMode, setRouteMode] = useState<"rules" | "global_proxy" | "global_direct">("rules")

  // Passwall 风格列表状态
  const [directDomains, setDirectDomains] = useState("")
  const [directIps, setDirectIps] = useState("")
  const [proxyDomains, setProxyDomains] = useState("")
  const [proxyIps, setProxyIps] = useState("")
  const [blockDomains, setBlockDomains] = useState("")
  const [blockIps, setBlockIps] = useState("")

  // 预设规则集开关
  const [enableGfw, setEnableGfw] = useState(false)
  const [enableCnDomain, setEnableCnDomain] = useState(false)
  const [enableCnIp, setEnableCnIp] = useState(false)
  const [enableBlockAds, setEnableBlockAds] = useState(false)
  const [enablePrivateIpDirect, setEnablePrivateIpDirect] = useState(false)

  const isInitializedRef = useRef(false)

  // 从 initialConfig 初始化（仅首次加载）
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

      // 反向解析已有规则到 Passwall 列表
      const manualRules: RouteRule[] = []
      const dDomains: string[] = []
      const dIps: string[] = []
      const pDomains: string[] = []
      const pIps: string[] = []
      const bDomains: string[] = []
      const bIps: string[] = []

      for (const rule of initialConfig.rules || []) {
        let classified = false

        // 识别 rule_set 预设
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

        // 识别 ip_is_private
        if (!classified && rule.ip_is_private && rule.outbound === "direct") {
          setEnablePrivateIpDirect(true); classified = true
        }

        // 识别简单域名/IP 规则
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

  // 实时同步到全局 store
  useEffect(() => {
    if (!isInitializedRef.current) return

    const proxyTag = availableOutbounds.includes("proxy_out")
      ? "proxy_out"
      : (availableOutbounds.find((t) => t !== "direct" && t !== "block") || "proxy_out")

    // 全局模式：跳过所有分流规则
    if (routeMode === "global_proxy" || routeMode === "global_direct") {
      if (!savedDnsRef.current && config.dns) {
        savedDnsRef.current = config.dns
      }

      let globalDns: DNSOptions
      let dnsTag: string

      if (routeMode === "global_proxy") {
        // 全局代理：DNS 走 Cloudflare DOH 通过代理
        // 额外添加一个直连 DNS 用于解析出站服务器域名，避免循环依赖
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
        // 全局直连：DNS 直连（阿里 DNS）
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
      // default_domain_resolver 用于解析出站服务器域名，必须直连可达
      routingConfig.default_domain_resolver = routeMode === "global_proxy" ? "local_resolver" : dnsTag
      setRouting(routingConfig)
      return
    }

    // 规则分流模式：恢复之前保存的 DNS 配置
    if (savedDnsRef.current) {
      setDns(savedDnsRef.current)
      savedDnsRef.current = undefined
    }

    // 规则分流模式
    const generatedRules: RouteRule[] = []

    // 优先级 1: 屏蔽规则
    if (enableBlockAds) {
      generatedRules.push({
        action: "route", outbound: "block",
        rule_set: ["geosite-category-ads-all"],
      })
    }
    const blockDomainList = parseLines(blockDomains)
    const blockIpList = parseLines(blockIps)
    if (blockDomainList.length > 0) {
      generatedRules.push({
        action: "route", outbound: "block",
        domain_suffix: blockDomainList,
      })
    }
    if (blockIpList.length > 0) {
      generatedRules.push({
        action: "route", outbound: "block",
        ip_cidr: normalizeIpCidrs(blockIpList),
      })
    }

    // 优先级 2: 直连规则
    if (enablePrivateIpDirect) {
      generatedRules.push({
        action: "route", outbound: "direct",
        ip_is_private: true,
      })
    }
    const directDomainList = parseLines(directDomains)
    const directIpList = parseLines(directIps)
    if (directDomainList.length > 0) {
      generatedRules.push({
        action: "route", outbound: "direct",
        domain_suffix: directDomainList,
      })
    }
    if (directIpList.length > 0) {
      generatedRules.push({
        action: "route", outbound: "direct",
        ip_cidr: normalizeIpCidrs(directIpList),
      })
    }
    if (enableCnDomain) {
      generatedRules.push({
        action: "route", outbound: "direct",
        rule_set: ["geosite-cn"],
      })
    }
    if (enableCnIp) {
      generatedRules.push({
        action: "route", outbound: "direct",
        rule_set: ["geoip-cn"],
      })
    }

    // 优先级 3: 代理规则
    const proxyDomainList = parseLines(proxyDomains)
    const proxyIpList = parseLines(proxyIps)
    if (proxyDomainList.length > 0) {
      generatedRules.push({
        action: "route", outbound: proxyTag,
        domain_suffix: proxyDomainList,
      })
    }
    if (proxyIpList.length > 0) {
      generatedRules.push({
        action: "route", outbound: proxyTag,
        ip_cidr: normalizeIpCidrs(proxyIpList),
      })
    }
    if (enableGfw) {
      generatedRules.push({
        action: "route", outbound: proxyTag,
        rule_set: ["geosite-gfw"],
      })
    }

    // 追加手动规则
    const allRules = [...generatedRules, ...rules.filter((r) => r.outbound || r.action)]

    const routingConfig: any = {
      rules: allRules,
      final: finalOutbound,
    }
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
      {/* 路由模式切换 */}
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

      {/* 以下配置仅在规则分流模式下显示 */}
      {routeMode === "rules" && <>
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
        <p className="text-xs text-muted-foreground">
          {t("finalOutboundDesc")}
        </p>
      </div>

      {/* 默认域名解析器 */}
      <div className="space-y-2">
        <Label>{t("domainResolverLabel")}</Label>
        <Input
          placeholder={t("domainResolverPlaceholder")}
          value={defaultDomainResolver}
          onChange={(e) => setDefaultDomainResolver(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t("domainResolverDesc")}
        </p>
      </div>

      {/* Passwall 风格路由规则 */}
      <div className="space-y-3">
        <Label>{t("routingRules")}</Label>
        <p className="text-xs text-muted-foreground">
          {t("rulePriority")}
        </p>
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

          {/* 直连列表 */}
          <TabsContent value="direct" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("directDesc")}
            </p>
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
          </TabsContent>

          {/* 代理列表 */}
          <TabsContent value="proxy" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("proxyDesc")}
            </p>
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
          </TabsContent>

          {/* 屏蔽列表 */}
          <TabsContent value="block" className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {t("blockDesc")}
            </p>
            <div className="space-y-2">
              <Label>{t("domainListLabel")}</Label>
              <Textarea
                placeholder={t("blockDomainsPlaceholder")}
                value={blockDomains}
                onChange={(e) => setBlockDomains(e.target.value)}
                className="font-mono text-xs min-h-[150px]"
              />
              <p className="text-xs text-muted-foreground">
                {t("domainSuffixMethod")}
              </p>
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
          </TabsContent>

          {/* GFW 列表 */}
          <TabsContent value="gfw" className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="pw_gfw"
                checked={enableGfw}
                onChange={() => setEnableGfw(!enableGfw)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="pw_gfw" className="text-sm font-normal cursor-pointer">
                {t("enableGfw")}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("gfwDesc")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("gfwSource")}
            </p>
          </TabsContent>

          {/* 中国域名 */}
          <TabsContent value="cnDomain" className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="pw_cnDomain"
                checked={enableCnDomain}
                onChange={() => setEnableCnDomain(!enableCnDomain)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="pw_cnDomain" className="text-sm font-normal cursor-pointer">
                {t("enableCnDomain")}
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("cnDomainDesc")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("cnDomainSource")}
            </p>
          </TabsContent>

          {/* 中国 IP */}
          <TabsContent value="cnIp" className="space-y-4">
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
            <p className="text-sm text-muted-foreground">
              {t("cnIpDesc")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("cnIpSource")}
            </p>
          </TabsContent>
        </Tabs>
      </div>

      </>}
    </div>
  )

  if (!showCard) {
    return content
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
