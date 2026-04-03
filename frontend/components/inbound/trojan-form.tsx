"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Shield, Upload } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, TrojanUser, formatListen, parseListen } from "./types"

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
  const isInitializedRef = useRef(false)

  const [trojanConfig, setTrojanConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ name: "", password: "" }] as TrojanUser[],
    tls_enabled: true,
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    tls_server_name: "",
    transport_type: "tcp" as string,
    transport_path: "",
    transport_service_name: "",
    fallback_server: "",
    fallback_server_port: 0,
    fallback_for_alpn: [] as { alpn: string; server: string; server_port: number }[],
    multiplex_enabled: false,
    multiplex_padding: false,
    multiplex_brutal: false,
    multiplex_brutal_up: 0,
    multiplex_brutal_down: 0,
    tls_alpn: "",
    transport_host: "",
    ws_max_early_data: 0,
    ws_early_data_header_name: "",
  })

  // Load from initialConfig
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!initialConfig || initialConfig.type !== "trojan") {
      isInitializedRef.current = true
      return
    }
    const trojanUsers = (initialConfig.users || []).map((u: any) => ({
      name: u.name || "",
      password: u.password || "",
    }))
    setTrojanConfig({
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
    })
    isInitializedRef.current = true
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    if (!isInitializedRef.current) return
    const trojanUsersBuilt = trojanConfig.users
      .filter((u) => u.password)
      .map((u) => {
        const user: any = { password: u.password }
        if (u.name) user.name = u.name
        return user
      })

    const previewConfig: any = {
      type: "trojan",
      tag: "trojan-in",
      listen: formatListen(trojanConfig.listen),
      listen_port: trojanConfig.listen_port,
      users: trojanUsersBuilt,
    }

    const alpnArr = trojanConfig.tls_alpn ? trojanConfig.tls_alpn.split(",").map(s => s.trim()).filter(Boolean) : []

    if (trojanConfig.tls_enabled) {
      if (trojanConfig.tls_mode === "acme" && trojanConfig.tls_acme_domain) {
        previewConfig.tls = {
          enabled: true,
          acme: {
            domain: [trojanConfig.tls_acme_domain],
            data_directory: "/var/lib/sing-box/acme",
          },
        }
      } else {
        previewConfig.tls = {
          enabled: true,
          certificate_path: trojanConfig.tls_certificate_path,
          key_path: trojanConfig.tls_key_path,
        }
      }
      if (trojanConfig.tls_server_name) {
        previewConfig.tls.server_name = trojanConfig.tls_server_name
      }
      if (alpnArr.length > 0) {
        previewConfig.tls.alpn = alpnArr
      }
    }

    if (trojanConfig.transport_type && trojanConfig.transport_type !== "tcp") {
      previewConfig.transport = { type: trojanConfig.transport_type }
      if (trojanConfig.transport_type === "ws" && trojanConfig.transport_path) {
        previewConfig.transport.path = trojanConfig.transport_path
      }
      if (trojanConfig.transport_type === "grpc" && trojanConfig.transport_service_name) {
        previewConfig.transport.service_name = trojanConfig.transport_service_name
      }
      if (
        (trojanConfig.transport_type === "http" || trojanConfig.transport_type === "httpupgrade") &&
        trojanConfig.transport_path
      ) {
        previewConfig.transport.path = trojanConfig.transport_path
      }
      if (trojanConfig.transport_type === "http" && trojanConfig.transport_host) {
        previewConfig.transport.host = trojanConfig.transport_host.split(",").map((s: string) => s.trim()).filter(Boolean)
      }
      if (trojanConfig.transport_type === "httpupgrade" && trojanConfig.transport_host) {
        previewConfig.transport.host = trojanConfig.transport_host
      }
      if (trojanConfig.transport_type === "ws") {
        if (trojanConfig.ws_max_early_data > 0) {
          previewConfig.transport.max_early_data = trojanConfig.ws_max_early_data
        }
        if (trojanConfig.ws_early_data_header_name) {
          previewConfig.transport.early_data_header_name = trojanConfig.ws_early_data_header_name
        }
      }
    }

    if (trojanConfig.fallback_server && trojanConfig.fallback_server_port > 0) {
      previewConfig.fallback = {
        server: trojanConfig.fallback_server,
        server_port: trojanConfig.fallback_server_port,
      }
    }

    const alpnFallbacks = trojanConfig.fallback_for_alpn.filter((f) => f.alpn && f.server && f.server_port > 0)
    if (alpnFallbacks.length > 0) {
      const fallbackMap: Record<string, { server: string; server_port: number }> = {}
      for (const f of alpnFallbacks) {
        fallbackMap[f.alpn] = { server: f.server, server_port: f.server_port }
      }
      previewConfig.fallback_for_alpn = fallbackMap
    }

    if (trojanConfig.multiplex_enabled) {
      previewConfig.multiplex = { enabled: true, padding: trojanConfig.multiplex_padding } as any
      if (trojanConfig.multiplex_brutal) {
        previewConfig.multiplex.brutal = {
          enabled: true,
          up_mbps: trojanConfig.multiplex_brutal_up,
          down_mbps: trojanConfig.multiplex_brutal_down,
        }
      }
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [trojanConfig, setInbound, clearEndpoints])

  const showTrojanQrCode = async (userIndex: number) => {
    try {
      const user = trojanConfig.users[userIndex]
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

      // Trojan URL format: trojan://password@host:port?params#name
      const params = new URLSearchParams()
      if (trojanConfig.tls_server_name) params.set("sni", trojanConfig.tls_server_name)
      params.set("allowInsecure", "1")

      if (trojanConfig.transport_type !== "tcp") {
        params.set("type", trojanConfig.transport_type)
        if (trojanConfig.transport_path) params.set("path", trojanConfig.transport_path)
        if (trojanConfig.transport_type === "grpc" && trojanConfig.transport_service_name) {
          params.set("serviceName", trojanConfig.transport_service_name)
        }
      }

      const name = user.name || `Trojan-${userIndex + 1}`
      const trojanUrl = `trojan://${encodeURIComponent(user.password)}@${ip}:${trojanConfig.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

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
            value={trojanConfig.listen}
            onChange={(e) => setTrojanConfig({ ...trojanConfig, listen: e.target.value })}
            className={!isValidListenAddress(trojanConfig.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={trojanConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, trojanConfig.listen_port)
              setTrojanConfig({ ...trojanConfig, listen_port: port })
            }}
            className={!isValidPort(trojanConfig.listen_port) ? "border-red-500" : ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("users")}</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setTrojanConfig({
                ...trojanConfig,
                users: [...trojanConfig.users, { name: "", password: "" }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {trojanConfig.users.map((user, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showTrojanQrCode(index)}
                    disabled={!user.password}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  {trojanConfig.users.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setTrojanConfig({
                          ...trojanConfig,
                          users: trojanConfig.users.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Input
                placeholder={t("nameOptional")}
                value={user.name || ""}
                onChange={(e) => {
                  const newUsers = [...trojanConfig.users]
                  newUsers[index].name = e.target.value
                  setTrojanConfig({ ...trojanConfig, users: newUsers })
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder={tc("password")}
                  value={user.password}
                  onChange={(e) => {
                    const newUsers = [...trojanConfig.users]
                    newUsers[index].password = e.target.value
                    setTrojanConfig({ ...trojanConfig, users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...trojanConfig.users]
                    newUsers[index].password = generateSecureRandomString(16)
                    setTrojanConfig({ ...trojanConfig, users: newUsers })
                  }}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* TLS 配置 (Trojan 必须启用 TLS) */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="trojan-tls-enabled"
            checked={trojanConfig.tls_enabled}
            onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="trojan-tls-enabled">{t("enableTls")}</Label>
          <span className="text-xs text-amber-600">{t("trojanRequiresTls")}</span>
        </div>
        {trojanConfig.tls_enabled && (
          <div className="space-y-2 pl-6">
            <div className="flex gap-2 items-center">
              <select
                value={trojanConfig.tls_mode}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_mode: e.target.value as "manual" | "acme" })}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="manual">{t("manualConfig")}</option>
                <option value="acme">{t("acmeAuto")}</option>
              </select>
              {trojanConfig.tls_mode === "manual" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onGenerateCert(trojanConfig.tls_server_name || undefined)}
                    disabled={certLoading}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    {certLoading ? t("generating") : t("generateSelfSignedCert")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onUploadCert()}
                    disabled={certLoading}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    {t("uploadCert")}
                  </Button>
                </>
              )}
            </div>
            {trojanConfig.tls_mode === "acme" ? (
              <div className="space-y-2">
                <Label>{t("acmeDomain")}</Label>
                <Input
                  value={trojanConfig.tls_acme_domain}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={trojanConfig.tls_certificate_path}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={trojanConfig.tls_key_path}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>{t("alpnProtocol")}</Label>
              <Input
                value={trojanConfig.tls_alpn}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_alpn: e.target.value })}
                placeholder="h2, http/1.1"
              />
              <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Transport 配置 */}
      <div className="space-y-2 border-t pt-4">
        <Label>{t("transportProtocol")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={trojanConfig.transport_type}
          onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_type: e.target.value })}
        >
          <option value="tcp">{t("tcpDefault")}</option>
          <option value="ws">WebSocket</option>
          <option value="grpc">gRPC</option>
          <option value="http">HTTP/2</option>
          <option value="httpupgrade">HTTP Upgrade</option>
        </select>
        {trojanConfig.transport_type !== "tcp" && (
          <div className="space-y-2 pt-2">
            {trojanConfig.transport_type === "grpc" ? (
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input
                  value={trojanConfig.transport_service_name}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_service_name: e.target.value })}
                  placeholder="grpc-service"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Path</Label>
                <Input
                  value={trojanConfig.transport_path}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_path: e.target.value })}
                  placeholder="/ws-path"
                />
              </div>
            )}
            {(trojanConfig.transport_type === "http" || trojanConfig.transport_type === "httpupgrade") && (
              <div className="space-y-2">
                <Label>{t("host")}</Label>
                <Input
                  value={trojanConfig.transport_host}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_host: e.target.value })}
                  placeholder="example.com"
                />
              </div>
            )}
            {trojanConfig.transport_type === "ws" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("maxEarlyData")}</Label>
                  <Input
                    type="number"
                    value={trojanConfig.ws_max_early_data}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, ws_max_early_data: parseInt(e.target.value) || 0 })}
                    placeholder="2048"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("earlyDataHeader")}</Label>
                  <Input
                    value={trojanConfig.ws_early_data_header_name}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, ws_early_data_header_name: e.target.value })}
                    placeholder="Sec-WebSocket-Protocol"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fallback */}
      <div className="space-y-2">
        <Label>{t("trojanFallback")}</Label>
        <div className="grid grid-cols-2 gap-4">
          <Input
            value={trojanConfig.fallback_server}
            onChange={(e) => setTrojanConfig({ ...trojanConfig, fallback_server: e.target.value })}
            placeholder="127.0.0.1"
          />
          <Input
            type="number"
            min="0"
            max="65535"
            value={trojanConfig.fallback_server_port || ""}
            onChange={(e) =>
              setTrojanConfig({ ...trojanConfig, fallback_server_port: parseInt(e.target.value) || 0 })
            }
            placeholder={tc("port")}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("trojanFallbackHint")}</p>
      </div>

      {/* Fallback for ALPN */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("trojanFallbackForAlpn")}</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setTrojanConfig({
                ...trojanConfig,
                fallback_for_alpn: [...trojanConfig.fallback_for_alpn, { alpn: "", server: "", server_port: 0 }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>
        {trojanConfig.fallback_for_alpn.map((entry, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              placeholder="ALPN (h2, http/1.1)"
              value={entry.alpn}
              onChange={(e) => {
                const newEntries = [...trojanConfig.fallback_for_alpn]
                newEntries[index] = { ...newEntries[index], alpn: e.target.value }
                setTrojanConfig({ ...trojanConfig, fallback_for_alpn: newEntries })
              }}
              className="w-32"
            />
            <Input
              placeholder="127.0.0.1"
              value={entry.server}
              onChange={(e) => {
                const newEntries = [...trojanConfig.fallback_for_alpn]
                newEntries[index] = { ...newEntries[index], server: e.target.value }
                setTrojanConfig({ ...trojanConfig, fallback_for_alpn: newEntries })
              }}
              className="flex-1"
            />
            <Input
              type="number"
              min="0"
              max="65535"
              placeholder={tc("port")}
              value={entry.server_port || ""}
              onChange={(e) => {
                const newEntries = [...trojanConfig.fallback_for_alpn]
                newEntries[index] = { ...newEntries[index], server_port: parseInt(e.target.value) || 0 }
                setTrojanConfig({ ...trojanConfig, fallback_for_alpn: newEntries })
              }}
              className="w-24"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                setTrojanConfig({
                  ...trojanConfig,
                  fallback_for_alpn: trojanConfig.fallback_for_alpn.filter((_, i) => i !== index),
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("trojanFallbackForAlpnHint")}</p>
      </div>

      {/* Multiplex */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="trojan-multiplex"
            checked={trojanConfig.multiplex_enabled}
            onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="trojan-multiplex">{t("multiplexEnabled")}</Label>
        </div>
        {trojanConfig.multiplex_enabled && (
          <div className="space-y-2 ml-6">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="trojan-multiplex-padding"
                checked={trojanConfig.multiplex_padding}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_padding: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="trojan-multiplex-padding">{t("multiplexPadding")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="trojan-multiplex-brutal"
                checked={trojanConfig.multiplex_brutal}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="trojan-multiplex-brutal">{t("enableBrutal")}</Label>
            </div>
            {trojanConfig.multiplex_brutal && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div className="space-y-2">
                  <Label>{t("upMbps")}</Label>
                  <Input
                    type="number"
                    value={trojanConfig.multiplex_brutal_up}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("downMbps")}</Label>
                  <Input
                    type="number"
                    value={trojanConfig.multiplex_brutal_down}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
