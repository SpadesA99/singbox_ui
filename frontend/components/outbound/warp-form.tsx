"use client"

import { useEffect, useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Zap, Crown, Search, Trash2, RefreshCw } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

interface WarpAccount {
  exists: boolean
  id?: string
  license?: string
  type?: string
  warp_plus?: boolean
  v4?: string
  v6?: string
  created_at?: string
  updated_at?: string
}

interface WarpEndpoint {
  host: string
  port: number
  latency_ms: number
  reachable: boolean
}

const DEFAULT_ENDPOINTS = [
  { host: "engage.cloudflareclient.com", port: 2408, label: "engage.cloudflareclient.com:2408" },
  { host: "162.159.192.1", port: 2408, label: "162.159.192.1:2408" },
  { host: "162.159.193.10", port: 2408, label: "162.159.193.10:2408" },
  { host: "162.159.195.1", port: 2408, label: "162.159.195.1:2408" },
]

// 与后端 services/warp_scanner.go 的 warpEndpointPorts 保持一致.
// 扫描器会尝试所有这些端口, 因此 Select 必须能展示其中任意一个.
const WARP_PORTS = [
  500, 854, 859, 864, 878, 880, 890, 891, 894, 903,
  908, 928, 934, 939, 942, 943, 945, 946, 955, 968,
  987, 988, 1002, 1010, 1014, 1018, 1070, 1074, 1180, 1387,
  1701, 1843, 2371, 2408, 2506, 3138, 3476, 3581, 3854, 4177,
  4198, 4233, 4500, 5279, 5956, 7103, 7152, 7156, 7281, 7559,
  8319, 8742, 8854, 8886,
]

async function warpFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  })
  const text = await res.text()
  let data: any = {}
  try { data = text ? JSON.parse(text) : {} } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  return data as T
}

export function WarpForm({ setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const { toast } = useToast()

  const [account, setAccount] = useState<WarpAccount>({ exists: false })
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [applying, setApplying] = useState(false)
  const [scanning, setScanning] = useState(false)

  const [license, setLicense] = useState("")
  const [endpointHost, setEndpointHost] = useState("engage.cloudflareclient.com")
  const [endpointPort, setEndpointPort] = useState<number>(2408)
  const [mtu, setMtu] = useState<number>(1280)
  const [endpoints, setEndpoints] = useState<WarpEndpoint[]>([])

  const loadedRef = useRef(false)
  // 注册/应用出站的 ref 级互斥锁: setApplying 是异步 state,
  // 两次紧挨着的点击会在第一次 setApplying(true) 刷入前同时进入 applyOutbound,
  // 导致 CF 侧产生两个孤儿设备. ref 是同步可见的, 关上后立刻生效.
  const applyingRef = useRef(false)

  // 加载已缓存的 WARP 账户
  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    ;(async () => {
      try {
        const acct = await warpFetch<WarpAccount>("/api/warp/account")
        setAccount(acct)
      } catch (e: any) {
        // 静默失败
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function applyOutbound(opts: { force?: boolean; license?: string }) {
    // 同步 ref 锁: 在 state 更新刷入前就拒绝第二次调用,
    // 避免双击/并发产生两个 CF 设备.
    if (applyingRef.current) return
    applyingRef.current = true
    setApplying(true)
    try {
      const body = {
        force: !!opts.force,
        license: opts.license || "",
        endpoint_host: endpointHost,
        endpoint_port: endpointPort,
        mtu: mtu,
      }
      const data = await warpFetch<{ account: WarpAccount; outbound: any }>("/api/warp/register", {
        method: "POST",
        body: JSON.stringify(body),
      })
      setAccount(data.account)
      // 写回 store, 使用 proxy_out tag
      setOutbound(0, { ...data.outbound, tag: "proxy_out" })
      toast({
        title: tc("success"),
        description: t("warpAppliedDesc"),
      })
    } catch (e: any) {
      toast({
        title: t("warpActionFailed"),
        description: String(e?.message || e),
        variant: "destructive",
      })
    } finally {
      applyingRef.current = false
      setApplying(false)
    }
  }

  async function handleRegister() {
    setRegistering(true)
    try {
      await applyOutbound({ force: false, license: license })
    } finally {
      setRegistering(false)
    }
  }

  async function handleReregister() {
    if (!window.confirm(t("warpReregisterConfirm"))) return
    setRegistering(true)
    try {
      await applyOutbound({ force: true, license: license })
    } finally {
      setRegistering(false)
    }
  }

  async function handleResetAccount() {
    if (!window.confirm(t("warpResetConfirm"))) return
    try {
      await warpFetch("/api/warp/account", { method: "DELETE" })
      setAccount({ exists: false })
      toast({ title: tc("success"), description: t("warpResetDesc") })
    } catch (e: any) {
      toast({
        title: t("warpActionFailed"),
        description: String(e?.message || e),
        variant: "destructive",
      })
    }
  }

  async function handleBindLicense() {
    if (!license.trim()) {
      toast({
        title: t("warpActionFailed"),
        description: t("warpLicenseEmpty"),
        variant: "destructive",
      })
      return
    }
    setApplying(true)
    // Step 1: 绑定 license —— 成功后立刻 toast,
    // 避免后续 applyOutbound 失败时误导用户"license 绑定失败"
    let bound = false
    try {
      const acct = await warpFetch<WarpAccount>("/api/warp/license", {
        method: "POST",
        body: JSON.stringify({ license: license.trim() }),
      })
      setAccount(acct)
      bound = true
      toast({ title: tc("success"), description: t("warpLicenseBoundDesc") })
    } catch (e: any) {
      toast({
        title: t("warpActionFailed"),
        description: String(e?.message || e),
        variant: "destructive",
      })
      setApplying(false)
      return
    }
    // Step 2: 重新生成出站配置以反映最新 license 状态
    // 若此步失败,已绑定的 license 仍有效,仅出站未同步写入
    try {
      await applyOutbound({ force: false, license: license.trim() })
    } catch {
      if (bound) {
        toast({
          title: t("warpActionFailed"),
          description: t("warpLicenseBoundButApplyFailed"),
          variant: "destructive",
        })
      }
    } finally {
      setApplying(false)
    }
  }

  async function handleScan() {
    setScanning(true)
    setEndpoints([])
    try {
      const data = await warpFetch<{ endpoints: WarpEndpoint[] }>("/api/warp/scan", {
        method: "POST",
        body: JSON.stringify({ sample_per_range: 4, timeout_ms: 1500, top_n: 8 }),
      })
      setEndpoints(data.endpoints || [])
      toast({
        title: tc("success"),
        description: t("warpScanSuccess", { count: data.endpoints?.length || 0 }),
      })
    } catch (e: any) {
      toast({
        title: t("warpActionFailed"),
        description: String(e?.message || e),
        variant: "destructive",
      })
    } finally {
      setScanning(false)
    }
  }

  function selectScannedEndpoint(ep: WarpEndpoint) {
    setEndpointHost(ep.host)
    setEndpointPort(ep.port)
  }

  return (
    <div className="space-y-6">
      {/* 说明 */}
      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-sm text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <Zap className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">{t("warpTitle")}</p>
            <p className="text-xs leading-relaxed opacity-90">{t("warpDesc")}</p>
          </div>
        </div>
      </div>

      {/* 账户状态 */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
            <Crown className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">{t("warpAccount")}</h3>
            <p className="text-xs text-muted-foreground">{t("warpAccountDesc")}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span className="text-sm">{tc("loading")}</span>
          </div>
        ) : !account.exists ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-sm text-muted-foreground">{t("warpNotRegistered")}</p>
            <Button onClick={handleRegister} disabled={registering}>
              {registering ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("warpRegistering")}</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" />{t("warpRegister")}</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <span className="text-muted-foreground">{t("warpLicenseType")}</span>
                <span className="font-medium">
                  {account.warp_plus ? (
                    <span className="inline-flex items-center gap-1 text-orange-500">
                      <Crown className="h-3 w-3" /> WARP+
                    </span>
                  ) : (
                    <span>{account.type || "free"}</span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                <span className="text-muted-foreground">{t("warpDeviceId")}</span>
                <span className="font-mono text-[10px] truncate max-w-[200px]">{account.id}</span>
              </div>
              {account.v4 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-muted-foreground">IPv4</span>
                  <span className="font-mono">{account.v4}</span>
                </div>
              )}
              {account.v6 && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-muted-foreground">IPv6</span>
                  <span className="font-mono text-[10px] truncate max-w-[200px]">{account.v6}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleReregister} disabled={registering}>
                {registering ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                {t("warpReregister")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleResetAccount}>
                <Trash2 className="h-3 w-3 mr-1" />
                {t("warpReset")}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* WARP+ 许可证 */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
            <Crown className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">{t("warpPlusLicense")}</h3>
            <p className="text-xs text-muted-foreground">{t("warpPlusLicenseDesc")}</p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <Input
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder={t("warpLicensePlaceholder")}
              className="font-mono text-sm"
            />
            <Button onClick={handleBindLicense} disabled={applying || !account.exists}>
              {applying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Crown className="h-4 w-4 mr-2" />
              )}
              {t("warpBindLicense")}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{t("warpLicenseHint")}</p>
        </div>
      </div>

      {/* 端点选择 */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Search className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold">{t("warpEndpoint")}</h3>
            <p className="text-xs text-muted-foreground">{t("warpEndpointDesc")}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("warpEndpointHost")}</Label>
              <div className="flex gap-2">
                <Input
                  value={endpointHost}
                  onChange={(e) => setEndpointHost(e.target.value)}
                  placeholder="engage.cloudflareclient.com"
                  className="h-9 text-sm font-mono"
                />
                <Select
                  value=""
                  onValueChange={(val) => {
                    const pick = DEFAULT_ENDPOINTS.find(d => d.label === val)
                    if (pick) { setEndpointHost(pick.host); setEndpointPort(pick.port) }
                  }}
                >
                  <SelectTrigger className="w-[180px] h-9 text-xs">
                    <SelectValue placeholder={t("warpEndpointPreset")} />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_ENDPOINTS.map(d => (
                      <SelectItem key={d.label} value={d.label}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("port")}</Label>
              <Select value={String(endpointPort)} onValueChange={(v) => setEndpointPort(parseInt(v) || 2408)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WARP_PORTS.map(p => (
                    <SelectItem key={p} value={String(p)}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">MTU</Label>
            <Input
              type="number"
              min={576}
              max={1500}
              value={mtu}
              onChange={(e) => {
                const v = parseInt(e.target.value)
                if (isNaN(v)) { setMtu(1280); return }
                // 钳制到合法范围, 服务端也会兜底
                setMtu(Math.max(576, Math.min(1500, v)))
              }}
              className="h-9 text-sm w-[140px]"
            />
            <p className="text-[11px] text-muted-foreground">{t("warpMtuHint")}</p>
          </div>

          {/* 扫描 + 结果 */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleScan} disabled={scanning}>
                {scanning ? (
                  <><Loader2 className="h-3 w-3 animate-spin mr-1" />{t("warpScanning")}</>
                ) : (
                  <><Search className="h-3 w-3 mr-1" />{t("warpScanEndpoints")}</>
                )}
              </Button>
              {endpoints.length > 0 && (
                <span className="text-xs text-muted-foreground">{t("warpScanResultHint")}</span>
              )}
            </div>

            {endpoints.length > 0 && (
              <div className="border rounded-lg max-h-[240px] overflow-auto">
                {endpoints.map((ep, i) => {
                  const isSelected = ep.host === endpointHost && ep.port === endpointPort
                  return (
                    <div
                      key={`${ep.host}-${ep.port}-${i}`}
                      className={`p-2 px-3 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? "bg-primary/10" : ""}`}
                      onClick={() => selectScannedEndpoint(ep)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-mono truncate">{ep.host}:{ep.port}</span>
                        </div>
                        <span className={`text-xs font-medium ${
                          ep.latency_ms < 100
                            ? "text-green-500"
                            : ep.latency_ms < 200
                            ? "text-yellow-500"
                            : "text-orange-500"
                        }`}>
                          {ep.latency_ms}ms
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 应用按钮 */}
      <div className="flex items-center justify-end gap-2">
        <Button onClick={() => applyOutbound({ force: false, license: license })} disabled={applying || loading}>
          {applying ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("warpApplying")}</>
          ) : (
            <><Zap className="h-4 w-4 mr-2" />{t("warpApplyOutbound")}</>
          )}
        </Button>
      </div>
    </div>
  )
}
