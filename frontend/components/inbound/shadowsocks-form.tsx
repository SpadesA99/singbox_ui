"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Key, QrCode, Network, Layers, Shield } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSS2022Key } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, formatListen, parseListen } from "./types"

interface ShadowsocksConfig {
  listen: string
  listen_port: number
  method: string
  password: string
  users: { name: string; password: string }[]
  multiplex_enabled: boolean
  multiplex_padding: boolean
  multiplex_brutal: boolean
  multiplex_brutal_up: number
  multiplex_brutal_down: number
  network: "" | "tcp" | "udp"
}

const NETWORK_BOTH_VALUE = "__all__"

export function ShadowsocksForm({
  initialConfig,
  setInbound,
  clearEndpoints,
  onError,
  onShowQrCode,
  serverIP,
  setServerIP,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [ssConfig, setSsConfig] = useState<ShadowsocksConfig>({
    listen: "0.0.0.0",
    listen_port: 8388,
    method: "2022-blake3-chacha20-poly1305",
    password: "",
    users: [],
    multiplex_enabled: false,
    multiplex_padding: false,
    multiplex_brutal: false,
    multiplex_brutal_up: 0,
    multiplex_brutal_down: 0,
    network: "",
  })

  // Load from initialConfig
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!initialConfig || initialConfig.type !== "shadowsocks") {
      isInitializedRef.current = true
      return
    }
    setSsConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 8388,
      method: initialConfig.method || "2022-blake3-chacha20-poly1305",
      password: initialConfig.password || "",
      users: (initialConfig.users || []).map((u: any) => ({ name: u.name || "", password: u.password || "" })),
      multiplex_enabled: initialConfig.multiplex?.enabled || false,
      multiplex_padding: initialConfig.multiplex?.padding || false,
      multiplex_brutal: initialConfig.multiplex?.brutal?.enabled || false,
      multiplex_brutal_up: initialConfig.multiplex?.brutal?.up_mbps || 0,
      multiplex_brutal_down: initialConfig.multiplex?.brutal?.down_mbps || 0,
      network: (typeof initialConfig.network === "string" ? initialConfig.network : "") as "" | "tcp" | "udp",
    })
    isInitializedRef.current = true
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    if (!isInitializedRef.current) return
    const previewConfig: any = {
      type: "shadowsocks",
      tag: "ss-in",
      listen: formatListen(ssConfig.listen),
      listen_port: ssConfig.listen_port,
      method: ssConfig.method,
      password: ssConfig.password,
    }
    if (ssConfig.users.length > 0) {
      previewConfig.users = ssConfig.users
        .filter((u) => u.password)
        .map((u) => {
          const user: any = { password: u.password }
          if (u.name) user.name = u.name
          return user
        })
    }
    if (ssConfig.multiplex_enabled) {
      previewConfig.multiplex = { enabled: true, padding: ssConfig.multiplex_padding } as any
      if (ssConfig.multiplex_brutal) {
        previewConfig.multiplex.brutal = {
          enabled: true,
          up_mbps: ssConfig.multiplex_brutal_up,
          down_mbps: ssConfig.multiplex_brutal_down,
        }
      }
    }
    if (ssConfig.network) {
      previewConfig.network = ssConfig.network
    }
    clearEndpoints()
    setInbound(0, previewConfig)
  }, [ssConfig, setInbound, clearEndpoints])

  const showShadowsocksQrCode = async () => {
    onError("")
    try {
      if (!ssConfig.password) {
        throw new Error(t("setPasswordKeyFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      const userInfo = `${ssConfig.method}:${ssConfig.password}`
      const base64UserInfo = btoa(userInfo)
      const ssUrl = `ss://${base64UserInfo}@${ip}:${ssConfig.listen_port}#Shadowsocks`

      onShowQrCode(ssUrl, "shadowsocks")
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("listenAddr")}</Label>
          <Input
            value={ssConfig.listen}
            onChange={(e) => setSsConfig({ ...ssConfig, listen: e.target.value })}
            className={!isValidListenAddress(ssConfig.listen) ? "border-red-500" : ""}
          />
          {!isValidListenAddress(ssConfig.listen) && (
            <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={ssConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, ssConfig.listen_port)
              setSsConfig({ ...ssConfig, listen_port: port })
            }}
            className={!isValidPort(ssConfig.listen_port) ? "border-red-500" : ""}
          />
          {!isValidPort(ssConfig.listen_port) && (
            <p className="text-xs text-red-500">{t("portRange")}</p>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("encryption")}</Label>
          <Select
            value={ssConfig.method}
            onValueChange={(val) => setSsConfig({ ...ssConfig, method: val })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("noEncryption")}</SelectItem>
              <SelectItem value="aes-128-gcm">aes-128-gcm</SelectItem>
              <SelectItem value="aes-192-gcm">aes-192-gcm</SelectItem>
              <SelectItem value="aes-256-gcm">aes-256-gcm</SelectItem>
              <SelectItem value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</SelectItem>
              <SelectItem value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</SelectItem>
              <SelectItem value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</SelectItem>
              <SelectItem value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</SelectItem>
              <SelectItem value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{tc("password")} {ssConfig.method.startsWith("2022-") && t("ssPasswordLabel")}</Label>
          <div className="flex gap-2">
            <Input
              value={ssConfig.password}
              onChange={(e) => setSsConfig({ ...ssConfig, password: e.target.value })}
              placeholder={ssConfig.method.startsWith("2022-") ? t("clickGenerateBase64") : t("enterPassword")}
              className="flex-1 h-9 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0"
              onClick={() => setSsConfig({ ...ssConfig, password: generateSS2022Key(ssConfig.method) })}
            >
              <Key className="h-4 w-4 mr-1.5" />
              {tc("generate")}
            </Button>
          </div>
          {ssConfig.method.startsWith("2022-") && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("ss2022Hint")}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">{t("ssMultiUser")}</Label>
            <p className="text-xs text-muted-foreground">{t("ssMultiUserHint")}</p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => setSsConfig({ ...ssConfig, users: [...ssConfig.users, { name: "", password: "" }] })}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("addUser")}
          </Button>
        </div>

        {ssConfig.users.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
            {ssConfig.users.map((user, index) => (
              <div key={index} className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
                <div className="space-y-4">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                        {index + 1}
                      </div>
                      <Label className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">{user.name || `User ${index + 1}`}</Label>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-full"
                      onClick={() => setSsConfig({ ...ssConfig, users: ssConfig.users.filter((_, i) => i !== index) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold ml-1">{t("configuration")}</Label>
                    <div className="space-y-3 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{t("userName")}</Label>
                        <Input
                          value={user.name}
                          onChange={(e) => {
                            const newUsers = [...ssConfig.users]
                            newUsers[index] = { ...newUsers[index], name: e.target.value }
                            setSsConfig({ ...ssConfig, users: newUsers })
                          }}
                          placeholder="Name"
                          className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                        />
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{tc("password")}</Label>
                        <div className="flex gap-2">
                          <Input
                            value={user.password}
                            onChange={(e) => {
                              const newUsers = [...ssConfig.users]
                              newUsers[index] = { ...newUsers[index], password: e.target.value }
                              setSsConfig({ ...ssConfig, users: newUsers })
                            }}
                            placeholder="Password"
                            className="flex-1 h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 border-zinc-200 dark:border-zinc-800"
                            onClick={() => {
                              const newUsers = [...ssConfig.users]
                              newUsers[index] = { ...newUsers[index], password: generateSS2022Key(ssConfig.method) }
                              setSsConfig({ ...ssConfig, users: newUsers })
                            }}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500 text-white shadow-sm">
              <Network className="h-4 w-4" />
            </div>
            <div>
              <Label className="text-base font-bold tracking-tight">Network</Label>
              <p className="text-xs text-zinc-400 font-medium">{t("naiveNetwork")}</p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-1.5 ml-1">
              <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Network Type</Label>
              <Select
                value={ssConfig.network || NETWORK_BOTH_VALUE}
                onValueChange={(val) =>
                  setSsConfig({
                    ...ssConfig,
                    network: (val === NETWORK_BOTH_VALUE ? "" : val) as "" | "tcp" | "udp",
                  })
                }
              >
                <SelectTrigger className="h-9 bg-zinc-50/80 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NETWORK_BOTH_VALUE}>{t("networkBoth")}</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-500 text-white shadow-sm">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <Label className="text-base font-bold tracking-tight">Multiplex</Label>
              <p className="text-xs text-zinc-400 font-medium">Improve connection latency.</p>
            </div>
            <div className="ml-auto">
              <input
                type="checkbox"
                id="ss-multiplex"
                checked={ssConfig.multiplex_enabled}
                onChange={(e) => setSsConfig({ ...ssConfig, multiplex_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
              />
            </div>
          </div>

          {ssConfig.multiplex_enabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="flex flex-wrap gap-4 ml-1">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ss-multiplex-padding"
                    checked={ssConfig.multiplex_padding}
                    onChange={(e) => setSsConfig({ ...ssConfig, multiplex_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-primary"
                  />
                  <Label htmlFor="ss-multiplex-padding" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("multiplexPadding")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="ss-multiplex-brutal"
                    checked={ssConfig.multiplex_brutal}
                    onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 text-primary"
                  />
                  <Label htmlFor="ss-multiplex-brutal" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("enableBrutal")}</Label>
                </div>
              </div>

              {ssConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={ssConfig.multiplex_brutal_up}
                      onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                      className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={ssConfig.multiplex_brutal_down}
                      onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
                      className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="pt-2 border-t border-border/50">
        <Button type="button" variant="outline" onClick={showShadowsocksQrCode} disabled={!ssConfig.password}>
          <QrCode className="h-4 w-4 mr-1.5" />
          {t("generateQrCode")}
        </Button>
      </div>
    </div>
  )
}
