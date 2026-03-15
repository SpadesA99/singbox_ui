"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Download, Loader2, RefreshCw, Trash2, Plus, ChevronDown, ChevronRight, Zap, Clock } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { apiClient } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

// 测速轮询配置
const PROBE_POLL_MAX_ATTEMPTS = 15   // 最大轮询次数
const PROBE_POLL_INTERVAL_MS = 1000  // 轮询间隔（毫秒）
const PROBE_INITIAL_WAIT_MS = 2000   // 初始等待时间（毫秒）

const UA_OPTIONS_KEYS = [
  { key: "default", labelKey: "defaultBrowser" },
  { key: "clash-verge", label: "Clash Verge" },
  { key: "clash-meta", label: "Clash Meta" },
  { key: "v2rayn", label: "v2rayN" },
  { key: "v2rayng", label: "v2rayNG" },
]

interface ProxyNode {
  name: string
  protocol: string
  address: string
  port: number
  settings: Record<string, any>
  outbound: Record<string, any>
  // 测速相关字段
  latency?: number
  online?: boolean
  last_probe?: string
  success_rate?: number
}

interface SubscriptionEntry {
  id: string
  name: string
  url: string
  user_agent?: string
  auto_update?: boolean
  update_interval?: number
  last_updated?: string
  nodes: ProxyNode[]
}

interface SubscriptionManagerProps {
  onNodeSelect?: (node: ProxyNode) => void
  onNodesLoaded?: (nodes: ProxyNode[]) => void
}

export function SubscriptionManager({ onNodeSelect, onNodesLoaded }: SubscriptionManagerProps) {
  const { t } = useTranslation("subscription")
  const { t: tc } = useTranslation("common")
  const { toast } = useToast()

  const UA_OPTIONS = UA_OPTIONS_KEYS.map(opt => ({
    key: opt.key,
    label: opt.labelKey ? t(opt.labelKey) : opt.label!,
  }))
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [newUserAgent, setNewUserAgent] = useState("default")
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = useState<ProxyNode | null>(null)
  const [probing, setProbing] = useState(false)

  const updateSettings = async (id: string, autoUpdate: boolean, updateInterval: number) => {
    try {
      const response = await fetch(`/api/subscription/${id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_update: autoUpdate, update_interval: updateInterval }),
      })
      if (!response.ok) throw new Error(t("settingsUpdateFailed"))
      const data = await response.json()
      setSubscriptions(prev => prev.map(sub => sub.id === id ? data.subscription : sub))
    } catch (error) {
      toast({ title: t("settingsUpdateFailed"), description: String(error), variant: "destructive" })
    }
  }

  // 用 ref 追踪最新回调，避免 useEffect 依赖变化导致的问题
  const onNodesLoadedRef = useRef(onNodesLoaded)
  onNodesLoadedRef.current = onNodesLoaded

  // 初始化时加载订阅
  useEffect(() => {
    loadSubscriptions()
  }, [])

  // 当订阅变化时，通知父组件所有节点
  useEffect(() => {
    const allNodes = subscriptions.flatMap(sub => sub.nodes || [])
    onNodesLoadedRef.current?.(allNodes)
  }, [subscriptions])

  const loadSubscriptions = async () => {
    try {
      const response = await fetch("/api/subscription")
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions || [])
        if (data.subscriptions?.length > 0) {
          // 默认展开第一个订阅
          setExpandedSubs(new Set([data.subscriptions[0].id]))
        }
      }
    } catch (error) {
      console.log("Failed to load subscriptions")
    } finally {
      setInitialLoading(false)
    }
  }

  const addSubscription = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      toast({
        title: tc("error"),
        description: t("enterNameAndUrl"),
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, url: newUrl, user_agent: newUserAgent }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || t("addFailed"))
      }

      const data = await response.json()
      setSubscriptions(prev => [...prev, data.subscription])
      setExpandedSubs(prev => new Set([...prev, data.subscription.id]))
      setNewName("")
      setNewUrl("")
      setNewUserAgent("default")
      setAddingNew(false)

      toast({
        title: tc("success"),
        description: t("addSuccess", { count: data.nodeCount }),
      })
    } catch (error) {
      toast({
        title: t("addFailed"),
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const refreshSubscription = async (id: string) => {
    setRefreshingIds(prev => new Set([...prev, id]))
    try {
      const response = await fetch(`/api/subscription/${id}/refresh`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || t("refreshFailed"))
      }

      const data = await response.json()
      setSubscriptions(prev =>
        prev.map(sub => (sub.id === id ? data.subscription : sub))
      )

      toast({
        title: t("refreshSuccess"),
        description: t("refreshSuccessDesc", { count: data.nodeCount }),
      })
    } catch (error) {
      toast({
        title: t("refreshFailed"),
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const deleteSubscription = async (id: string) => {
    try {
      const response = await fetch(`/api/subscription/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || t("deleteFailed"))
      }

      setSubscriptions(prev => prev.filter(sub => sub.id !== id))
      toast({
        title: t("deleteSuccess"),
        description: t("deleteSuccessDesc"),
      })
    } catch (error) {
      toast({
        title: t("deleteFailed"),
        description: String(error),
        variant: "destructive",
      })
    }
  }

  const refreshAll = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/subscription/refresh-all", {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || t("refreshAllFailed"))
      }

      const data = await response.json()
      setSubscriptions(data.subscriptions || [])

      toast({
        title: t("refreshAllSuccess"),
        description: t("refreshAllSuccessDesc", { count: data.count, totalNodes: data.totalNodes }),
      })
    } catch (error) {
      toast({
        title: t("refreshAllFailed"),
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleNodeSelect = (node: ProxyNode) => {
    setSelectedNode(node)
    onNodeSelect?.(node)
    const nodeName = String(node.name || 'Unknown')
    toast({
      title: t("nodeSelected"),
      description: t("nodeSelectedDesc", { name: nodeName }),
    })
  }

  // 手动测速
  const probeNodes = async () => {
    if (subscriptions.length === 0) {
      toast({
        title: t("noNodesForProbe"),
        description: t("noNodesForProbeHint"),
        variant: "destructive",
      })
      return
    }

    setProbing(true)
    try {
      // 同步节点到测速服务并启动测速
      const result = await apiClient.syncProberNodes()
      toast({
        title: t("probeStarted"),
        description: t("probeStartedDesc", { count: result.nodeCount }),
      })

      // 轮询等待测速完成
      const pollStatus = async (attempts = 0): Promise<void> => {
        if (attempts >= PROBE_POLL_MAX_ATTEMPTS) {
          // 超过 15 次（约 15 秒）仍未完成，强制保存当前结果
          await apiClient.saveProberResults()
          await loadSubscriptions()
          setProbing(false)
          toast({
            title: t("probeComplete"),
            description: t("probeCompleteDesc"),
          })
          return
        }

        try {
          const status = await apiClient.getProberStatus()
          // 如果 prober 不在运行或已完成一轮探测，保存结果
          if (!status.running || status.node_count === status.online_count + status.offline_count) {
            await apiClient.saveProberResults()
            await loadSubscriptions()
            setProbing(false)
            toast({
              title: t("probeComplete"),
              description: t("probeCompleteDesc"),
            })
            return
          }
        } catch {
          // 忽略状态检查错误，继续轮询
        }

        // 等待后继续轮询
        await new Promise(resolve => setTimeout(resolve, PROBE_POLL_INTERVAL_MS))
        return pollStatus(attempts + 1)
      }

      // 等待初始探测完成后开始轮询
      await new Promise(resolve => setTimeout(resolve, PROBE_INITIAL_WAIT_MS))
      await pollStatus()
    } catch (error) {
      setProbing(false)
      toast({
        title: t("probeFailed"),
        description: String(error),
        variant: "destructive",
      })
    }
  }

  const totalNodes = subscriptions.reduce((sum, sub) => sum + (sub.nodes?.length || 0), 0)

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">{tc("loading")}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {t("summaryText", { subCount: subscriptions.length, nodeCount: totalNodes })}
        </div>
        <div className="flex gap-2">
          {subscriptions.length > 0 && (
            <>
              <Button
                onClick={probeNodes}
                disabled={probing}
                variant="outline"
                size="sm"
              >
                {probing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Zap className="h-4 w-4 mr-1" />
                )}
                {t("probe")}
              </Button>
              <Button
                onClick={refreshAll}
                disabled={loading}
                variant="outline"
                size="sm"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1" />
                )}
                {t("refreshAll")}
              </Button>
            </>
          )}
          <Button
            onClick={() => setAddingNew(true)}
            size="sm"
            disabled={addingNew}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("addSubscription")}
          </Button>
        </div>
      </div>

      {/* 添加新订阅 */}
      {addingNew && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{t("addNewSubscription")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-[1fr_2fr_auto] gap-3">
              <div>
                <Label htmlFor="sub-name">{t("subName")}</Label>
                <Input
                  id="sub-name"
                  placeholder={t("subNamePlaceholder")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="sub-url">{t("subUrl")}</Label>
                <Input
                  id="sub-url"
                  type="url"
                  placeholder="https://..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addSubscription()
                    }
                  }}
                />
              </div>
              <div>
                <Label>User-Agent</Label>
                <Select value={newUserAgent} onValueChange={setNewUserAgent}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.key} value={opt.key}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAddingNew(false)
                  setNewName("")
                  setNewUrl("")
                  setNewUserAgent("default")
                }}
              >
                {tc("cancel")}
              </Button>
              <Button size="sm" onClick={addSubscription} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                {t("fetchSubscription")}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 订阅列表 */}
      {subscriptions.length === 0 && !addingNew ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>{t("noSubscriptions")}</p>
          <p className="text-sm mt-1">{t("noSubscriptionsHint")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {subscriptions.map((sub) => (
            <Card key={sub.id} className="overflow-hidden">
              {/* 订阅头部 */}
              <div
                className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleExpand(sub.id)}
              >
                <div className="flex items-center gap-2">
                  {expandedSubs.has(sub.id) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <span className="font-medium">{sub.name}</span>
                  {sub.user_agent && sub.user_agent !== "default" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                      {UA_OPTIONS.find(o => o.key === sub.user_agent)?.label || sub.user_agent}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    ({t("nodeCount", { count: sub.nodes?.length || 0 })})
                  </span>
                  {sub.last_updated && (
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {t("lastUpdated", { time: new Date(sub.last_updated).toLocaleString() })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  {/* 自动更新设置 */}
                  <div className="flex items-center gap-1.5 border rounded px-2 py-1">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <Checkbox
                      checked={!!sub.auto_update}
                      onCheckedChange={(checked) =>
                        updateSettings(sub.id, !!checked, sub.update_interval || 24)
                      }
                    />
                    {sub.auto_update && (
                      <Select
                        value={String(sub.update_interval || 24)}
                        onValueChange={(v) => updateSettings(sub.id, true, Number(v))}
                      >
                        <SelectTrigger className="h-6 w-[70px] text-xs border-0 p-0 focus:ring-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1h</SelectItem>
                          <SelectItem value="3">3h</SelectItem>
                          <SelectItem value="6">6h</SelectItem>
                          <SelectItem value="12">12h</SelectItem>
                          <SelectItem value="24">24h</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => refreshSubscription(sub.id)}
                    disabled={refreshingIds.has(sub.id)}
                  >
                    {refreshingIds.has(sub.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSubscription(sub.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

                {expandedSubs.has(sub.id) && sub.nodes && sub.nodes.length > 0 && (
                <div className="border-t max-h-[300px] overflow-auto">
                  {sub.nodes.map((node, index) => {
                    const protocol = String(node.protocol || 'unknown')
                    const address = String(node.address || '')
                    const port = Number(node.port) || 0
                    const name = String(node.name || '')
                    const hasProbeResult = node.last_probe !== undefined && node.last_probe !== ''
                    return (
                      <div
                        key={index}
                        className={`p-2 px-4 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedNode === node ? "bg-muted" : ""
                        }`}
                        onClick={() => handleNodeSelect(node)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="truncate text-sm">{name || `${t("node")} ${index + 1}`}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                              {protocol.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {hasProbeResult && (
                              <span className={`text-xs font-medium ${
                                node.online
                                  ? (node.latency || 0) < 200
                                    ? "text-green-500"
                                    : (node.latency || 0) < 500
                                    ? "text-yellow-500"
                                    : "text-orange-500"
                                  : "text-red-500"
                              }`}>
                                {node.online ? `${node.latency}ms` : t("timeout")}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {address}:{port}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
