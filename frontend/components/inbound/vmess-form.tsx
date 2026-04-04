"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, Key, QrCode, Shield, Upload, Loader2, CheckCircle, XCircle, Network, Layers, Copy } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress } from "@/lib/utils"
import { apiClient } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, VMESSUser, formatListen, parseListen, getPublicIP } from "./types"

interface VmessFlat {
  listen: string
  listen_port: number
  users: VMESSUser[]
  tls_enabled: boolean
  tls_mode: "manual" | "acme" | "reality"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
  tls_server_name: string
  tls_alpn: string
  reality_handshake_server: string
  reality_handshake_port: number
  reality_private_key: string
  reality_short_id: string
  transport_type: string
  transport_path: string
  transport_service_name: string
  transport_host: string
  ws_max_early_data: number
  ws_early_data_header_name: string
  multiplex_enabled: boolean
  multiplex_padding: boolean
  multiplex_brutal: boolean
  multiplex_brutal_up: number
  multiplex_brutal_down: number
}

function deriveFlat(initialConfig: any): VmessFlat {
  if (!initialConfig || initialConfig.type !== "vmess") {
    return {
      listen: "0.0.0.0",
      listen_port: 443,
      users: [{ uuid: "", name: "", alterId: 0 }],
      tls_enabled: false,
      tls_mode: "manual",
      tls_acme_domain: "",
      tls_certificate_path: "/etc/sing-box/cert.pem",
      tls_key_path: "/etc/sing-box/key.pem",
      tls_server_name: "",
      tls_alpn: "",
      reality_handshake_server: "",
      reality_handshake_port: 443,
      reality_private_key: "",
      reality_short_id: "",
      transport_type: "tcp",
      transport_path: "",
      transport_service_name: "",
      transport_host: "",
      ws_max_early_data: 0,
      ws_early_data_header_name: "",
      multiplex_enabled: false,
      multiplex_padding: false,
      multiplex_brutal: false,
      multiplex_brutal_up: 0,
      multiplex_brutal_down: 0,
    }
  }
  const vmessUsers = (initialConfig.users || []).map((u: any) => ({
    uuid: u.uuid || "",
    name: u.name || "",
    alterId: u.alter_id ?? u.alterId ?? 0,
  }))
  return {
    listen: parseListen(initialConfig.listen),
    listen_port: initialConfig.listen_port || 443,
    users: vmessUsers.length > 0 ? vmessUsers : [{ uuid: "", name: "", alterId: 0 }],
    tls_enabled: initialConfig.tls?.enabled || false,
    tls_mode: initialConfig.tls?.reality?.enabled
      ? "reality"
      : (initialConfig.tls?.acme?.domain?.length ?? 0) > 0
      ? "acme"
      : "manual",
    tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
    tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
    tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
    tls_server_name: initialConfig.tls?.server_name || "",
    tls_alpn: (initialConfig.tls?.alpn || []).join(", "),
    reality_handshake_server: initialConfig.tls?.reality?.handshake?.server || "",
    reality_handshake_port: initialConfig.tls?.reality?.handshake?.server_port || 443,
    reality_private_key: initialConfig.tls?.reality?.private_key || "",
    reality_short_id: initialConfig.tls?.reality?.short_id?.[0] || "",
    transport_type: initialConfig.transport?.type || "tcp",
    transport_path: initialConfig.transport?.path || "",
    transport_service_name: initialConfig.transport?.service_name || "",
    transport_host: Array.isArray(initialConfig.transport?.host)
      ? initialConfig.transport.host.join(", ")
      : initialConfig.transport?.host || "",
    ws_max_early_data: initialConfig.transport?.max_early_data || 0,
    ws_early_data_header_name: initialConfig.transport?.early_data_header_name || "",
    multiplex_enabled: initialConfig.multiplex?.enabled || false,
    multiplex_padding: initialConfig.multiplex?.padding || false,
    multiplex_brutal: initialConfig.multiplex?.brutal?.enabled || false,
    multiplex_brutal_up: initialConfig.multiplex?.brutal?.up_mbps || 0,
    multiplex_brutal_down: initialConfig.multiplex?.brutal?.down_mbps || 0,
  }
}

function buildVmessInbound(flat: VmessFlat): any {
  const vmessUsers = flat.users
    .filter((u) => u.uuid)
    .map((u) => {
      const user: any = { uuid: u.uuid }
      if (u.name) user.name = u.name
      if (u.alterId) user.alterId = u.alterId
      return user
    })

  const previewConfig: any = {
    type: "vmess",
    tag: "vmess-in",
    listen: formatListen(flat.listen),
    listen_port: flat.listen_port,
    users: vmessUsers,
  }

  if (flat.tls_enabled) {
    if (flat.tls_mode === "reality") {
      previewConfig.tls = {
        enabled: true,
        server_name: flat.tls_server_name || flat.reality_handshake_server,
        reality: {
          enabled: true,
          handshake: {
            server: flat.reality_handshake_server,
            server_port: flat.reality_handshake_port,
          },
          private_key: flat.reality_private_key,
          short_id: flat.reality_short_id ? [flat.reality_short_id] : [""],
          max_time_difference: "1m",
        },
      }
    } else if (flat.tls_mode === "acme" && flat.tls_acme_domain) {
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
    if (flat.tls_server_name && flat.tls_mode !== "reality") {
      previewConfig.tls.server_name = flat.tls_server_name
    }
    const alpnList = flat.tls_alpn
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    if (alpnList.length > 0) {
      previewConfig.tls.alpn = alpnList
    }
  }

  if (flat.transport_type && flat.transport_type !== "tcp") {
    previewConfig.transport = { type: flat.transport_type }
    if (flat.transport_type === "ws") {
      if (flat.transport_path) previewConfig.transport.path = flat.transport_path
      if (flat.ws_max_early_data > 0) previewConfig.transport.max_early_data = flat.ws_max_early_data
      if (flat.ws_early_data_header_name) previewConfig.transport.early_data_header_name = flat.ws_early_data_header_name
    }
    if (flat.transport_type === "grpc" && flat.transport_service_name) {
      previewConfig.transport.service_name = flat.transport_service_name
    }
    if (flat.transport_type === "http") {
      if (flat.transport_path) previewConfig.transport.path = flat.transport_path
      const hostList = flat.transport_host
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      if (hostList.length > 0) previewConfig.transport.host = hostList
    }
    if (flat.transport_type === "httpupgrade") {
      if (flat.transport_path) previewConfig.transport.path = flat.transport_path
      if (flat.transport_host) previewConfig.transport.host = flat.transport_host
    }
  }

  if (flat.multiplex_enabled) {
    previewConfig.multiplex = { enabled: true, padding: flat.multiplex_padding }
    if (flat.multiplex_brutal && flat.multiplex_brutal_up > 0 && flat.multiplex_brutal_down > 0) {
      previewConfig.multiplex.brutal = {
        enabled: true,
        up_mbps: flat.multiplex_brutal_up,
        down_mbps: flat.multiplex_brutal_down,
      }
    }
  }

  return previewConfig
}

export function VmessForm({
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

  const [realityPublicKey, setRealityPublicKey] = useState("")
  const [tlsCheckState, setTlsCheckState] = useState<{
    loading: boolean
    result?: { supported: boolean; tls_version: string; error?: string }
  }>({ loading: false })

  useEffect(() => {
    if (!flat.reality_private_key) { setRealityPublicKey(""); return }
    apiClient.deriveRealityPublicKey(flat.reality_private_key)
      .then(res => setRealityPublicKey(res.public_key))
      .catch(() => setRealityPublicKey(""))
  }, [flat.reality_private_key])

  function updateInbound(patch: Partial<VmessFlat>) {
    const newFlat = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildVmessInbound(newFlat))
  }

  const showVmessQrCode = async (userIndex: number) => {
    try {
      const user = flat.users[userIndex]
      if (!user || !user.uuid) {
        throw new Error(t("setUuidFirst"))
      }

      const ip = await getPublicIP(serverIP, setServerIP)

      const vmessObj: any = {
        v: "2",
        ps: user.name || `VMess-${userIndex + 1}`,
        add: ip,
        port: String(flat.listen_port),
        id: user.uuid,
        aid: String(user.alterId || 0),
        scy: "auto",
        net: flat.transport_type === "tcp" ? "tcp" : flat.transport_type,
        type: "none",
        host: "",
        path: flat.transport_path || "",
        tls: flat.tls_enabled ? (flat.tls_mode === "reality" ? "reality" : "tls") : "",
        sni: flat.tls_server_name || "",
      }

      if (flat.transport_type === "grpc") {
        vmessObj.path = flat.transport_service_name || ""
      }
      if (flat.transport_type === "http" || flat.transport_type === "httpupgrade") {
        vmessObj.host = flat.transport_host || ""
      }
      if (flat.tls_alpn) {
        vmessObj.alpn = flat.tls_alpn
      }

      const vmessUrl = `vmess://${btoa(JSON.stringify(vmessObj))}`
      onShowQrCode(vmessUrl, "vmess", userIndex)
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
                users: [...flat.users, { uuid: "", name: "", alterId: 0 }],
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
                      onClick={() => showVmessQrCode(index)}
                      disabled={!user.uuid}
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
                      <Label className="text-xs text-zinc-500">UUID</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. 12345678-1234..."
                          value={user.uuid}
                          onChange={(e) => {
                            const users = flat.users.map((u, i) => i === index ? { ...u, uuid: e.target.value } : u)
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
                            const users = flat.users.map((u, i) => i === index ? { ...u, uuid: crypto.randomUUID() } : u)
                            updateInbound({ users })
                          }}
                        >
                          <Key className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
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
                        <Label className="text-xs text-zinc-500">{t("alterIdHint")}</Label>
                        <Input
                          type="number"
                          min="0"
                          value={user.alterId || 0}
                          onChange={(e) => {
                            const users = flat.users.map((u, i) => i === index ? { ...u, alterId: parseInt(e.target.value) || 0 } : u)
                            updateInbound({ users })
                          }}
                          className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                        />
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
            <div className="ml-auto">
              <input
                type="checkbox"
                id="vmess-tls-enabled"
                checked={flat.tls_enabled}
                onChange={(e) => updateInbound({ tls_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
              />
            </div>
          </div>

          {flat.tls_enabled && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
              <div className="space-y-1.5 ml-1">
                <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Security Mode</Label>
                <div className="flex flex-wrap gap-2 items-center">
                  <Select
                    value={flat.tls_mode}
                    onValueChange={(val) => updateInbound({ tls_mode: val as "manual" | "acme" | "reality" })}
                  >
                    <SelectTrigger className="w-[140px] h-9 bg-zinc-50/80 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="Mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">{t("manualConfig")}</SelectItem>
                      <SelectItem value="acme">{t("acmeAuto")}</SelectItem>
                      <SelectItem value="reality">Reality</SelectItem>
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
                {certInfo && flat.tls_mode === "manual" && (
                  <p className="text-[10px] text-emerald-600 font-medium mt-1 ml-1 bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                    {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                  </p>
                )}
              </div>

              {flat.tls_mode === "reality" ? (
                <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("realityHandshakeServer")}</Label>
                      <div className="flex gap-1.5">
                        <Input
                          value={flat.reality_handshake_server}
                          onChange={(e) => {
                            const server = e.target.value
                            const updates: Partial<VmessFlat> = { reality_handshake_server: server }
                            if (!flat.tls_server_name || flat.tls_server_name === flat.reality_handshake_server) {
                              updates.tls_server_name = server
                            }
                            updateInbound(updates)
                            setTlsCheckState({ loading: false })
                          }}
                          placeholder="www.example.com"
                          className="h-8 text-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 h-8 px-2 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                          disabled={!flat.reality_handshake_server || tlsCheckState.loading}
                          onClick={async () => {
                            setTlsCheckState({ loading: true })
                            try {
                              const res = await apiClient.checkTls13Support(flat.reality_handshake_server, flat.reality_handshake_port)
                              setTlsCheckState({ loading: false, result: res })
                            } catch {
                              setTlsCheckState({ loading: false, result: { supported: false, tls_version: "", error: t("tlsCheckFailed") } })
                            }
                          }}
                        >
                          {tlsCheckState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : t("tlsCheck")}
                        </Button>
                      </div>
                      {tlsCheckState.result && (
                        <p className={`text-[10px] flex items-center gap-1 mt-1 ${tlsCheckState.result.supported ? "text-emerald-600" : "text-rose-500"}`}>
                          {tlsCheckState.result.supported ? <><CheckCircle className="h-3 w-3" /> {t("tlsCheckPass")} ({tlsCheckState.result.tls_version})</> : <><XCircle className="h-3 w-3" /> {tlsCheckState.result.error || `${t("tlsCheckFail")} (${tlsCheckState.result.tls_version || "N/A"})`}</>}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("realityHandshakePort")}</Label>
                      <Input
                        type="number"
                        min="1"
                        max="65535"
                        value={flat.reality_handshake_port}
                        onChange={(e) => updateInbound({ reality_handshake_port: parsePort(e.target.value, flat.reality_handshake_port) })}
                        className="h-8 text-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-500">SNI ({t("serverNameOptional")})</Label>
                    <Input
                      value={flat.tls_server_name}
                      onChange={(e) => updateInbound({ tls_server_name: e.target.value })}
                      placeholder={flat.reality_handshake_server || "example.com"}
                      className="h-8 text-sm bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-zinc-500">{t("realityPrivateKey")}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-primary hover:bg-primary/5 rounded-md"
                        onClick={async () => {
                        try {
                          const response = await apiClient.generateRealityKeypair()
                          if (response.private_key) {
                            const shortIdBytes = new Uint8Array(8)
                            crypto.getRandomValues(shortIdBytes)
                            const shortId = Array.from(shortIdBytes)
                              .map((b) => b.toString(16).padStart(2, "0"))
                              .join("")
                            setRealityPublicKey(response.public_key || "")
                            updateInbound({
                              reality_private_key: response.private_key,
                              reality_short_id: flat.reality_short_id || shortId,
                            })
                            if (response.public_key) {
                              try {
                                await navigator.clipboard.writeText(response.public_key)
                              } catch {
                              }
                            }
                          }
                        } catch {
                          onError(t("generateKeysFailed"))
                        }
                      }}
                    >
                      <Key className="h-3 w-3 mr-1" />
                      {t("generateKeys")}
                    </Button>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Input
                      value={flat.reality_private_key}
                      onChange={(e) => updateInbound({ reality_private_key: e.target.value })}
                      placeholder="Private Key"
                      className="h-8 text-sm flex-1 font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  {realityPublicKey && (
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 mt-1">
                      <Label className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">{t("publicKey")}</Label>
                      <div className="flex gap-2 items-center w-full">
                        <code className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-1.5 rounded-lg flex-1 truncate select-all font-mono text-zinc-600 dark:text-zinc-400">
                          {realityPublicKey}
                        </code>
                        <Button
                          type="button"
                          variant="secondary"
                          size="icon"
                          className="h-7 w-7 shrink-0 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(realityPublicKey)
                              onError(t("keyCopied"))
                              setTimeout(() => onError(""), 3000)
                            } catch {
                            }
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500">{t("realityShortId")}</Label>
                  <Input
                    value={flat.reality_short_id}
                    onChange={(e) => updateInbound({ reality_short_id: e.target.value })}
                    placeholder="0123456789abcdef"
                    className="h-8 text-sm font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                  />
                  <p className="text-[10px] text-zinc-400 ml-1">{t("realityShortIdHint")}</p>
                </div>
              </div>
            ) : flat.tls_mode === "acme" ? (
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
                <div className="grid grid-cols-1 gap-3">
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

        {/* Transport & Multiplex section */}
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500 text-white shadow-sm">
                <Network className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-base font-bold tracking-tight">Transport</Label>
                <p className="text-xs text-zinc-400 font-medium">Protocol and path settings</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 ml-1">
                <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">{t("transportProtocol")}</Label>
                <Select
                  value={flat.transport_type}
                  onValueChange={(val) => updateInbound({ transport_type: val })}
                >
                  <SelectTrigger className="h-9 bg-zinc-50/80 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tcp">{t("tcpDefault")}</SelectItem>
                    <SelectItem value="ws">WebSocket</SelectItem>
                    <SelectItem value="grpc">gRPC</SelectItem>
                    <SelectItem value="http">HTTP/2</SelectItem>
                    <SelectItem value="httpupgrade">HTTP Upgrade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {flat.transport_type !== "tcp" && (
                <div className="space-y-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1">
                  {flat.transport_type === "grpc" ? (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">Service Name</Label>
                      <Input
                        value={flat.transport_service_name}
                        onChange={(e) => updateInbound({ transport_service_name: e.target.value })}
                        placeholder="grpc-service"
                        className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">Path</Label>
                      <Input
                        value={flat.transport_path}
                        onChange={(e) => updateInbound({ transport_path: e.target.value })}
                        placeholder="/ws-path"
                        className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                      />
                    </div>
                  )}
                  {(flat.transport_type === "http" || flat.transport_type === "httpupgrade") && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("host")}</Label>
                      <Input
                        value={flat.transport_host}
                        onChange={(e) => updateInbound({ transport_host: e.target.value })}
                        placeholder="example.com"
                        className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                      />
                    </div>
                  )}
                  {flat.transport_type === "ws" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{t("maxEarlyData")}</Label>
                        <Input
                          type="number"
                          value={flat.ws_max_early_data}
                          onChange={(e) => updateInbound({ ws_max_early_data: parseInt(e.target.value) || 0 })}
                          placeholder="2048"
                          className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{t("earlyDataHeader")}</Label>
                        <Input
                          value={flat.ws_early_data_header_name}
                          onChange={(e) => updateInbound({ ws_early_data_header_name: e.target.value })}
                          placeholder="Sec-WebSocket-Protocol"
                          className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-orange-500 text-white shadow-sm">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <Label className="text-base font-bold tracking-tight">Multiplex</Label>
                <p className="text-xs text-zinc-400 font-medium">Performance and latency optimization</p>
              </div>
              <div className="ml-auto">
                <input
                  type="checkbox"
                  id="vmess-multiplex"
                  checked={flat.multiplex_enabled}
                  onChange={(e) => updateInbound({ multiplex_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
                />
              </div>
            </div>

            {flat.multiplex_enabled && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="flex flex-wrap gap-4 ml-1">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="vmess-multiplex-padding"
                      checked={flat.multiplex_padding}
                      onChange={(e) => updateInbound({ multiplex_padding: e.target.checked })}
                      className="h-4 w-4 rounded border-zinc-300 text-primary"
                    />
                    <Label htmlFor="vmess-multiplex-padding" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("multiplexPadding")}</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="vmess-multiplex-brutal"
                      checked={flat.multiplex_brutal}
                      onChange={(e) => updateInbound({ multiplex_brutal: e.target.checked })}
                      className="h-4 w-4 rounded border-zinc-300 text-primary"
                    />
                    <Label htmlFor="vmess-multiplex-brutal" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{t("enableBrutal")}</Label>
                  </div>
                </div>

                {flat.multiplex_brutal && (
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("upMbps")}</Label>
                      <Input
                        type="number"
                        value={flat.multiplex_brutal_up}
                        onChange={(e) => updateInbound({ multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                        className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("downMbps")}</Label>
                      <Input
                        type="number"
                        value={flat.multiplex_brutal_down}
                        onChange={(e) => updateInbound({ multiplex_brutal_down: parseInt(e.target.value) || 0 })}
                        className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm"
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
