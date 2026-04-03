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
import { ProtocolFormProps, VLESSUser, formatListen, parseListen, getPublicIP } from "./types"

export function VlessForm({
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

  const [vlessConfig, setVlessConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ uuid: "", name: "", flow: "" }] as VLESSUser[],
    tls_enabled: false,
    tls_mode: "manual" as "manual" | "acme" | "reality",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    tls_server_name: "",
    reality_handshake_server: "",
    reality_handshake_port: 443,
    reality_private_key: "",
    reality_public_key: "",
    reality_short_id: "",
    transport_type: "tcp" as string,
    transport_path: "",
    transport_service_name: "",
    multiplex_enabled: false,
    multiplex_padding: false,
  })

  const [tlsCheckState, setTlsCheckState] = useState<{
    loading: boolean
    result?: { supported: boolean; tls_version: string; error?: string }
  }>({ loading: false })

  // Loading useEffect
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!initialConfig || initialConfig.type !== "vless") {
      isInitializedRef.current = true
      return
    }

    const vlessUsers = (initialConfig.users || []).map((u: any) => ({
      uuid: u.uuid || "",
      name: u.name || "",
      flow: u.flow || "",
    }))
    setVlessConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 443,
      users: vlessUsers.length > 0 ? vlessUsers : [{ uuid: "", name: "", flow: "" }],
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
      reality_handshake_server: initialConfig.tls?.reality?.handshake?.server || "",
      reality_handshake_port: initialConfig.tls?.reality?.handshake?.server_port || 443,
      reality_private_key: initialConfig.tls?.reality?.private_key || "",
      reality_public_key: "",
      reality_short_id: initialConfig.tls?.reality?.short_id?.[0] || "",
      transport_type: initialConfig.transport?.type || "tcp",
      transport_path: initialConfig.transport?.path || "",
      transport_service_name: initialConfig.transport?.service_name || "",
      multiplex_enabled: initialConfig.multiplex?.enabled || false,
      multiplex_padding: initialConfig.multiplex?.padding || false,
    })

    if (initialConfig.tls?.reality?.private_key) {
      apiClient
        .deriveRealityPublicKey(initialConfig.tls.reality.private_key)
        .then((res) => {
          setVlessConfig((prev) => ({ ...prev, reality_public_key: res.public_key }))
        })
        .catch(() => console.warn("Failed to derive Reality public key from private key"))
    }

    isInitializedRef.current = true
  }, [initialConfig])

  // Building useEffect
  useEffect(() => {
    if (!isInitializedRef.current) return

    const vlessUsers = vlessConfig.users
      .filter((u) => u.uuid)
      .map((u) => {
        const user: any = { uuid: u.uuid }
        if (u.name) user.name = u.name
        if (u.flow) user.flow = u.flow
        return user
      })

    const previewConfig: any = {
      type: "vless",
      tag: "vless-in",
      listen: formatListen(vlessConfig.listen),
      listen_port: vlessConfig.listen_port,
      users: vlessUsers,
    }

    if (vlessConfig.tls_enabled) {
      if (vlessConfig.tls_mode === "reality") {
        previewConfig.tls = {
          enabled: true,
          server_name: vlessConfig.tls_server_name || vlessConfig.reality_handshake_server,
          reality: {
            enabled: true,
            handshake: {
              server: vlessConfig.reality_handshake_server,
              server_port: vlessConfig.reality_handshake_port,
            },
            private_key: vlessConfig.reality_private_key,
            short_id: vlessConfig.reality_short_id ? [vlessConfig.reality_short_id] : [""],
            max_time_difference: "1m",
          },
        }
      } else if (vlessConfig.tls_mode === "acme" && vlessConfig.tls_acme_domain) {
        previewConfig.tls = {
          enabled: true,
          acme: {
            domain: [vlessConfig.tls_acme_domain],
            data_directory: "/var/lib/sing-box/acme",
          },
        }
      } else {
        previewConfig.tls = {
          enabled: true,
          certificate_path: vlessConfig.tls_certificate_path,
          key_path: vlessConfig.tls_key_path,
        }
      }
      if (vlessConfig.tls_server_name && vlessConfig.tls_mode !== "reality") {
        previewConfig.tls.server_name = vlessConfig.tls_server_name
      }
    }

    if (vlessConfig.transport_type && vlessConfig.transport_type !== "tcp") {
      previewConfig.transport = {
        type: vlessConfig.transport_type,
      }
      if (vlessConfig.transport_path) {
        previewConfig.transport.path = vlessConfig.transport_path
      }
      if (vlessConfig.transport_type === "grpc" && vlessConfig.transport_service_name) {
        previewConfig.transport.service_name = vlessConfig.transport_service_name
      }
    }

    if (vlessConfig.multiplex_enabled) {
      previewConfig.multiplex = { enabled: true, padding: vlessConfig.multiplex_padding }
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [vlessConfig, setInbound, clearEndpoints])

  const showVlessQrCode = async (userIndex: number) => {
    try {
      const user = vlessConfig.users[userIndex]
      if (!user || !user.uuid) {
        throw new Error(t("setUuidFirst"))
      }

      const ip = await getPublicIP(serverIP, setServerIP)

      const params = new URLSearchParams()
      params.set("encryption", "none")
      params.set("type", vlessConfig.transport_type === "tcp" ? "tcp" : vlessConfig.transport_type)
      if (user.flow && vlessConfig.transport_type === "tcp") params.set("flow", user.flow)
      if (vlessConfig.transport_type === "ws" && vlessConfig.transport_path) params.set("path", vlessConfig.transport_path)
      if (vlessConfig.transport_type === "grpc" && vlessConfig.transport_service_name) params.set("serviceName", vlessConfig.transport_service_name)
      if (vlessConfig.transport_type === "http" && vlessConfig.transport_path) params.set("path", vlessConfig.transport_path)
      if (vlessConfig.transport_type === "httpupgrade" && vlessConfig.transport_path) params.set("path", vlessConfig.transport_path)

      if (vlessConfig.tls_enabled) {
        if (vlessConfig.tls_mode === "reality") {
          params.set("security", "reality")
          if (vlessConfig.tls_server_name) params.set("sni", vlessConfig.tls_server_name)
          if (vlessConfig.reality_short_id) params.set("sid", vlessConfig.reality_short_id)
          if (vlessConfig.reality_public_key) params.set("pbk", vlessConfig.reality_public_key)
          params.set("fp", "chrome")
        } else {
          params.set("security", "tls")
          if (vlessConfig.tls_server_name) params.set("sni", vlessConfig.tls_server_name)
        }
      }

      const name = user.name || `VLESS-${userIndex + 1}`
      const vlessUrl = `vless://${user.uuid}@${ip}:${vlessConfig.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

      onShowQrCode(vlessUrl, "vless", userIndex)
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  return (
    <div className="space-y-4">
      {/* Listen address + port */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("listenAddr")}</Label>
          <Input
            value={vlessConfig.listen}
            onChange={(e) => setVlessConfig({ ...vlessConfig, listen: e.target.value })}
            className={!isValidListenAddress(vlessConfig.listen) ? "border-red-500" : ""}
          />
          {!isValidListenAddress(vlessConfig.listen) && (
            <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={vlessConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, vlessConfig.listen_port)
              setVlessConfig({ ...vlessConfig, listen_port: port })
            }}
            className={!isValidPort(vlessConfig.listen_port) ? "border-red-500" : ""}
          />
          {!isValidPort(vlessConfig.listen_port) && (
            <p className="text-xs text-red-500">{t("portRange")}</p>
          )}
        </div>
      </div>

      {/* Users list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("users")}</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setVlessConfig({
                ...vlessConfig,
                users: [...vlessConfig.users, { uuid: "", name: "", flow: "" }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {vlessConfig.users.map((user, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showVlessQrCode(index)}
                    disabled={!user.uuid}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  {vlessConfig.users.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setVlessConfig({
                          ...vlessConfig,
                          users: vlessConfig.users.filter((_, i) => i !== index),
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
                    const newUsers = [...vlessConfig.users]
                    newUsers[index].uuid = e.target.value
                    setVlessConfig({ ...vlessConfig, users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...vlessConfig.users]
                    newUsers[index].uuid = crypto.randomUUID()
                    setVlessConfig({ ...vlessConfig, users: newUsers })
                  }}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder={t("nameOptional")}
                value={user.name || ""}
                onChange={(e) => {
                  const newUsers = [...vlessConfig.users]
                  newUsers[index].name = e.target.value
                  setVlessConfig({ ...vlessConfig, users: newUsers })
                }}
              />
              <div className="space-y-1">
                <Label className="text-xs">{t("flowControl")}</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={user.flow || ""}
                  onChange={(e) => {
                    const newUsers = [...vlessConfig.users]
                    newUsers[index].flow = e.target.value
                    setVlessConfig({ ...vlessConfig, users: newUsers })
                    if (e.target.value === "xtls-rprx-vision" && !vlessConfig.tls_enabled) {
                      setVlessConfig({ ...vlessConfig, users: newUsers, tls_enabled: true })
                    }
                  }}
                >
                  <option value="">{t("noneDefault")}</option>
                  <option value="xtls-rprx-vision" disabled={vlessConfig.transport_type !== "tcp"}>{t("xtlsRecommended")}</option>
                </select>
                {user.flow === "xtls-rprx-vision" && !vlessConfig.tls_enabled && (
                  <p className="text-xs text-amber-600">{t("xtlsRequiresTls")}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* TLS section */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="vless-tls-enabled"
            checked={vlessConfig.tls_enabled}
            onChange={(e) => setVlessConfig({ ...vlessConfig, tls_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="vless-tls-enabled">{t("enableTls")}</Label>
        </div>
        {vlessConfig.tls_enabled && (
          <div className="space-y-2 pl-6">
            <div className="flex gap-2 items-center">
              <select
                value={vlessConfig.tls_mode}
                onChange={(e) =>
                  setVlessConfig({ ...vlessConfig, tls_mode: e.target.value as "manual" | "acme" | "reality" })
                }
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="manual">{t("manualConfig")}</option>
                <option value="acme">{t("acmeAuto")}</option>
                <option value="reality">Reality</option>
              </select>
              {vlessConfig.tls_mode === "manual" && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onGenerateCert(vlessConfig.tls_server_name || undefined)}
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
              {certInfo && vlessConfig.tls_mode === "manual" && (
                <span className="text-xs text-muted-foreground self-center">
                  {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                </span>
              )}
            </div>

            {vlessConfig.tls_mode === "reality" ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("realityHandshakeServer")}</Label>
                    <div className="flex gap-2">
                      <Input
                        value={vlessConfig.reality_handshake_server}
                        onChange={(e) => {
                          const server = e.target.value
                          const updates: any = { reality_handshake_server: server }
                          if (
                            !vlessConfig.tls_server_name ||
                            vlessConfig.tls_server_name === vlessConfig.reality_handshake_server
                          ) {
                            updates.tls_server_name = server
                          }
                          setVlessConfig({ ...vlessConfig, ...updates })
                          setTlsCheckState({ loading: false })
                        }}
                        placeholder="www.example.com"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={!vlessConfig.reality_handshake_server || tlsCheckState.loading}
                        onClick={async () => {
                          setTlsCheckState({ loading: true })
                          try {
                            const res = await apiClient.checkTls13Support(
                              vlessConfig.reality_handshake_server,
                              vlessConfig.reality_handshake_port
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
                      value={vlessConfig.reality_handshake_port}
                      onChange={(e) => {
                        const port = parsePort(e.target.value, vlessConfig.reality_handshake_port)
                        setVlessConfig({ ...vlessConfig, reality_handshake_port: port })
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SNI ({t("serverNameOptional")})</Label>
                  <Input
                    value={vlessConfig.tls_server_name}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, tls_server_name: e.target.value })}
                    placeholder={vlessConfig.reality_handshake_server || "example.com"}
                  />
                  <p className="text-xs text-muted-foreground">
                    {vlessConfig.reality_handshake_server
                      ? `默认使用握手服务器: ${vlessConfig.reality_handshake_server}`
                      : ""}
                  </p>
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
                            setVlessConfig((prev) => ({
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
                    value={vlessConfig.reality_private_key}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, reality_private_key: e.target.value })}
                    placeholder="Private Key"
                  />
                  {vlessConfig.reality_public_key && (
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground shrink-0">{t("publicKey")}:</Label>
                      <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                        {vlessConfig.reality_public_key}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(vlessConfig.reality_public_key)
                            onError(t("keyCopied"))
                            setTimeout(() => onError(""), 3000)
                          } catch {
                            // fallback: select text
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
                    value={vlessConfig.reality_short_id}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, reality_short_id: e.target.value })}
                    placeholder="0123456789abcdef"
                  />
                  <p className="text-xs text-muted-foreground">{t("realityShortIdHint")}</p>
                </div>
              </div>
            ) : vlessConfig.tls_mode === "acme" ? (
              <div className="space-y-2">
                <Label>{t("acmeDomain")}</Label>
                <Input
                  value={vlessConfig.tls_acme_domain}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("serverNameOptional")}</Label>
                  <Input
                    value={vlessConfig.tls_server_name}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, tls_server_name: e.target.value })}
                    placeholder="example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={vlessConfig.tls_certificate_path}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={vlessConfig.tls_key_path}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Transport section */}
      <div className="space-y-2 border-t pt-4">
        <Label>{t("transportProtocol")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={vlessConfig.transport_type}
          onChange={(e) => {
            const newTransport = e.target.value
            const updates: any = { transport_type: newTransport }
            if (newTransport !== "tcp") {
              updates.users = vlessConfig.users.map((u) => (u.flow ? { ...u, flow: "" } : u))
            }
            setVlessConfig({ ...vlessConfig, ...updates })
          }}
        >
          <option value="tcp">{t("tcpDefault")}</option>
          <option value="ws">WebSocket</option>
          <option value="grpc">gRPC</option>
          <option value="http">HTTP/2</option>
          <option value="httpupgrade">HTTP Upgrade</option>
        </select>
        {vlessConfig.transport_type !== "tcp" && (
          <div className="space-y-2 pt-2">
            {vlessConfig.transport_type === "grpc" ? (
              <div className="space-y-2">
                <Label>Service Name</Label>
                <Input
                  value={vlessConfig.transport_service_name}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, transport_service_name: e.target.value })}
                  placeholder="grpc-service"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Path</Label>
                <Input
                  value={vlessConfig.transport_path}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, transport_path: e.target.value })}
                  placeholder="/ws-path"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Multiplex section */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="vless-multiplex"
            checked={vlessConfig.multiplex_enabled}
            onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="vless-multiplex">{t("multiplexEnabled")}</Label>
        </div>
        {vlessConfig.multiplex_enabled && (
          <div className="flex items-center space-x-2 ml-6">
            <input
              type="checkbox"
              id="vless-multiplex-padding"
              checked={vlessConfig.multiplex_padding}
              onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_padding: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="vless-multiplex-padding">{t("multiplexPadding")}</Label>
          </div>
        )}
      </div>
    </div>
  )
}
