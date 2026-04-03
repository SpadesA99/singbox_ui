"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, Shield, Upload } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, NaiveUser, formatListen, parseListen } from "./types"

export function NaiveForm({
  initialConfig,
  setInbound,
  clearEndpoints,
  onError,
  certLoading,
  onGenerateCert,
  onUploadCert,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const [naiveConfig, setNaiveConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ username: "", password: "" }] as NaiveUser[],
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    network: "" as "" | "tcp" | "udp",
    quic_congestion_control: "",
  })

  const [initialized, setInitialized] = useState(false)

  // Load from initialConfig
  useEffect(() => {
    if (initialized) return
    if (!initialConfig || initialConfig.type !== "naive") {
      setInitialized(true)
      return
    }
    const naiveUsers = (initialConfig.users || []).map((u: any) => ({
      username: u.username || "",
      password: u.password || "",
    }))
    setNaiveConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 443,
      users: naiveUsers.length > 0 ? naiveUsers : [{ username: "", password: "" }],
      tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
      tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
      tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
      tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
      network: (typeof initialConfig.network === "string" ? initialConfig.network : "") as "" | "tcp" | "udp",
      quic_congestion_control: initialConfig.quic_congestion_control || "",
    })
    setInitialized(true)
  }, [initialConfig, initialized])

  // Build and sync preview config
  useEffect(() => {
    if (!initialized) return

    const naiveUsersPreview = naiveConfig.users
      .filter((u) => u.username && u.password)
      .map((u) => ({
        username: u.username,
        password: u.password,
      }))

    const previewConfig: any = {
      type: "naive",
      tag: "naive-in",
      listen: formatListen(naiveConfig.listen),
      listen_port: naiveConfig.listen_port,
      users: naiveUsersPreview,
      tls: naiveConfig.tls_mode === "acme" && naiveConfig.tls_acme_domain ? {
        enabled: true,
        acme: {
          domain: [naiveConfig.tls_acme_domain],
          data_directory: "/var/lib/sing-box/acme",
        },
      } : {
        enabled: true,
        certificate_path: naiveConfig.tls_certificate_path,
        key_path: naiveConfig.tls_key_path,
      },
    }
    if (naiveConfig.network) {
      previewConfig.network = naiveConfig.network
    }
    if (naiveConfig.quic_congestion_control) {
      previewConfig.quic_congestion_control = naiveConfig.quic_congestion_control
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [naiveConfig, initialized, setInbound, clearEndpoints])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("listenAddr")}</Label>
          <Input
            value={naiveConfig.listen}
            onChange={(e) => setNaiveConfig({ ...naiveConfig, listen: e.target.value })}
            className={!isValidListenAddress(naiveConfig.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={naiveConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, naiveConfig.listen_port)
              setNaiveConfig({ ...naiveConfig, listen_port: port })
            }}
            className={!isValidPort(naiveConfig.listen_port) ? "border-red-500" : ""}
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
              setNaiveConfig({
                ...naiveConfig,
                users: [...naiveConfig.users, { username: "", password: "" }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {naiveConfig.users.map((user, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                {naiveConfig.users.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setNaiveConfig({
                        ...naiveConfig,
                        users: naiveConfig.users.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Input
                placeholder={tc("username")}
                value={user.username}
                onChange={(e) => {
                  const newUsers = [...naiveConfig.users]
                  newUsers[index].username = e.target.value
                  setNaiveConfig({ ...naiveConfig, users: newUsers })
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder={tc("password")}
                  value={user.password}
                  onChange={(e) => {
                    const newUsers = [...naiveConfig.users]
                    newUsers[index].password = e.target.value
                    setNaiveConfig({ ...naiveConfig, users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...naiveConfig.users]
                    newUsers[index].password = generateSecureRandomString(16)
                    setNaiveConfig({ ...naiveConfig, users: newUsers })
                  }}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <Label>{t("naiveNetwork")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={naiveConfig.network}
          onChange={(e) => setNaiveConfig({ ...naiveConfig, network: e.target.value as "" | "tcp" | "udp" })}
        >
          <option value="">{t("networkBoth")}</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>{t("quicCongestionControl")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={naiveConfig.quic_congestion_control}
          onChange={(e) => setNaiveConfig({ ...naiveConfig, quic_congestion_control: e.target.value })}
        >
          <option value="">{t("defaultAuto")}</option>
          <option value="cubic">Cubic</option>
          <option value="new_reno">New Reno</option>
          <option value="bbr">BBR</option>
        </select>
      </div>

      {/* TLS 配置 */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>{t("tlsCertConfig")}</Label>
          <div className="flex gap-2 items-center">
            <select
              value={naiveConfig.tls_mode}
              onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_mode: e.target.value as "manual" | "acme" })}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="manual">{t("manualConfig")}</option>
              <option value="acme">{t("acmeAuto")}</option>
            </select>
            {naiveConfig.tls_mode === "manual" && (
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
          </div>
        </div>
        {naiveConfig.tls_mode === "acme" ? (
          <div className="space-y-2">
            <Label>{t("acmeDomain")}</Label>
            <Input
              value={naiveConfig.tls_acme_domain}
              onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_acme_domain: e.target.value })}
              placeholder="example.com"
            />
            <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t("certPath")}</Label>
              <Input
                value={naiveConfig.tls_certificate_path}
                onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_certificate_path: e.target.value })}
                placeholder="/etc/sing-box/cert.pem"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("keyPath")}</Label>
              <Input
                value={naiveConfig.tls_key_path}
                onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_key_path: e.target.value })}
                placeholder="/etc/sing-box/key.pem"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
