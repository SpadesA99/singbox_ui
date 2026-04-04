"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, RefreshCw, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { useSingboxConfigStore } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"
import { VmessForm } from "./vmess-form"
import { VlessForm } from "./vless-form"
import { TrojanForm } from "./trojan-form"
import { SocksForm } from "./socks-form"
import { HttpForm } from "./http-form"
import { WireguardForm } from "./wireguard-form"
import { ShadowsocksForm } from "./shadowsocks-form"
import { Hysteria2Form } from "./hysteria2-form"
import { AnytlsForm } from "./anytls-form"

interface ProxyNode {
  name: string
  type: string
  address: string
  port: number
  settings: Record<string, any>
  outbound: Record<string, any>
}

interface SubscriptionEntry {
  id: string
  name: string
  url: string
  nodes: ProxyNode[]
}

interface OutboundConfigProps {
  showCard?: boolean
}

const tabTriggerClass = "rounded-lg px-4 py-2 text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground dark:data-[state=active]:text-zinc-100 data-[state=active]:shadow-sm transition-all"

// Generate canonical node tag matching backend format
function generateNodeTag(type: string, address: string, port: number): string {
  const safeAddress = address.replace(/\./g, '_').replace(/:/g, '_').replace(/-/g, '_')
  const typeTag = type === 'shadowsocks' ? 'ss' : type
  return `${typeTag}-${safeAddress}-${port}`
}

export function OutboundConfig({ showCard = true }: OutboundConfigProps) {
  const { config, setOutbound, setBalancerState } = useSingboxConfigStore()
  const initialConfig = config.outbounds?.[0]
  const { toast } = useToast()
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const [outboundType, setOutboundType] = useState("subscription")
  const [error, setError] = useState("")

  const isInitializedRef = useRef(false)
  const prevSelectedNodeRef = useRef<ProxyNode | null>(null)

  // Subscription state
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([])
  const [loadingNodes, setLoadingNodes] = useState(true)
  const [selectedNode, setSelectedNode] = useState<ProxyNode | null>(null)

  // Balancer state
  const [enableBalancer, setEnableBalancer] = useState(false)
  const [selectedNodeTags, setSelectedNodeTags] = useState<string[]>([])
  const [balancerStrategy, setBalancerStrategy] = useState<string>("50")

  // Initialize outbound type from store
  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type) {
      setOutboundType(initialConfig.type)
    }
    isInitializedRef.current = true
  }, [initialConfig])

  // Balancer state sync
  useEffect(() => {
    if (enableBalancer && selectedNodeTags.length >= 2) {
      const selectedOutbounds = subscriptions.flatMap(sub =>
        (sub.nodes || [])
          .filter(node => {
            const nodeTag = node.outbound?.tag || generateNodeTag(node.type, node.address, node.port)
            return selectedNodeTags.includes(nodeTag)
          })
          .map(node => node.outbound)
          .filter(Boolean)
      )
      setBalancerState({
        enabled: true,
        selectedOutbounds: selectedNodeTags,
        strategy: balancerStrategy,
        allOutbounds: selectedOutbounds as any
      })
    } else {
      setBalancerState(null)
    }
  }, [enableBalancer, selectedNodeTags, balancerStrategy, subscriptions, setBalancerState])

  // Handle outbound type changes — write store immediately so JSON stays in sync
  useEffect(() => {
    if (!isInitializedRef.current) return
    if (outboundType === "direct") {
      setOutbound(0, { type: "direct", tag: "direct" })
    } else if (outboundType === "block") {
      setOutbound(0, { type: "block", tag: "block" })
    } else if (outboundType === "subscription") {
      if (selectedNode?.outbound && selectedNode !== prevSelectedNodeRef.current) {
        const outboundWithProxyTag = { ...selectedNode.outbound, tag: "proxy_out" } as any
        setOutbound(0, outboundWithProxyTag)
        prevSelectedNodeRef.current = selectedNode
      } else if (!selectedNode) {
        setOutbound(0, { type: "direct", tag: "proxy_out" })
      }
    } else {
      // Only write placeholder if the stored outbound doesn't already have this type
      const currentType = useSingboxConfigStore.getState().config.outbounds?.[0]?.type
      if (currentType !== outboundType) {
        setOutbound(0, { type: outboundType as any, tag: "proxy_out" })
      }
    }
  }, [outboundType, selectedNode, setOutbound])

  // Load subscription nodes
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const response = await fetch("/api/subscription")
        if (response.ok) {
          const data = await response.json()
          setSubscriptions(data.subscriptions || [])
        }
      } catch (error) {
        console.log("Failed to load subscriptions")
      } finally {
        setLoadingNodes(false)
      }
    }
    loadNodes()
  }, [])

  // Refresh subscription nodes
  const refreshNodes = async () => {
    setLoadingNodes(true)
    try {
      const response = await fetch("/api/subscription/refresh-all", {
        method: "POST",
      })
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions || [])
        toast({
          title: tc("success"),
          description: t("refreshSuccessDesc", { count: data.totalNodes }),
        })
      }
    } catch (error) {
      toast({
        title: t("refreshFailed"),
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setLoadingNodes(false)
    }
  }

  // Select subscription node (single-select mode)
  const handleSelectNode = (node: ProxyNode) => {
    setSelectedNode(node)
    if (node.outbound) {
      const outboundWithProxyTag = { ...node.outbound, tag: "proxy_out" } as any
      setOutbound(0, outboundWithProxyTag)
    }
    const nodeName = String(node.name || 'Unknown')
    toast({
      title: t("nodeSelectedTitle"),
      description: t("nodeSelected", { name: nodeName }),
    })
  }

  // Toggle node for multi-select (balancer)
  const handleNodeToggle = (nodeTag: string) => {
    setSelectedNodeTags(prev => {
      if (prev.includes(nodeTag)) {
        return prev.filter(tag => tag !== nodeTag)
      } else {
        return [...prev, nodeTag]
      }
    })
  }

  const totalNodes = subscriptions.reduce((sum, sub) => sum + (sub.nodes?.length || 0), 0)

  // Shared form props
  const formProps = { initialConfig, setOutbound }

  const content = (
    <div className="space-y-6">
      <Tabs value={outboundType} onValueChange={setOutboundType} className="w-full">
        <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1 p-1 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm">
          <TabsTrigger className={tabTriggerClass} value="subscription">{t("subscription")}</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="direct">{t("direct")}</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="block">{t("block")}</TabsTrigger>
          <div className="w-px h-6 bg-zinc-300 dark:bg-zinc-700 mx-1 self-center"></div>
          <TabsTrigger className={tabTriggerClass} value="vless">VLESS</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="vmess">VMess</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="trojan">Trojan</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="shadowsocks">Shadowsocks</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="hysteria2">Hysteria2</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="anytls">AnyTLS</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="wireguard">WireGuard</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="socks">Socks</TabsTrigger>
          <TabsTrigger className={tabTriggerClass} value="http">HTTP</TabsTrigger>
        </TabsList>

        <div className="pt-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* Subscription node selection */}
            <TabsContent value="subscription" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t("summaryText", { subCount: subscriptions.length, nodeCount: totalNodes })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={refreshNodes}
                    disabled={loadingNodes}
                    variant="outline"
                    size="sm"
                  >
                    {loadingNodes ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    {tc("refresh")}
                  </Button>
                </div>
              </div>

              {/* Balancer toggle */}
              {totalNodes > 0 && (
                <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="enable-balancer"
                    checked={enableBalancer}
                    onCheckedChange={(checked) => {
                      setEnableBalancer(checked as boolean)
                      if (!checked) {
                        setSelectedNodeTags([])
                      }
                    }}
                  />
                  <Label htmlFor="enable-balancer" className="text-sm font-medium cursor-pointer">
                    {t("enableBalancerMultiSelect")}
                  </Label>
                  {enableBalancer && selectedNodeTags.length < 2 && (
                    <span className="text-xs text-destructive">{t("minTwoNodes")}</span>
                  )}
                  {enableBalancer && selectedNodeTags.length >= 2 && (
                    <span className="text-xs text-green-600">{t("selectedCount", { count: selectedNodeTags.length })}</span>
                  )}
                </div>
              )}

              {/* urltest parameters */}
              {enableBalancer && (
                <div className="space-y-2">
                  <Label>{t("tolerance")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={5000}
                      value={balancerStrategy}
                      onChange={(e) => setBalancerStrategy(e.target.value)}
                      className="w-[120px]"
                      placeholder="50"
                    />
                    <span className="text-sm text-muted-foreground">ms</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("toleranceDesc")}
                  </p>
                </div>
              )}

              {loadingNodes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">{tc("loading")}</span>
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t("noSubscriptionNodes")}</p>
                  <p className="text-sm mt-1">{t("noSubscriptionNodesHint")}</p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-[400px] overflow-auto">
                  {subscriptions.map((sub) => (
                    <div key={sub.id}>
                      <div className="px-3 py-2 bg-muted/50 font-medium text-sm border-b">
                        {sub.name} ({sub.nodes?.length || 0})
                      </div>
                      {sub.nodes?.map((node, index) => {
                        const nodeType = String(node.type || 'unknown')
                        const address = String(node.address || '')
                        const port = Number(node.port) || 0
                        const name = String(node.name || '')
                        const nodeTag = node.outbound?.tag || generateNodeTag(nodeType, address, port)
                        const isChecked = selectedNodeTags.includes(nodeTag)
                        return (
                          <div
                            key={index}
                            className={`p-2 px-4 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                              enableBalancer
                                ? isChecked ? "bg-primary/10" : ""
                                : selectedNode === node ? "bg-primary/10" : ""
                            }`}
                            onClick={() => {
                              if (enableBalancer) {
                                handleNodeToggle(nodeTag)
                              } else {
                                handleSelectNode(node)
                              }
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {enableBalancer ? (
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => handleNodeToggle(nodeTag)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  selectedNode === node && (
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                  )
                                )}
                                <span className="truncate text-sm">{name || `${t("node")} ${index + 1}`}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                                  {nodeType.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {address}:{port}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Direct */}
            <TabsContent value="direct" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {t("directDesc")}
              </div>
            </TabsContent>

            {/* Block */}
            <TabsContent value="block" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {t("blockDesc")}
              </div>
            </TabsContent>

            {/* Protocol forms */}
            <TabsContent value="vmess"><VmessForm {...formProps} /></TabsContent>
            <TabsContent value="vless"><VlessForm {...formProps} /></TabsContent>
            <TabsContent value="trojan"><TrojanForm {...formProps} /></TabsContent>
            <TabsContent value="socks"><SocksForm {...formProps} /></TabsContent>
            <TabsContent value="http"><HttpForm {...formProps} /></TabsContent>
            <TabsContent value="wireguard"><WireguardForm {...formProps} /></TabsContent>
            <TabsContent value="shadowsocks"><ShadowsocksForm {...formProps} /></TabsContent>
            <TabsContent value="hysteria2"><Hysteria2Form {...formProps} /></TabsContent>
            <TabsContent value="anytls"><AnytlsForm {...formProps} /></TabsContent>
          </div>
        </Tabs>

      {error && (
        <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
      )}
    </div>
  )

  if (showCard) {
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

  return content
}
