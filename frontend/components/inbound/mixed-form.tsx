"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Shield } from "lucide-react"
import { Card } from "@/components/ui/card"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, formatListen, parseListen, getPublicIP } from "./types"

export function MixedForm({ initialConfig, setInbound, clearEndpoints, onError, onShowQrCode, serverIP, setServerIP, certLoading, certInfo, onGenerateCert }: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [config, setConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 1080,
    auth: "none" as "none" | "password",
    users: [{ username: "", password: "" }] as { username: string; password: string }[],
    tls_enabled: false,
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
  })

  // Loading useEffect
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!initialConfig || (initialConfig.type !== "mixed" && initialConfig.type !== "socks")) {
      isInitializedRef.current = true
      return
    }
    const loadedUsers = (initialConfig.users || []).map((u: any) => ({
      username: u.username || u.Username || "",
      password: u.password || u.Password || "",
    }))
    setConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 1080,
      auth: loadedUsers.length > 0 ? "password" : "none",
      users: loadedUsers.length > 0 ? loadedUsers : [{ username: "", password: "" }],
      tls_enabled: initialConfig.tls?.enabled || false,
      tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
      tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
      tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
      tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
    })
    isInitializedRef.current = true
  }, [initialConfig])

  // Building useEffect
  useEffect(() => {
    if (!isInitializedRef.current) return

    const previewConfig: any = {
      type: "mixed",
      tag: "mixed-in",
      listen: formatListen(config.listen),
      listen_port: config.listen_port,
    }
    if (config.auth === "password") {
      const validUsers = config.users.filter((u) => u.username && u.password)
      if (validUsers.length > 0) {
        previewConfig.users = validUsers.map((u) => ({ username: u.username, password: u.password }))
      }
    }
    if (config.tls_enabled) {
      if (config.tls_mode === "acme" && config.tls_acme_domain) {
        previewConfig.tls = {
          enabled: true,
          acme: {
            domain: [config.tls_acme_domain],
            data_directory: "/var/lib/sing-box/acme",
          },
        }
      } else {
        previewConfig.tls = {
          enabled: true,
          certificate_path: config.tls_certificate_path,
          key_path: config.tls_key_path,
        }
      }
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [config, setInbound, clearEndpoints])

  const showQrCode = async (userIndex?: number) => {
    onError("")
    try {
      const ip = await getPublicIP(serverIP, setServerIP)

      let url: string
      if (config.auth === "password" && userIndex !== undefined) {
        const user = config.users[userIndex]
        if (user?.username && user?.password) {
          url = `socks5://${user.username}:${user.password}@${ip}:${config.listen_port}#Mixed-${userIndex + 1}`
        } else {
          url = `socks5://${ip}:${config.listen_port}#Mixed`
        }
      } else {
        url = `socks5://${ip}:${config.listen_port}#Mixed`
      }

      onShowQrCode(url, "socks5")
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
            value={config.listen}
            onChange={(e) => setConfig({ ...config, listen: e.target.value })}
            className={!isValidListenAddress(config.listen) ? "border-red-500" : ""}
          />
          {!isValidListenAddress(config.listen) && (
            <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={config.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, config.listen_port)
              setConfig({ ...config, listen_port: port })
            }}
            className={!isValidPort(config.listen_port) ? "border-red-500" : ""}
          />
          {!isValidPort(config.listen_port) && (
            <p className="text-xs text-red-500">{t("portRange")}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("authMode")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={config.auth}
          onChange={(e) => setConfig({ ...config, auth: e.target.value as "none" | "password" })}
        >
          <option value="none">{t("noAuth")}</option>
          <option value="password">{t("passwordAuth")}</option>
        </select>
      </div>
      {config.auth === "password" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("users")}</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setConfig({
                  ...config,
                  users: [...config.users, { username: "", password: "" }],
                })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              {tc("add")}
            </Button>
          </div>
          {config.users.map((user, index) => (
            <Card key={index} className="p-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => showQrCode(index)}
                      disabled={!user.username || !user.password}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                    {config.users.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfig({
                            ...config,
                            users: config.users.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <Input
                  placeholder={tc("username")}
                  value={user.username}
                  onChange={(e) => {
                    const newUsers = [...config.users]
                    newUsers[index] = { ...newUsers[index], username: e.target.value }
                    setConfig({ ...config, users: newUsers })
                  }}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder={tc("password")}
                    value={user.password}
                    onChange={(e) => {
                      const newUsers = [...config.users]
                      newUsers[index] = { ...newUsers[index], password: e.target.value }
                      setConfig({ ...config, users: newUsers })
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newUsers = [...config.users]
                      newUsers[index] = {
                        username: newUsers[index].username || generateSecureRandomString(8),
                        password: generateSecureRandomString(16),
                      }
                      setConfig({ ...config, users: newUsers })
                    }}
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {/* TLS */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="mixed-tls-enabled"
            checked={config.tls_enabled}
            onChange={(e) => setConfig({ ...config, tls_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="mixed-tls-enabled">{t("enableTlsHttps")}</Label>
        </div>
        {config.tls_enabled && (
          <div className="space-y-2 pl-6">
            <div className="flex gap-2 items-center">
              <select
                value={config.tls_mode}
                onChange={(e) => setConfig({ ...config, tls_mode: e.target.value as "manual" | "acme" })}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="manual">{t("manualConfig")}</option>
                <option value="acme">{t("acmeAuto")}</option>
              </select>
              {config.tls_mode === "manual" && (
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
              {certInfo && config.tls_mode === "manual" && (
                <span className="text-xs text-muted-foreground self-center">
                  {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                </span>
              )}
            </div>
            {config.tls_mode === "acme" ? (
              <div className="space-y-2">
                <Label>{t("acmeDomain")}</Label>
                <Input
                  value={config.tls_acme_domain}
                  onChange={(e) => setConfig({ ...config, tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={config.tls_certificate_path}
                    onChange={(e) => setConfig({ ...config, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={config.tls_key_path}
                    onChange={(e) => setConfig({ ...config, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {config.auth === "none" && (
        <div className="pt-2">
          <Button type="button" variant="outline" onClick={() => showQrCode()}>
            <QrCode className="h-4 w-4 mr-1" />
            {t("generateQrCode")}
          </Button>
        </div>
      )}
    </div>
  )
}
