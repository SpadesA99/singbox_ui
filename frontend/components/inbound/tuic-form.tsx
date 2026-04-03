"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Shield } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, TUICUser, formatListen, parseListen } from "./types"

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

  const [tuicConfig, setTuicConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ uuid: "", name: "", password: "" }] as TUICUser[],
    congestion_control: "cubic" as string,
    zero_rtt_handshake: false,
    tls_alpn: ["h3"] as string[],
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    auth_timeout: "",
    heartbeat: "",
  })

  const [initialized, setInitialized] = useState(false)

  // Load from initialConfig
  useEffect(() => {
    if (initialized) return
    if (!initialConfig || initialConfig.type !== "tuic") {
      setInitialized(true)
      return
    }
    const tuicUsers = (initialConfig.users || []).map((u: any) => ({
      uuid: u.uuid || "",
      name: u.name || "",
      password: u.password || "",
    }))
    setTuicConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 443,
      users: tuicUsers.length > 0 ? tuicUsers : [{ uuid: "", name: "", password: "" }],
      congestion_control: initialConfig.congestion_control || "cubic",
      zero_rtt_handshake: initialConfig.zero_rtt_handshake || false,
      tls_alpn: initialConfig.tls?.alpn || ["h3"],
      tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
      tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
      tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
      tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
      auth_timeout: initialConfig.auth_timeout || "",
      heartbeat: initialConfig.heartbeat || "",
    })
    setInitialized(true)
  }, [initialConfig, initialized])

  // Build and sync preview config
  useEffect(() => {
    if (!initialized) return

    const tuicUsersPreview = tuicConfig.users
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
      listen: formatListen(tuicConfig.listen),
      listen_port: tuicConfig.listen_port,
      users: tuicUsersPreview,
      congestion_control: tuicConfig.congestion_control,
      zero_rtt_handshake: tuicConfig.zero_rtt_handshake,
      tls: tuicConfig.tls_mode === "acme" && tuicConfig.tls_acme_domain ? {
        enabled: true,
        alpn: tuicConfig.tls_alpn,
        acme: {
          domain: [tuicConfig.tls_acme_domain],
          data_directory: "/var/lib/sing-box/acme",
        },
      } : {
        enabled: true,
        alpn: tuicConfig.tls_alpn,
        certificate_path: tuicConfig.tls_certificate_path,
        key_path: tuicConfig.tls_key_path,
      },
    }

    if (tuicConfig.auth_timeout) {
      previewConfig.auth_timeout = tuicConfig.auth_timeout
    }
    if (tuicConfig.heartbeat) {
      previewConfig.heartbeat = tuicConfig.heartbeat
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [tuicConfig, initialized, setInbound, clearEndpoints])

  const showTuicQrCode = async (userIndex: number) => {
    try {
      const user = tuicConfig.users[userIndex]
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
      params.set("congestion_control", tuicConfig.congestion_control)
      params.set("udp_relay_mode", "native")
      params.set("alpn", "h3")
      params.set("allow_insecure", "1")

      const name = user.name || `TUIC-${userIndex + 1}`
      const password = user.password || ""
      const tuicUrl = `tuic://${user.uuid}:${encodeURIComponent(password)}@${ip}:${tuicConfig.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

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
            value={tuicConfig.listen}
            onChange={(e) => setTuicConfig({ ...tuicConfig, listen: e.target.value })}
            className={!isValidListenAddress(tuicConfig.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={tuicConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, tuicConfig.listen_port)
              setTuicConfig({ ...tuicConfig, listen_port: port })
            }}
            className={!isValidPort(tuicConfig.listen_port) ? "border-red-500" : ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("congestionAlgorithm")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={tuicConfig.congestion_control}
          onChange={(e) => setTuicConfig({ ...tuicConfig, congestion_control: e.target.value })}
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
          checked={tuicConfig.zero_rtt_handshake}
          onChange={(e) => setTuicConfig({ ...tuicConfig, zero_rtt_handshake: e.target.checked })}
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
              setTuicConfig({
                ...tuicConfig,
                users: [...tuicConfig.users, { uuid: "", name: "", password: "" }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {tuicConfig.users.map((user, index) => (
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
                  {tuicConfig.users.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setTuicConfig({
                          ...tuicConfig,
                          users: tuicConfig.users.filter((_, i) => i !== index),
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
                    const newUsers = [...tuicConfig.users]
                    newUsers[index].uuid = e.target.value
                    setTuicConfig({ ...tuicConfig, users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...tuicConfig.users]
                    newUsers[index].uuid = crypto.randomUUID()
                    setTuicConfig({ ...tuicConfig, users: newUsers })
                  }}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
              <Input
                placeholder={t("nameOptional")}
                value={user.name || ""}
                onChange={(e) => {
                  const newUsers = [...tuicConfig.users]
                  newUsers[index].name = e.target.value
                  setTuicConfig({ ...tuicConfig, users: newUsers })
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder={t("passwordOptional")}
                  value={user.password || ""}
                  onChange={(e) => {
                    const newUsers = [...tuicConfig.users]
                    newUsers[index].password = e.target.value
                    setTuicConfig({ ...tuicConfig, users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...tuicConfig.users]
                    newUsers[index].password = generateSecureRandomString(16)
                    setTuicConfig({ ...tuicConfig, users: newUsers })
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
              value={tuicConfig.tls_mode}
              onChange={(e) => setTuicConfig({ ...tuicConfig, tls_mode: e.target.value as "manual" | "acme" })}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="manual">{t("manualConfig")}</option>
              <option value="acme">{t("acmeAuto")}</option>
            </select>
            {tuicConfig.tls_mode === "manual" && (
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
        {tuicConfig.tls_mode === "acme" ? (
          <div className="space-y-2">
            <Label>{t("acmeDomain")}</Label>
            <Input
              value={tuicConfig.tls_acme_domain}
              onChange={(e) => setTuicConfig({ ...tuicConfig, tls_acme_domain: e.target.value })}
              placeholder="example.com"
            />
            <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t("certPath")}</Label>
              <Input
                value={tuicConfig.tls_certificate_path}
                onChange={(e) => setTuicConfig({ ...tuicConfig, tls_certificate_path: e.target.value })}
                placeholder="/etc/sing-box/cert.pem"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("keyPath")}</Label>
              <Input
                value={tuicConfig.tls_key_path}
                onChange={(e) => setTuicConfig({ ...tuicConfig, tls_key_path: e.target.value })}
                placeholder="/etc/sing-box/key.pem"
              />
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("authTimeout")}</Label>
            <Input
              value={tuicConfig.auth_timeout}
              onChange={(e) => setTuicConfig({ ...tuicConfig, auth_timeout: e.target.value })}
              placeholder="3s"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("heartbeat")}</Label>
            <Input
              value={tuicConfig.heartbeat}
              onChange={(e) => setTuicConfig({ ...tuicConfig, heartbeat: e.target.value })}
              placeholder="10s"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("alpnProtocol")}</Label>
          <Input
            value={tuicConfig.tls_alpn.join(", ")}
            onChange={(e) => setTuicConfig({ ...tuicConfig, tls_alpn: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
            placeholder="h3, h3-29"
          />
          <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
        </div>
      </div>
    </div>
  )
}
