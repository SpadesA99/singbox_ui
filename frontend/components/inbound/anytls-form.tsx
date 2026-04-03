"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, Shield, Upload } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, AnyTLSUser, formatListen, parseListen } from "./types"

export function AnytlsForm({
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

  const [anytlsConfig, setAnytlsConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ name: "", password: "" }] as AnyTLSUser[],
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    padding_scheme: "",
  })

  const [initialized, setInitialized] = useState(false)

  // Load from initialConfig
  useEffect(() => {
    if (initialized) return
    if (!initialConfig || initialConfig.type !== "anytls") {
      setInitialized(true)
      return
    }
    const anytlsUsers = (initialConfig.users || []).map((u: any) => ({
      name: u.name || "",
      password: u.password || "",
    }))
    setAnytlsConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 443,
      users: anytlsUsers.length > 0 ? anytlsUsers : [{ name: "", password: "" }],
      tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
      tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
      tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
      tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
      padding_scheme: (initialConfig.padding_scheme || []).join("\n"),
    })
    setInitialized(true)
  }, [initialConfig, initialized])

  // Build and sync preview config
  useEffect(() => {
    if (!initialized) return

    const anytlsUsersPreview = anytlsConfig.users
      .filter((u) => u.password)
      .map((u) => {
        const user: any = { password: u.password }
        if (u.name) user.name = u.name
        return user
      })

    const previewConfig: any = {
      type: "anytls",
      tag: "anytls-in",
      listen: formatListen(anytlsConfig.listen),
      listen_port: anytlsConfig.listen_port,
      users: anytlsUsersPreview,
      tls: anytlsConfig.tls_mode === "acme" && anytlsConfig.tls_acme_domain ? {
        enabled: true,
        acme: {
          domain: [anytlsConfig.tls_acme_domain],
          data_directory: "/var/lib/sing-box/acme",
        },
      } : {
        enabled: true,
        certificate_path: anytlsConfig.tls_certificate_path,
        key_path: anytlsConfig.tls_key_path,
      },
    }
    if (anytlsConfig.padding_scheme.trim()) {
      previewConfig.padding_scheme = anytlsConfig.padding_scheme.split("\n").filter((l: string) => l.trim())
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [anytlsConfig, initialized, setInbound, clearEndpoints])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("listenAddr")}</Label>
          <Input
            value={anytlsConfig.listen}
            onChange={(e) => setAnytlsConfig({ ...anytlsConfig, listen: e.target.value })}
            className={!isValidListenAddress(anytlsConfig.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={anytlsConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, anytlsConfig.listen_port)
              setAnytlsConfig({ ...anytlsConfig, listen_port: port })
            }}
            className={!isValidPort(anytlsConfig.listen_port) ? "border-red-500" : ""}
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
              setAnytlsConfig({
                ...anytlsConfig,
                users: [...anytlsConfig.users, { name: "", password: "" }],
              })
            }
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {anytlsConfig.users.map((user, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                {anytlsConfig.users.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setAnytlsConfig({
                        ...anytlsConfig,
                        users: anytlsConfig.users.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Input
                placeholder={t("nameOptional")}
                value={user.name || ""}
                onChange={(e) => {
                  const newUsers = [...anytlsConfig.users]
                  newUsers[index].name = e.target.value
                  setAnytlsConfig({ ...anytlsConfig, users: newUsers })
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder={tc("password")}
                  value={user.password}
                  onChange={(e) => {
                    const newUsers = [...anytlsConfig.users]
                    newUsers[index].password = e.target.value
                    setAnytlsConfig({ ...anytlsConfig, users: newUsers })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newUsers = [...anytlsConfig.users]
                    newUsers[index].password = generateSecureRandomString(16)
                    setAnytlsConfig({ ...anytlsConfig, users: newUsers })
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
        <Label>{t("anytlsPaddingScheme")}</Label>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          value={anytlsConfig.padding_scheme}
          onChange={(e) => setAnytlsConfig({ ...anytlsConfig, padding_scheme: e.target.value })}
          placeholder={"stop=8\n0=30-30\n1=100-400"}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">{t("anytlsPaddingSchemeHint")}</p>
      </div>

      {/* TLS 配置 */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label>{t("tlsCertConfig")}</Label>
          <div className="flex gap-2 items-center">
            <select
              value={anytlsConfig.tls_mode}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_mode: e.target.value as "manual" | "acme" })}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
            >
              <option value="manual">{t("manualConfig")}</option>
              <option value="acme">{t("acmeAuto")}</option>
            </select>
            {anytlsConfig.tls_mode === "manual" && (
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
        {anytlsConfig.tls_mode === "acme" ? (
          <div className="space-y-2">
            <Label>{t("acmeDomain")}</Label>
            <Input
              value={anytlsConfig.tls_acme_domain}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_acme_domain: e.target.value })}
              placeholder="example.com"
            />
            <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>{t("certPath")}</Label>
              <Input
                value={anytlsConfig.tls_certificate_path}
                onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_certificate_path: e.target.value })}
                placeholder="/etc/sing-box/cert.pem"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("keyPath")}</Label>
              <Input
                value={anytlsConfig.tls_key_path}
                onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_key_path: e.target.value })}
                placeholder="/etc/sing-box/key.pem"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
