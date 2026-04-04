"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Key, QrCode, Shield, Upload, Network, Layers } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, TrojanUser, formatListen, parseListen } from "./types"

interface TrojanFlat {
  listen: string
  listen_port: number
  users: TrojanUser[]
  tls_enabled: boolean
  tls_mode: "manual" | "acme"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
  tls_server_name: string
  transport_type: string
  transport_path: string
  transport_service_name: string
  fallback_server: string
  fallback_server_port: number
  fallback_for_alpn: { alpn: string; server: string; server_port: number }[]
  multiplex_enabled: boolean
  multiplex_padding: boolean
  multiplex_brutal: boolean
  multiplex_brutal_up: number
  multiplex_brutal_down: number
  tls_alpn: string
  transport_host: string
  ws_max_early_data: number
  ws_early_data_header_name: string
}

function deriveFlat(initialConfig: any): TrojanFlat {
  if (!initialConfig || initialConfig.type !== "trojan") {
    return {
      listen: "0.0.0.0",
      listen_port: 443,
      users: [{ name: "", password: "" }],
      tls_enabled: true,
      tls_mode: "manual",
      tls_acme_domain: "",
      tls_certificate_path: "/etc/sing-box/cert.pem",
      tls_key_path: "/etc/sing-box/key.pem",
      tls_server_name: "",
      transport_type: "tcp",
      transport_path: "",
      transport_service_name: "",
      fallback_server: "",
      fallback_server_port: 0,
      fallback_for_alpn: [],
      multiplex_enabled: false,
      multiplex_padding: false,
      multiplex_brutal: false,
      multiplex_brutal_up: 0,
      multiplex_brutal_down: 0,
      tls_alpn: "",
      transport_host: "",
      ws_max_early_data: 0,
      ws_early_data_header_name: "",
    }
  }
  const trojanUsers = (initialConfig.users || []).map((u: any) => ({
    name: u.name || "",
    password: u.password || "",
  }))
  return {
    listen: parseListen(initialConfig.listen),
    listen_port: initialConfig.listen_port || 443,
    users: trojanUsers.length > 0 ? trojanUsers : [{ name: "", password: "" }],
    tls_enabled: initialConfig.tls?.enabled !== false,
    tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
    tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
    tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
    tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
    tls_server_name: initialConfig.tls?.server_name || "",
    transport_type: initialConfig.transport?.type || "tcp",
    transport_path: initialConfig.transport?.path || "",
    transport_service_name: initialConfig.transport?.service_name || "",
    fallback_server: initialConfig.fallback?.server || "",
    fallback_server_port: initialConfig.fallback?.server_port || 0,
    fallback_for_alpn: (() => {
      const raw = initialConfig.fallback_for_alpn || {}
      return Object.entries(raw).map(([alpn, config]: [string, any]) => ({
        alpn,
        server: config?.server || "",
        server_port: config?.server_port || 0,
      }))
    })(),
    multiplex_enabled: initialConfig.multiplex?.enabled || false,
    multiplex_padding: initialConfig.multiplex?.padding || false,
    multiplex_brutal: initialConfig.multiplex?.brutal?.enabled || false,
    multiplex_brutal_up: initialConfig.multiplex?.brutal?.up_mbps || 0,
    multiplex_brutal_down: initialConfig.multiplex?.brutal?.down_mbps || 0,
    tls_alpn: (initialConfig.tls?.alpn || []).join(", "),
    transport_host: Array.isArray(initialConfig.transport?.host) ? initialConfig.transport.host.join(", ") : initialConfig.transport?.host || "",
    ws_max_early_data: initialConfig.transport?.max_early_data || 0,
    ws_early_data_header_name: initialConfig.transport?.early_data_header_name || "",
  }
}

function buildTrojanInbound(flat: TrojanFlat): any {
  const trojanUsersBuilt = flat.users
    .filter((u) => u.password)
    .map((u) => {
      const user: any = { password: u.password }
      if (u.name) user.name = u.name
      return user
    })

  const previewConfig: any = {
    type: "trojan",
    tag: "trojan-in",
    listen: formatListen(flat.listen),
    listen_port: flat.listen_port,
    users: trojanUsersBuilt,
  }

  const alpnArr = flat.tls_alpn ? flat.tls_alpn.split(",").map(s => s.trim()).filter(Boolean) : []

  if (flat.tls_enabled) {
    if (flat.tls_mode === "acme" && flat.tls_acme_domain) {
      previewConfig.tls = {
        enabled: true,
        acme: {
          domain: [flat.tls_acme_domain],
          data_directory: "/var/lib/sing-box/acme",
        },
      }
    } else {
      previewConfig.tls = {
        enabled: true,
        certificate_path: flat.tls_certificate_path,
        key_path: flat.tls_key_path,
      }
    }
    if (flat.tls_server_name) {
      previewConfig.tls.server_name = flat.tls_server_name
    }
    if (alpnArr.length > 0) {
      previewConfig.tls.alpn = alpnArr
    }
  }

  if (flat.transport_type && flat.transport_type !== "tcp") {
    previewConfig.transport = { type: flat.transport_type }
    if (flat.transport_type === "ws" && flat.transport_path) {
      previewConfig.transport.path = flat.transport_path
    }
    if (flat.transport_type === "grpc" && flat.transport_service_name) {
      previewConfig.transport.service_name = flat.transport_service_name
    }
    if (
      (flat.transport_type === "http" || flat.transport_type === "httpupgrade") &&
      flat.transport_path
    ) {
      previewConfig.transport.path = flat.transport_path
    }
    if (flat.transport_type === "http" && flat.transport_host) {
      previewConfig.transport.host = flat.transport_host.split(",").map((s: string) => s.trim()).filter(Boolean)
    }
    if (flat.transport_type === "httpupgrade" && flat.transport_host) {
      previewConfig.transport.host = flat.transport_host
    }
    if (flat.transport_type === "ws") {
      if (flat.ws_max_early_data > 0) {
        previewConfig.transport.max_early_data = flat.ws_max_early_data
      }
      if (flat.ws_early_data_header_name) {
        previewConfig.transport.early_data_header_name = flat.ws_early_data_header_name
      }
    }
  }

  if (flat.fallback_server && flat.fallback_server_port > 0) {
    previewConfig.fallback = {
      server: flat.fallback_server,
      server_port: flat.fallback_server_port,
    }
  }

  const alpnFallbacks = flat.fallback_for_alpn.filter((f) => f.alpn && f.server && f.server_port > 0)
  if (alpnFallbacks.length > 0) {
    const fallbackMap: Record<string, { server: string; server_port: number }> = {}
    for (const f of alpnFallbacks) {
      fallbackMap[f.alpn] = { server: f.server, server_port: f.server_port }
    }
    previewConfig.fallback_for_alpn = fallbackMap
  }

  if (flat.multiplex_enabled) {
    previewConfig.multiplex = { enabled: true, padding: flat.multiplex_padding } as any
    if (flat.multiplex_brutal) {
      previewConfig.multiplex.brutal = {
        enabled: true,
        up_mbps: flat.multiplex_brutal_up,
        down_mbps: flat.multiplex_brutal_down,
      }
    }
  }

  return previewConfig
}

export function TrojanForm({
  initialConfig,
  setInbound,
  clearEndpoints,
  currentInstance,
  onError,
  onShowQrCode,
  serverIP,
  setServerIP,
  certLoading,
  certInfo,
  onGenerateCert,
  onUploadCert,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  function updateInbound(patch: Partial<TrojanFlat>) {
    const newFlat = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildTrojanInbound(newFlat))
  }

  const showTrojanQrCode = async (userIndex: number) => {
    try {
      const user = flat.users[userIndex]
      if (!user || !user.password) {
        throw new Error(t("setUserPasswordFirst"))
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

      const params = new URLSearchParams()
      if (flat.tls_server_name) params.set("sni", flat.tls_server_name)
      params.set("allowInsecure", "1")

      if (flat.transport_type !== "tcp") {
        params.set("type", flat.transport_type)
        if (flat.transport_path) params.set("path", flat.transport_path)
        if (flat.transport_type === "grpc" && flat.transport_service_name) {
          params.set("serviceName", flat.transport_service_name)
        }
      }

      const name = user.name || `Trojan-${userIndex + 1}`
      const trojanUrl = `trojan://${encodeURIComponent(user.password)}@${ip}:${flat.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

      onShowQrCode(trojanUrl, "trojan", userIndex)
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
            value={flat.listen}
            onChange={(e) => updateInbound({ listen: e.target.value })}
            className={!isValidListenAddress(flat.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={flat.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, flat.listen_port)
              updateInbound({ listen_port: port })
            }}
            className={!isValidPort(flat.listen_port) ? "border-red-500" : ""}
          />
        </div>
      </div>

      <div className="space-y-4 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">{t("users")}</Label>
            <p className="text-xs text-muted-foreground">{t("usersDesc")}</p>
          </div>
          <Button
            size="sm"
            onClick={() =>
              updateInbound({
                users: [...flat.users, { name: "", password: "" }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {tc("add")}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
          {flat.users.map((user, index) => (
            <div key={index} className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300">
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {index + 1}
                    </div>
                    <Label className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">{user.name || `User ${index + 1}`}</Label>
                  </div>
                  <div className="flex gap-1.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full"
                      onClick={() => showTrojanQrCode(index)}
                      disabled={!user.password}
                      title="Show QR Code"
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    {flat.users.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-full"
                        onClick={() =>
                          updateInbound({
                            users: flat.users.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold ml-1">{t("configuration")}</Label>
                  <div className="space-y-3 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("nameOptional")}</Label>
                      <Input
                        placeholder="Remarks"
                        value={user.name || ""}
                        onChange={(e) => {
                          const users = flat.users.map((u, i) => i === index ? { ...u, name: e.target.value } : u)
                          updateInbound({ users })
                        }}
                        className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{tc("password")}</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder={tc("password")}
                          value={user.password}
                          onChange={(e) => {
                            const users = flat.users.map((u, i) => i === index ? { ...u, password: e.target.value } : u)
                            updateInbound({ users })
                          }}
                          className="flex-1 h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm font-mono focus-visible:ring-primary/20"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 shrink-0 border-zinc-200 dark:border-zinc-800"
                          onClick={() => {
                            const users = flat.users.map((u, i) => i === index ? { ...u, password: generateSecureRandomString(16) } : u)
                            updateInbound({ users })
                          }}
                          title="Generate Password"
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
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-6">
        {/* TLS section */}
        <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500 text-white shadow-sm">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <Label className="text-base font-bold tracking-tight">{t("tlsConfiguration")}</Label>
              <p className="text-xs text-zinc-400 font-medium">Security and encryption settings</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] text-amber-600 hidden sm:inline-block">{t("trojanRequiresTls")}</span>
              <input
                type="checkbox"
                id="trojan-tls-enabled"
                checked={flat.tls_enabled}
                onChange={(e) => updateInbound({ tls_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
              />
            </div>
          </div>

          {flat.tls_enabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="space-y-1.5 ml-1">
                <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">TLS Mode</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select
                    value={flat.tls_mode}
                    onValueChange={(val) => updateInbound({ tls_mode: val as "manual" | "acme" })}
                  >
                    <SelectTrigger className="w-[140px] h-9 bg-zinc-50/80 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{t("manualConfig")}</SelectItem>
                      <SelectItem value="acme">{t("acmeAuto")}</SelectItem>
                    </SelectContent>
                  </Select>

                  {flat.tls_mode === "manual" && (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => onGenerateCert(flat.tls_server_name || undefined)} disabled={certLoading} className="h-9 rounded-lg border-zinc-200 dark:border-zinc-800">
                        <Shield className="h-4 w-4 mr-1.5 text-blue-500" />
                        {certLoading ? t("generating") : t("generateSelfSignedCert")}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => onUploadCert()} disabled={certLoading} className="h-9 rounded-lg border-zinc-200 dark:border-zinc-800">
                        <Upload className="h-4 w-4 mr-1.5 text-zinc-500" />
                        {t("uploadCert")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

            {flat.tls_mode === "acme" ? (
              <div className="space-y-1.5 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                <Label className="text-xs text-zinc-500">{t("acmeDomain")}</Label>
                <Input
                  value={flat.tls_acme_domain}
                  onChange={(e) => updateInbound({ tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                  className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                />
                <p className="text-[10px] text-zinc-400 ml-1">{t("acmeHint")}</p>
              </div>
            ) : (
              <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500">{t("serverNameOptional")}</Label>
                  <Input
                    value={flat.tls_server_name}
                    onChange={(e) => updateInbound({ tls_server_name: e.target.value })}
                    placeholder="example.com"
                    className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500">{t("certPath")}</Label>
                  <Input
                    value={flat.tls_certificate_path}
                    onChange={(e) => updateInbound({ tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                    className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500">{t("keyPath")}</Label>
                  <Input
                    value={flat.tls_key_path}
                    onChange={(e) => updateInbound({ tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                    className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                  />
                </div>
              </div>
            )}
            <div className="space-y-1.5 pt-2 ml-1">
              <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">{t("alpnProtocol")}</Label>
              <Input
                value={flat.tls_alpn}
                onChange={(e) => updateInbound({ tls_alpn: e.target.value })}
                placeholder="h2, http/1.1"
                className="h-9 bg-zinc-50/80 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-sm"
              />
              <p className="text-[10px] text-zinc-400 ml-1">{t("alpnHint")}</p>
            </div>
          </div>
        )}
        </div>

        {/* Transport & Features section */}
        <div className="space-y-6">
          <div className="space-y-4 p-5 rounded-xl border border-border/60 bg-muted/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Shield className="h-4 w-4" /> {/* Kept Shield icon for transport context */}
              </div>
              <div>
                <Label className="text-base font-medium">Transport</Label>
                <p className="text-xs text-muted-foreground">Configure connection transport.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("transportProtocol")}</Label>
                <select
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                  value={flat.transport_type}
                  onChange={(e) => updateInbound({ transport_type: e.target.value })}
                >
                  <option value="tcp">{t("tcpDefault")}</option>
                  <option value="ws">WebSocket</option>
                  <option value="grpc">gRPC</option>
                  <option value="http">HTTP/2</option>
                  <option value="httpupgrade">HTTP Upgrade</option>
                </select>
              </div>

              {flat.transport_type !== "tcp" && (
                <div className="space-y-3 p-3 bg-background rounded-lg border animate-in fade-in">
                  {flat.transport_type === "grpc" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Service Name</Label>
                      <Input
                        value={flat.transport_service_name}
                        onChange={(e) => updateInbound({ transport_service_name: e.target.value })}
                        placeholder="grpc-service"
                        className="h-8 text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Path</Label>
                      <Input
                        value={flat.transport_path}
                        onChange={(e) => updateInbound({ transport_path: e.target.value })}
                        placeholder="/ws-path"
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                  {(flat.transport_type === "http" || flat.transport_type === "httpupgrade") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("host")}</Label>
                      <Input
                        value={flat.transport_host}
                        onChange={(e) => updateInbound({ transport_host: e.target.value })}
                        placeholder="example.com"
                        className="h-8 text-sm"
                      />
                    </div>
                  )}
                  {flat.transport_type === "ws" && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("maxEarlyData")}</Label>
                        <Input
                          type="number"
                          value={flat.ws_max_early_data}
                          onChange={(e) => updateInbound({ ws_max_early_data: parseInt(e.target.value) || 0 })}
                          placeholder="2048"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{t("earlyDataHeader")}</Label>
                        <Input
                          value={flat.ws_early_data_header_name}
                          onChange={(e) => updateInbound({ ws_early_data_header_name: e.target.value })}
                          placeholder="Sec-WebSocket-Protocol"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 p-5 rounded-xl border border-border/60 bg-muted/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-500">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-base font-medium">Trojan Fallback</Label>
                <p className="text-xs text-muted-foreground">{t("trojanFallbackHint")}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fallback Server</Label>
                  <Input
                    value={flat.fallback_server}
                    onChange={(e) => updateInbound({ fallback_server: e.target.value })}
                    placeholder="127.0.0.1"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fallback Port</Label>
                  <Input
                    type="number"
                    min="0"
                    max="65535"
                    value={flat.fallback_server_port || ""}
                    onChange={(e) => updateInbound({ fallback_server_port: parseInt(e.target.value) || 0 })}
                    placeholder={tc("port")}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">{t("trojanFallbackForAlpn")}</Label>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2"
                    onClick={() =>
                      updateInbound({
                        fallback_for_alpn: [...flat.fallback_for_alpn, { alpn: "", server: "", server_port: 0 }],
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {tc("add")}
                  </Button>
                </div>
                {flat.fallback_for_alpn.map((entry, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="ALPN"
                      value={entry.alpn}
                      onChange={(e) => {
                        const newEntries = flat.fallback_for_alpn.map((ent, i) => i === index ? { ...ent, alpn: e.target.value } : ent)
                        updateInbound({ fallback_for_alpn: newEntries })
                      }}
                      className="w-24 h-8 text-sm"
                    />
                    <Input
                      placeholder="127.0.0.1"
                      value={entry.server}
                      onChange={(e) => {
                        const newEntries = flat.fallback_for_alpn.map((ent, i) => i === index ? { ...ent, server: e.target.value } : ent)
                        updateInbound({ fallback_for_alpn: newEntries })
                      }}
                      className="flex-1 h-8 text-sm"
                    />
                    <Input
                      type="number"
                      min="0"
                      max="65535"
                      placeholder={tc("port")}
                      value={entry.server_port || ""}
                      onChange={(e) => {
                        const newEntries = flat.fallback_for_alpn.map((ent, i) => i === index ? { ...ent, server_port: parseInt(e.target.value) || 0 } : ent)
                        updateInbound({ fallback_for_alpn: newEntries })
                      }}
                      className="w-20 h-8 text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        updateInbound({
                          fallback_for_alpn: flat.fallback_for_alpn.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5 rounded-xl border border-border/60 bg-muted/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-500/10 text-orange-500">
                <Shield className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-base font-medium">Multiplex</Label>
                <p className="text-xs text-muted-foreground">Improve connection latency.</p>
              </div>
              <div className="ml-auto">
                <input
                  type="checkbox"
                  id="trojan-multiplex"
                  checked={flat.multiplex_enabled}
                  onChange={(e) => updateInbound({ multiplex_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </div>
            </div>

            {flat.multiplex_enabled && (
              <div className="space-y-3 pt-2 border-t border-border/50 animate-in fade-in">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="trojan-multiplex-padding"
                    checked={flat.multiplex_padding}
                    onChange={(e) => updateInbound({ multiplex_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="trojan-multiplex-padding" className="text-sm">{t("multiplexPadding")}</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="trojan-multiplex-brutal"
                    checked={flat.multiplex_brutal}
                    onChange={(e) => updateInbound({ multiplex_brutal: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="trojan-multiplex-brutal" className="text-sm">{t("enableBrutal")}</Label>
                </div>
                {flat.multiplex_brutal && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-background rounded-lg border">
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("upMbps")}</Label>
                      <Input
                        type="number"
                        value={flat.multiplex_brutal_up}
                        onChange={(e) => updateInbound({ multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">{t("downMbps")}</Label>
                      <Input
                        type="number"
                        value={flat.multiplex_brutal_down}
                        onChange={(e) => updateInbound({ multiplex_brutal_down: parseInt(e.target.value) || 0 })}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
