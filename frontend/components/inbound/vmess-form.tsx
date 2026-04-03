"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Shield, Upload, Loader2, CheckCircle, XCircle } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress } from "@/lib/utils"
import { apiClient } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, VMESSUser, formatListen, parseListen, getPublicIP } from "./types"

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
  const isInitializedRef = useRef(false)

  const [vmessConfig, setVmessConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ uuid: "", name: "", alterId: 0 }] as VMESSUser[],
    tls_enabled: false,
    tls_mode: "manual" as "manual" | "acme" | "reality",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    tls_server_name: "",
    tls_alpn: "",
    reality_handshake_server: "",
    reality_handshake_port: 443,
    reality_private_key: "",
    reality_public_key: "",
    reality_short_id: "",
    transport_type: "tcp" as string,
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
  })

  const [tlsCheckState, setTlsCheckState] = useState<{
    loading: boolean
    result?: { supported: boolean; tls_version: string; error?: string }
  }>({ loading: false })

  // Load from initialConfig
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!initialConfig || initialConfig.type !== "vmess") {
      isInitializedRef.current = true
      return
    }
    const vmessUsers = (initialConfig.users || []).map((u: any) => ({
      uuid: u.uuid || "",
      name: u.name || "",
      alterId: u.alter_id ?? u.alterId ?? 0,
    }))
    setVmessConfig({
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
      reality_public_key: "",
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
    })

    if (initialConfig.tls?.reality?.private_key) {
      apiClient
        .deriveRealityPublicKey(initialConfig.tls.reality.private_key)
        .then((res) => {
          setVmessConfig((prev) => ({ ...prev, reality_public_key: res.public_key }))
        })
        .catch(() => console.warn("Failed to derive Reality public key from private key"))
    }

    isInitializedRef.current = true
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    if (!isInitializedRef.current) return
    const vmessUsers = vmessConfig.users
      .filter((u) => u.uuid)
      .map((u) => {
        const user: any = { uuid: u.uuid }
        if (u.name) user.name = u.name
        if (u.alterId) user.alter_id = u.alterId
        return user
      })

    const previewConfig: any = {
      type: "vmess",
      tag: "vmess-in",
      listen: formatListen(vmessConfig.listen),
      listen_port: vmessConfig.listen_port,
      users: vmessUsers,
    }

    if (vmessConfig.tls_enabled) {
      if (vmessConfig.tls_mode === "reality") {
        previewConfig.tls = {
          enabled: true,
          server_name: vmessConfig.tls_server_name || vmessConfig.reality_handshake_server,
          reality: {
            enabled: true,
            handshake: {
              server: vmessConfig.reality_handshake_server,
              server_port: vmessConfig.reality_handshake_port,
            },
            private_key: vmessConfig.reality_private_key,
            short_id: vmessConfig.reality_short_id ? [vmessConfig.reality_short_id] : [""],
            max_time_difference: "1m",
          },
        }
      } else if (vmessConfig.tls_mode === "acme" && vmessConfig.tls_acme_domain) {
        previewConfig.tls = {
          enabled: true,
          acme: {
            domain: [vmessConfig.tls_acme_domain],
            data_directory: "/var/lib/sing-box/acme",
          },
        }
      } else {
        previewConfig.tls = {
          enabled: true,
          certificate_path: vmessConfig.tls_certificate_path,
          key_path: vmessConfig.tls_key_path,
        }
      }
      if (vmessConfig.tls_server_name && vmessConfig.tls_mode !== "reality") {
        previewConfig.tls.server_name = vmessConfig.tls_server_name
      }
      // ALPN
      const alpnList = vmessConfig.tls_alpn
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
      if (alpnList.length > 0) {
        previewConfig.tls.alpn = alpnList
      }
    }

    if (vmessConfig.transport_type && vmessConfig.transport_type !== "tcp") {
      previewConfig.transport = { type: vmessConfig.transport_type }
      if (vmessConfig.transport_type === "ws") {
        if (vmessConfig.transport_path) previewConfig.transport.path = vmessConfig.transport_path
        if (vmessConfig.ws_max_early_data > 0) previewConfig.transport.max_early_data = vmessConfig.ws_max_early_data
        if (vmessConfig.ws_early_data_header_name) previewConfig.transport.early_data_header_name = vmessConfig.ws_early_data_header_name
      }
      if (vmessConfig.transport_type === "grpc" && vmessConfig.transport_service_name) {
        previewConfig.transport.service_name = vmessConfig.transport_service_name
      }
      if (vmessConfig.transport_type === "http") {
        if (vmessConfig.transport_path) previewConfig.transport.path = vmessConfig.transport_path
        const hostList = vmessConfig.transport_host
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        if (hostList.length > 0) previewConfig.transport.host = hostList
      }
      if (vmessConfig.transport_type === "httpupgrade") {
        if (vmessConfig.transport_path) previewConfig.transport.path = vmessConfig.transport_path
        if (vmessConfig.transport_host) previewConfig.transport.host = vmessConfig.transport_host
      }
    }

    if (vmessConfig.multiplex_enabled) {
      previewConfig.multiplex = { enabled: true, padding: vmessConfig.multiplex_padding }
      if (vmessConfig.multiplex_brutal && vmessConfig.multiplex_brutal_up > 0 && vmessConfig.multiplex_brutal_down > 0) {
        previewConfig.multiplex.brutal = {
          enabled: true,
          up_mbps: vmessConfig.multiplex_brutal_up,
          down_mbps: vmessConfig.multiplex_brutal_down,
        }
      }
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [vmessConfig, setInbound, clearEndpoints])

  const showVmessQrCode = async (userIndex: number) => {
    try {
      const user = vmessConfig.users[userIndex]
      if (!user || !user.uuid) {
        throw new Error(t("setUuidFirst"))
      }

      const ip = await getPublicIP(serverIP, setServerIP)

      // VMess URL format (v2rayN standard)
      const vmessObj: any = {
        v: "2",
        ps: user.name || `VMess-${userIndex + 1}`,
        add: ip,
        port: String(vmessConfig.listen_port),
        id: user.uuid,
        aid: String(user.alterId || 0),
        scy: "auto",
        net: vmessConfig.transport_type === "tcp" ? "tcp" : vmessConfig.transport_type,
        type: "none",
        host: "",
        path: vmessConfig.transport_path || "",
        tls: vmessConfig.tls_enabled ? (vmessConfig.tls_mode === "reality" ? "reality" : "tls") : "",
        sni: vmessConfig.tls_server_name || "",
      }

      if (vmessConfig.transport_type === "grpc") {
        vmessObj.path = vmessConfig.transport_service_name || ""
      }
      if (vmessConfig.transport_type === "http" || vmessConfig.transport_type === "httpupgrade") {
        vmessObj.host = vmessConfig.transport_host || ""
      }
      if (vmessConfig.tls_alpn) {
        vmessObj.alpn = vmessConfig.tls_alpn
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
            value={vmessConfig.listen}
            onChange={(e) => setVmessConfig({ ...vmessConfig, listen: e.target.value })}
            className={!isValidListenAddress(vmessConfig.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={vmessConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, vmessConfig.listen_port)
              setVmessConfig({ ...vmessConfig, listen_port: port })
            }}
            className={!isValidPort(vmessConfig.listen_port) ? "border-red-500" : ""}
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
              setVmessConfig({
                ...vmessConfig,
                users: [...vmessConfig.users, { uuid: "", name: "", alterId: 0 }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {vmessConfig.users.map((user, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showVmessQrCode(index)}
                    disabled={!user.uuid}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  {vmessConfig.users.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setVmessConfig({
                          ...vmessConfig,
                          users: vmessConfig.users.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="UUID"
                  value={user.uuid}
                  onChange={(e) => {
                    const newUsers = [...vmessConfig.users]
                    newUsers[index].uuid = e.target.value
                    setVmessConfig({ ...vmessConfig, users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...vmessConfig.users]
                    newUsers[index].uuid = crypto.randomUUID()
                    setVmessConfig({ ...vmessConfig, users: newUsers })
                  }}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder={t("nameOptional")}
                value={user.name || ""}
                onChange={(e) => {
                  const newUsers = [...vmessConfig.users]
                  newUsers[index].name = e.target.value
                  setVmessConfig({ ...vmessConfig, users: newUsers })
                }}
              />
              <div className="space-y-1">
                <Label className="text-xs">{t("alterIdHint")}</Label>
                <Input
                  type="number"
                  min="0"
                  value={user.alterId || 0}
                  onChange={(e) => {
                    const newUsers = [...vmessConfig.users]
                    newUsers[index].alterId = parseInt(e.target.value) || 0
                    setVmessConfig({ ...vmessConfig, users: newUsers })
                  }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* TLS */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="vmess-tls-enabled"
            checked={vmessConfig.tls_enabled}
            onChange={(e) => setVmessConfig({ ...vmessConfig, tls_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="vmess-tls-enabled">{t("enableTls")}</Label>
        </div>
        {vmessConfig.tls_enabled && (
          <div className="space-y-2 pl-6">
            <div className="flex gap-2 items-center">
              <select
                value={vmessConfig.tls_mode}
                onChange={(e) =>
                  setVmessConfig({ ...vmessConfig, tls_mode: e.target.value as "manual" | "acme" | "reality" })
                }
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="manual">{t("manualConfig")}</option>
                <option value="acme">{t("acmeAuto")}</option>
                <option value="reality">Reality</option>
              </select>
              {vmessConfig.tls_mode === "manual" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onGenerateCert(vmessConfig.tls_server_name || undefined)}
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
              {certInfo && vmessConfig.tls_mode === "manual" && (
                <span className="text-xs text-muted-foreground self-center">
                  {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                </span>
              )}
            </div>

            {vmessConfig.tls_mode === "reality" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("realityHandshakeServer")}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={vmessConfig.reality_handshake_server}
                        onChange={(e) => {
                          const server = e.target.value
                          const updates: any = { reality_handshake_server: server }
                          if (
                            !vmessConfig.tls_server_name ||
                            vmessConfig.tls_server_name === vmessConfig.reality_handshake_server
                          ) {
                            updates.tls_server_name = server
                          }
                          setVmessConfig({ ...vmessConfig, ...updates })
                          setTlsCheckState({ loading: false })
                        }}
                        placeholder="www.example.com"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={!vmessConfig.reality_handshake_server || tlsCheckState.loading}
                        onClick={async () => {
                          setTlsCheckState({ loading: true })
                          try {
                            const res = await apiClient.checkTls13Support(
                              vmessConfig.reality_handshake_server,
                              vmessConfig.reality_handshake_port
                            )
                            setTlsCheckState({ loading: false, result: res })
                          } catch {
                            setTlsCheckState({
                              loading: false,
                              result: { supported: false, tls_version: "", error: t("tlsCheckFailed") },
                            })
                          }
                        }}
                      >
                        {tlsCheckState.loading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          t("tlsCheck")
                        )}
                      </Button>
                    </div>
                    {tlsCheckState.result && (
                      <p
                        className={`text-xs flex items-center gap-1 ${
                          tlsCheckState.result.supported ? "text-green-600" : "text-red-500"
                        }`}
                      >
                        {tlsCheckState.result.supported ? (
                          <>
                            <CheckCircle className="h-3 w-3" /> {t("tlsCheckPass")} ({tlsCheckState.result.tls_version})
                          </>
                        ) : (
                          <>
                            <XCircle className="h-3 w-3" />{" "}
                            {tlsCheckState.result.error ||
                              `${t("tlsCheckFail")} (${tlsCheckState.result.tls_version || "N/A"})`}
                          </>
                        )}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>{t("realityHandshakePort")}</Label>
                    <Input
                      type="number"
                      min="1"
                      max="65535"
                      value={vmessConfig.reality_handshake_port}
                      onChange={(e) => {
                        const port = parsePort(e.target.value, vmessConfig.reality_handshake_port)
                        setVmessConfig({ ...vmessConfig, reality_handshake_port: port })
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SNI ({t("serverNameOptional")})</Label>
                  <Input
                    value={vmessConfig.tls_server_name}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, tls_server_name: e.target.value })}
                    placeholder={vmessConfig.reality_handshake_server || "example.com"}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>{t("realityPrivateKey")}</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const response = await apiClient.generateRealityKeypair()
                          if (response.private_key) {
                            const shortIdBytes = new Uint8Array(8)
                            crypto.getRandomValues(shortIdBytes)
                            const shortId = Array.from(shortIdBytes)
                              .map((b) => b.toString(16).padStart(2, "0"))
                              .join("")
                            setVmessConfig((prev) => ({
                              ...prev,
                              reality_private_key: response.private_key,
                              reality_public_key: response.public_key || "",
                              reality_short_id: prev.reality_short_id || shortId,
                            }))
                            if (response.public_key) {
                              try {
                                await navigator.clipboard.writeText(response.public_key)
                              } catch {
                                // clipboard may fail in non-HTTPS contexts
                              }
                            }
                          }
                        } catch {
                          onError(t("generateKeysFailed"))
                        }
                      }}
                    >
                      <Key className="h-4 w-4 mr-1" />
                      {t("generateKeys")}
                    </Button>
                  </div>
                  <Input
                    value={vmessConfig.reality_private_key}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, reality_private_key: e.target.value })}
                    placeholder="Private Key"
                  />
                  {vmessConfig.reality_public_key && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">{t("publicKey")}:</Label>
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {vmessConfig.reality_public_key}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(vmessConfig.reality_public_key)
                            onError(t("keyCopied"))
                            setTimeout(() => onError(""), 3000)
                          } catch {
                            // fallback
                          }
                        }}
                      >
                        {t("copyPublicKey")}
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("realityShortId")}</Label>
                  <Input
                    value={vmessConfig.reality_short_id}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, reality_short_id: e.target.value })}
                    placeholder="0123456789abcdef"
                  />
                  <p className="text-xs text-muted-foreground">{t("realityShortIdHint")}</p>
                </div>
              </div>
            ) : vmessConfig.tls_mode === "acme" ? (
              <div className="space-y-2">
                <Label>{t("acmeDomain")}</Label>
                <Input
                  value={vmessConfig.tls_acme_domain}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("serverNameOptional")}</Label>
                  <Input
                    value={vmessConfig.tls_server_name}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, tls_server_name: e.target.value })}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={vmessConfig.tls_certificate_path}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={vmessConfig.tls_key_path}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </>
            )}

            {/* ALPN */}
            <div className="space-y-2">
              <Label>{t("alpnProtocol")}</Label>
              <Input
                value={vmessConfig.tls_alpn}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_alpn: e.target.value })}
                placeholder="h2, http/1.1"
              />
              <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
            </div>
          </div>
        )}
      </div>

      {/* Transport */}
      <div className="space-y-2 border-t pt-4">
        <Label>{t("transportProtocol")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={vmessConfig.transport_type}
          onChange={(e) => setVmessConfig({ ...vmessConfig, transport_type: e.target.value })}
        >
          <option value="tcp">{t("tcpDefault")}</option>
          <option value="ws">WebSocket</option>
          <option value="grpc">gRPC</option>
          <option value="http">HTTP/2</option>
          <option value="httpupgrade">HTTP Upgrade</option>
        </select>
        {vmessConfig.transport_type !== "tcp" && (
          <div className="space-y-2 pt-2">
            {vmessConfig.transport_type === "grpc" ? (
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input
                  value={vmessConfig.transport_service_name}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, transport_service_name: e.target.value })}
                  placeholder="grpc-service"
                />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Path</Label>
                  <Input
                    value={vmessConfig.transport_path}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, transport_path: e.target.value })}
                    placeholder="/ws-path"
                  />
                </div>
                {/* Host for HTTP/2 and HTTPUpgrade */}
                {(vmessConfig.transport_type === "http" || vmessConfig.transport_type === "httpupgrade") && (
                  <div className="space-y-2">
                    <Label>{t("host")}</Label>
                    <Input
                      value={vmessConfig.transport_host}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, transport_host: e.target.value })}
                      placeholder={vmessConfig.transport_type === "http" ? "example.com, www.example.com" : "example.com"}
                    />
                    {vmessConfig.transport_type === "http" && (
                      <p className="text-xs text-muted-foreground">H2 host, {t("alpnHint")}</p>
                    )}
                  </div>
                )}
                {/* WebSocket early data */}
                {vmessConfig.transport_type === "ws" && (
                  <>
                    <div className="space-y-2">
                      <Label>{t("maxEarlyData")}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={vmessConfig.ws_max_early_data}
                        onChange={(e) =>
                          setVmessConfig({ ...vmessConfig, ws_max_early_data: parseInt(e.target.value) || 0 })
                        }
                        placeholder="2048"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("earlyDataHeader")}</Label>
                      <Input
                        value={vmessConfig.ws_early_data_header_name}
                        onChange={(e) =>
                          setVmessConfig({ ...vmessConfig, ws_early_data_header_name: e.target.value })
                        }
                        placeholder="Sec-WebSocket-Protocol"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Multiplex */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="vmess-multiplex"
            checked={vmessConfig.multiplex_enabled}
            onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="vmess-multiplex">{t("multiplexEnabled")}</Label>
        </div>
        {vmessConfig.multiplex_enabled && (
          <div className="space-y-2 ml-6">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="vmess-multiplex-padding"
                checked={vmessConfig.multiplex_padding}
                onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_padding: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="vmess-multiplex-padding">{t("multiplexPadding")}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="vmess-multiplex-brutal"
                checked={vmessConfig.multiplex_brutal}
                onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_brutal: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="vmess-multiplex-brutal">{t("enableBrutal")}</Label>
            </div>
            {vmessConfig.multiplex_brutal && (
              <div className="grid grid-cols-2 gap-4 ml-6">
                <div className="space-y-2">
                  <Label>{t("upMbps")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={vmessConfig.multiplex_brutal_up || ""}
                    onChange={(e) =>
                      setVmessConfig({ ...vmessConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })
                    }
                    placeholder="100"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("downMbps")}</Label>
                  <Input
                    type="number"
                    min="1"
                    value={vmessConfig.multiplex_brutal_down || ""}
                    onChange={(e) =>
                      setVmessConfig({ ...vmessConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })
                    }
                    placeholder="100"
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
