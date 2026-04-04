"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Shield, Upload } from "lucide-react"
import { Card } from "@/components/ui/card"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, Hysteria2User, formatListen, parseListen } from "./types"

interface Hy2Flat {
  listen: string
  listen_port: number
  up_mbps: number
  down_mbps: number
  users: Hysteria2User[]
  tls_alpn: string[]
  tls_mode: "manual" | "acme"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
  tls_server_name: string
  obfs_type: string
  obfs_password: string
  masquerade: string
  ignore_client_bandwidth: boolean
}

function deriveFlat(initialConfig: any): Hy2Flat {
  const c = initialConfig?.type === "hysteria2" ? initialConfig : null
  const loadedUsers = (c?.users || []).map((u: any) => ({
    name: u.name || "",
    password: u.password || "",
  }))
  return {
    listen: parseListen(c?.listen),
    listen_port: c?.listen_port || 443,
    up_mbps: c?.up_mbps || 100,
    down_mbps: c?.down_mbps || 100,
    users: loadedUsers.length > 0 ? loadedUsers : [{ name: "", password: "" }],
    tls_alpn: c?.tls?.alpn || ["h3"],
    tls_mode: (c?.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
    tls_acme_domain: c?.tls?.acme?.domain?.[0] || "",
    tls_certificate_path: c?.tls?.certificate_path || "/etc/sing-box/cert.pem",
    tls_key_path: c?.tls?.key_path || "/etc/sing-box/key.pem",
    tls_server_name: c?.tls?.server_name || "",
    obfs_type: c?.obfs?.type || "",
    obfs_password: c?.obfs?.password || "",
    masquerade: typeof c?.masquerade === "string" ? c.masquerade : "",
    ignore_client_bandwidth: c?.ignore_client_bandwidth || false,
  }
}

function buildHy2Inbound(f: Hy2Flat): any {
  const hy2Users = f.users
    .filter((u) => u.password)
    .map((u) => {
      const user: any = { password: u.password }
      if (u.name) user.name = u.name
      return user
    })
  const previewConfig: any = {
    type: "hysteria2",
    tag: "hy2-in",
    listen: formatListen(f.listen),
    listen_port: f.listen_port,
    up_mbps: f.up_mbps,
    down_mbps: f.down_mbps,
    users: hy2Users,
    tls: f.tls_mode === "acme" && f.tls_acme_domain ? {
      enabled: true,
      alpn: f.tls_alpn,
      ...(f.tls_server_name ? { server_name: f.tls_server_name } : {}),
      acme: {
        domain: [f.tls_acme_domain],
        data_directory: "/var/lib/sing-box/acme",
      },
    } : {
      enabled: true,
      alpn: f.tls_alpn,
      ...(f.tls_server_name ? { server_name: f.tls_server_name } : {}),
      certificate_path: f.tls_certificate_path,
      key_path: f.tls_key_path,
    },
  }
  if (f.obfs_type && f.obfs_password) {
    previewConfig.obfs = { type: f.obfs_type, password: f.obfs_password }
  }
  if (f.masquerade) {
    previewConfig.masquerade = f.masquerade
  }
  if (f.ignore_client_bandwidth) {
    previewConfig.ignore_client_bandwidth = true
  }
  return previewConfig
}

export function Hysteria2Form({
  initialConfig,
  setInbound,
  clearEndpoints,
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

  const updateInbound = useCallback((patch: Partial<Hy2Flat>) => {
    const merged = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildHy2Inbound(merged))
  }, [flat, clearEndpoints, setInbound])

  const showHysteria2QrCode = async (userIndex: number) => {
    onError("")
    try {
      const user = flat.users[userIndex]
      if (!user || !user.password) {
        throw new Error(t("setPasswordFirst"))
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
      params.set("insecure", "1")
      if (flat.up_mbps) params.set("upmbps", String(flat.up_mbps))
      if (flat.down_mbps) params.set("downmbps", String(flat.down_mbps))

      const name = user.name || `Hysteria2-${userIndex + 1}`
      const hy2Url = `hysteria2://${user.password}@${ip}:${flat.listen_port}/?${params.toString()}#${encodeURIComponent(name)}`

      onShowQrCode(hy2Url, "hysteria2", userIndex)
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("upBandwidth")}</Label>
          <Input
            type="number"
            value={flat.up_mbps}
            onChange={(e) => updateInbound({ up_mbps: parseInt(e.target.value) || 100 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("downBandwidth")}</Label>
          <Input
            type="number"
            value={flat.down_mbps}
            onChange={(e) => updateInbound({ down_mbps: parseInt(e.target.value) || 100 })}
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
              updateInbound({ users: [...flat.users, { name: "", password: "" }] })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {flat.users.map((user, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => showHysteria2QrCode(index)}
                    disabled={!user.password}
                  >
                    <QrCode className="h-4 w-4" />
                  </Button>
                  {flat.users.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateInbound({ users: flat.users.filter((_, i) => i !== index) })
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
                  const newUsers = [...flat.users]
                  newUsers[index] = { ...newUsers[index], name: e.target.value }
                  updateInbound({ users: newUsers })
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder={tc("password")}
                  value={user.password}
                  onChange={(e) => {
                    const newUsers = [...flat.users]
                    newUsers[index] = { ...newUsers[index], password: e.target.value }
                    updateInbound({ users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...flat.users]
                    newUsers[index] = { ...newUsers[index], password: generateSecureRandomString(16) }
                    updateInbound({ users: newUsers })
                  }}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>{t("tlsCertConfig")}</Label>
          <div className="flex gap-2 items-center">
            <select
              value={flat.tls_mode}
              onChange={(e) => updateInbound({ tls_mode: e.target.value as "manual" | "acme" })}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="manual">{t("manualConfig")}</option>
              <option value="acme">{t("acmeAuto")}</option>
            </select>
            {flat.tls_mode === "manual" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onGenerateCert()}
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
            {certInfo && flat.tls_mode === "manual" && (
              <span className="text-xs text-muted-foreground">
                {t("certGeneratedShort", { name: certInfo.common_name ?? "" })}
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-2">
          <Label>{t("serverNameOptional")}</Label>
          <Input
            value={flat.tls_server_name}
            onChange={(e) => updateInbound({ tls_server_name: e.target.value })}
            placeholder="example.com"
          />
        </div>
      {flat.tls_mode === "acme" ? (
        <div className="space-y-2">
          <Label>{t("acmeDomain")}</Label>
          <Input
            value={flat.tls_acme_domain}
            onChange={(e) => updateInbound({ tls_acme_domain: e.target.value })}
            placeholder="example.com"
          />
          <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label>{t("tlsCertPath")}</Label>
            <Input
              value={flat.tls_certificate_path}
              onChange={(e) => updateInbound({ tls_certificate_path: e.target.value })}
              placeholder="/etc/sing-box/cert.pem"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tlsKeyPath")}</Label>
            <Input
              value={flat.tls_key_path}
              onChange={(e) => updateInbound({ tls_key_path: e.target.value })}
              placeholder="/etc/sing-box/key.pem"
            />
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label>{t("alpnProtocol")}</Label>
        <Input
          value={flat.tls_alpn.join(", ")}
          onChange={(e) =>
            updateInbound({
              tls_alpn: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="h3, h3-29"
        />
        <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
      </div>
      {/* 混淆 (Obfuscation) */}
      <div className="space-y-2">
        <Label>{t("hy2Obfs")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={flat.obfs_type}
          onChange={(e) => updateInbound({ obfs_type: e.target.value })}
        >
          <option value="">{t("disabled")}</option>
          <option value="salamander">Salamander</option>
        </select>
      </div>
      {flat.obfs_type && (
        <div className="space-y-2">
          <Label>{t("hy2ObfsPassword")}</Label>
          <Input
            value={flat.obfs_password}
            onChange={(e) => updateInbound({ obfs_password: e.target.value })}
            placeholder={t("hy2ObfsPasswordHint")}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("hy2Masquerade")}</Label>
        <Input
          value={flat.masquerade}
          onChange={(e) => updateInbound({ masquerade: e.target.value })}
          placeholder="https://example.com"
        />
        <p className="text-xs text-muted-foreground">{t("hy2MasqueradeHint")}</p>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="hy2-ignore-bw"
          checked={flat.ignore_client_bandwidth}
          onChange={(e) => updateInbound({ ignore_client_bandwidth: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="hy2-ignore-bw">{t("hy2IgnoreClientBandwidth")}</Label>
      </div>
    </div>
  )
}
