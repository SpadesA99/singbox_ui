"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, Shield, Upload } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, AnyTLSUser, formatListen, parseListen } from "./types"

interface AnytlsFlat {
  listen: string
  listen_port: number
  users: AnyTLSUser[]
  tls_mode: "manual" | "acme"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
  padding_scheme: string
}

function deriveFlat(initialConfig: any): AnytlsFlat {
  const c = initialConfig?.type === "anytls" ? initialConfig : null
  const anytlsUsers = (c?.users || []).map((u: any) => ({
    name: u.name || "",
    password: u.password || "",
  }))
  return {
    listen: parseListen(c?.listen),
    listen_port: c?.listen_port || 443,
    users: anytlsUsers.length > 0 ? anytlsUsers : [{ name: "", password: "" }],
    tls_mode: (c?.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
    tls_acme_domain: c?.tls?.acme?.domain?.[0] || "",
    tls_certificate_path: c?.tls?.certificate_path || "/etc/sing-box/cert.pem",
    tls_key_path: c?.tls?.key_path || "/etc/sing-box/key.pem",
    padding_scheme: (c?.padding_scheme || []).join("\n"),
  }
}

function buildAnytlsInbound(f: AnytlsFlat): any {
  const anytlsUsersPreview = f.users
    .filter((u) => u.password)
    .map((u) => {
      const user: any = { password: u.password }
      if (u.name) user.name = u.name
      return user
    })

  const previewConfig: any = {
    type: "anytls",
    tag: "anytls-in",
    listen: formatListen(f.listen),
    listen_port: f.listen_port,
    users: anytlsUsersPreview,
    tls: f.tls_mode === "acme" && f.tls_acme_domain ? {
      enabled: true,
      acme: {
        domain: [f.tls_acme_domain],
        data_directory: "/var/lib/sing-box/acme",
      },
    } : {
      enabled: true,
      certificate_path: f.tls_certificate_path,
      key_path: f.tls_key_path,
    },
  }
  if (f.padding_scheme.trim()) {
    previewConfig.padding_scheme = f.padding_scheme.split("\n").filter((l: string) => l.trim())
  }
  return previewConfig
}

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

  const flat = deriveFlat(initialConfig)

  const updateInbound = useCallback((patch: Partial<AnytlsFlat>) => {
    const merged = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildAnytlsInbound(merged))
  }, [flat, clearEndpoints, setInbound])

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

      <div className="space-y-2">
        <Label>{t("anytlsPaddingScheme")}</Label>
        <textarea
          className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          value={flat.padding_scheme}
          onChange={(e) => updateInbound({ padding_scheme: e.target.value })}
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
      </div>
    </div>
  )
}
