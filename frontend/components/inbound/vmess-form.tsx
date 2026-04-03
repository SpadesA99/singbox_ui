"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Shield, Upload } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, VMESSUser, formatListen, parseListen } from "./types"

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

  const [vmessConfig, setVmessConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ uuid: "", name: "", alterId: 0 }] as VMESSUser[],
    tls_enabled: false,
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    tls_server_name: "",
    transport_type: "tcp" as string,
    transport_path: "",
    transport_service_name: "",
    multiplex_enabled: false,
    multiplex_padding: false,
  })

  // Load from initialConfig
  useEffect(() => {
    if (!initialConfig || initialConfig.type !== "vmess") return
    const vmessUsers = (initialConfig.users || []).map((u: any) => ({
      uuid: u.uuid || "",
      name: u.name || "",
      alterId: u.alterId || 0,
    }))
    setVmessConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 443,
      users: vmessUsers.length > 0 ? vmessUsers : [{ uuid: "", name: "", alterId: 0 }],
      tls_enabled: initialConfig.tls?.enabled || false,
      tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
      tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
      tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
      tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
      tls_server_name: initialConfig.tls?.server_name || "",
      transport_type: initialConfig.transport?.type || "tcp",
      transport_path: initialConfig.transport?.path || "",
      transport_service_name: initialConfig.transport?.service_name || "",
      multiplex_enabled: initialConfig.multiplex?.enabled || false,
      multiplex_padding: initialConfig.multiplex?.padding || false,
    })
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    const vmessUsers = vmessConfig.users
      .filter((u) => u.uuid)
      .map((u) => {
        const user: any = { uuid: u.uuid }
        if (u.name) user.name = u.name
        if (u.alterId !== undefined) user.alterId = u.alterId
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
      if (vmessConfig.tls_mode === "acme" && vmessConfig.tls_acme_domain) {
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
      if (vmessConfig.tls_server_name) {
        previewConfig.tls.server_name = vmessConfig.tls_server_name
      }
    }

    if (vmessConfig.transport_type && vmessConfig.transport_type !== "tcp") {
      previewConfig.transport = { type: vmessConfig.transport_type }
      if (vmessConfig.transport_type === "ws" && vmessConfig.transport_path) {
        previewConfig.transport.path = vmessConfig.transport_path
      }
      if (vmessConfig.transport_type === "grpc" && vmessConfig.transport_service_name) {
        previewConfig.transport.service_name = vmessConfig.transport_service_name
      }
      if (vmessConfig.transport_type === "http" && vmessConfig.transport_path) {
        previewConfig.transport.path = vmessConfig.transport_path
      }
    }

    if (vmessConfig.multiplex_enabled) {
      previewConfig.multiplex = { enabled: true, padding: vmessConfig.multiplex_padding }
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [vmessConfig, currentInstance])

  const showVmessQrCode = async (userIndex: number) => {
    try {
      const user = vmessConfig.users[userIndex]
      if (!user || !user.uuid) {
        throw new Error(t("setUuidFirst"))
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

      // VMess URL format (v2rayN standard)
      const vmessObj = {
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
        tls: vmessConfig.tls_enabled ? "tls" : "",
        sni: vmessConfig.tls_server_name || "",
      }

      if (vmessConfig.transport_type === "grpc") {
        vmessObj.path = vmessConfig.transport_service_name || ""
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

      {/* TLS 配置 */}
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
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_mode: e.target.value as "manual" | "acme" })}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="manual">{t("manualConfig")}</option>
                <option value="acme">{t("acmeAuto")}</option>
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
            </div>
            {vmessConfig.tls_mode === "acme" ? (
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
          </div>
        )}
      </div>

      {/* Transport 配置 */}
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
              <div className="space-y-2">
                <Label>Path</Label>
                <Input
                  value={vmessConfig.transport_path}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, transport_path: e.target.value })}
                  placeholder="/ws-path"
                />
              </div>
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
          <div className="flex items-center space-x-2 ml-6">
            <input
              type="checkbox"
              id="vmess-multiplex-padding"
              checked={vmessConfig.multiplex_padding}
              onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_padding: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="vmess-multiplex-padding">{t("multiplexPadding")}</Label>
          </div>
        )}
      </div>
    </div>
  )
}
