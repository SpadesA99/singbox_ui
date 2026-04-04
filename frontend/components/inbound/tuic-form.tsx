"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Shield } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, TUICUser, formatListen, parseListen } from "./types"

interface TuicFlat {
  listen: string
  listen_port: number
  users: TUICUser[]
  congestion_control: string
  zero_rtt_handshake: boolean
  tls_alpn: string[]
  tls_mode: "manual" | "acme"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
  auth_timeout: string
  heartbeat: string
}

function deriveFlat(initialConfig: any): TuicFlat {
  const c = initialConfig?.type === "tuic" ? initialConfig : null
  const tuicUsers = (c?.users || []).map((u: any) => ({
    uuid: u.uuid || "",
    name: u.name || "",
    password: u.password || "",
  }))
  return {
    listen: parseListen(c?.listen),
    listen_port: c?.listen_port || 443,
    users: tuicUsers.length > 0 ? tuicUsers : [{ uuid: "", name: "", password: "" }],
    congestion_control: c?.congestion_control || "cubic",
    zero_rtt_handshake: c?.zero_rtt_handshake || false,
    tls_alpn: c?.tls?.alpn || ["h3"],
    tls_mode: (c?.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
    tls_acme_domain: c?.tls?.acme?.domain?.[0] || "",
    tls_certificate_path: c?.tls?.certificate_path || "/etc/sing-box/cert.pem",
    tls_key_path: c?.tls?.key_path || "/etc/sing-box/key.pem",
    auth_timeout: c?.auth_timeout || "",
    heartbeat: c?.heartbeat || "",
  }
}

function buildTuicInbound(f: TuicFlat): any {
  const tuicUsersPreview = f.users
    .filter((u) => u.uuid)
    .map((u) => {
      const user: any = { uuid: u.uuid }
      if (u.name) user.name = u.name
      if (u.password) user.password = u.password
      return user
    })

  const previewConfig: any = {
    type: "tuic",
    tag: "tuic-in",
    listen: formatListen(f.listen),
    listen_port: f.listen_port,
    users: tuicUsersPreview,
    congestion_control: f.congestion_control,
    zero_rtt_handshake: f.zero_rtt_handshake,
    tls: f.tls_mode === "acme" && f.tls_acme_domain ? {
      enabled: true,
      alpn: f.tls_alpn,
      acme: {
        domain: [f.tls_acme_domain],
        data_directory: "/var/lib/sing-box/acme",
      },
    } : {
      enabled: true,
      alpn: f.tls_alpn,
      certificate_path: f.tls_certificate_path,
      key_path: f.tls_key_path,
    },
  }

  if (f.auth_timeout) {
    previewConfig.auth_timeout = f.auth_timeout
  }
  if (f.heartbeat) {
    previewConfig.heartbeat = f.heartbeat
  }
  return previewConfig
}

export function TuicForm({
  initialConfig,
  setInbound,
  clearEndpoints,
  onError,
  onShowQrCode,
  serverIP,
  setServerIP,
  certLoading,
  onGenerateCert,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  const updateInbound = useCallback((patch: Partial<TuicFlat>) => {
    const merged = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildTuicInbound(merged))
  }, [flat, clearEndpoints, setInbound])

  const showTuicQrCode = async (userIndex: number) => {
    try {
      const user = flat.users[userIndex]
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

      const params = new URLSearchParams()
      params.set("congestion_control", flat.congestion_control)
      params.set("udp_relay_mode", "native")
      params.set("alpn", "h3")
      params.set("allow_insecure", "1")

      const name = user.name || `TUIC-${userIndex + 1}`
      const password = user.password || ""
      const tuicUrl = `tuic://${user.uuid}:${encodeURIComponent(password)}@${ip}:${flat.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

      onShowQrCode(tuicUrl, "tuic", userIndex)
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

      <div className="space-y-2">
        <Label>{t("congestionAlgorithm")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={flat.congestion_control}
          onChange={(e) => updateInbound({ congestion_control: e.target.value })}
        >
          <option value="cubic">{t("cubicDefault")}</option>
          <option value="new_reno">New Reno</option>
          <option value="bbr">BBR</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="tuic-zero-rtt"
          checked={flat.zero_rtt_handshake}
          onChange={(e) => updateInbound({ zero_rtt_handshake: e.target.checked })}
          className="h-4 w-4"
        />
        <Label htmlFor="tuic-zero-rtt">{t("zeroRttHandshake")}</Label>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("users")}</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateInbound({ users: [...flat.users, { uuid: "", name: "", password: "" }] })
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
                    onClick={() => showTuicQrCode(index)}
                    disabled={!user.uuid}
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
              <div className="flex gap-2">
                <Input
                  placeholder="UUID"
                  value={user.uuid}
                  onChange={(e) => {
                    const newUsers = [...flat.users]
                    newUsers[index] = { ...newUsers[index], uuid: e.target.value }
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
                    newUsers[index] = { ...newUsers[index], uuid: crypto.randomUUID() }
                    updateInbound({ users: newUsers })
                  }}
                >
                  <Key className="h-4 w-4" />
                </Button>
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
                  placeholder={t("passwordOptional")}
                  value={user.password || ""}
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

      {/* TLS 配置 (TUIC 必须启用 TLS) */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>{t("tuicTlsLabel")}</Label>
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
            )}
          </div>
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
              <Label>{t("certPath")}</Label>
              <Input
                value={flat.tls_certificate_path}
                onChange={(e) => updateInbound({ tls_certificate_path: e.target.value })}
                placeholder="/etc/sing-box/cert.pem"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("keyPath")}</Label>
              <Input
                value={flat.tls_key_path}
                onChange={(e) => updateInbound({ tls_key_path: e.target.value })}
                placeholder="/etc/sing-box/key.pem"
              />
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("authTimeout")}</Label>
            <Input
              value={flat.auth_timeout}
              onChange={(e) => updateInbound({ auth_timeout: e.target.value })}
              placeholder="3s"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("heartbeat")}</Label>
            <Input
              value={flat.heartbeat}
              onChange={(e) => updateInbound({ heartbeat: e.target.value })}
              placeholder="10s"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("alpnProtocol")}</Label>
          <Input
            value={flat.tls_alpn.join(", ")}
            onChange={(e) => updateInbound({ tls_alpn: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
            placeholder="h3, h3-29"
          />
          <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
        </div>
      </div>
    </div>
  )
}
