"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, Shield, Upload } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, NaiveUser, formatListen, parseListen } from "./types"

interface NaiveFlat {
  listen: string
  listen_port: number
  users: NaiveUser[]
  tls_mode: "manual" | "acme"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
  network: "" | "tcp" | "udp"
  quic_congestion_control: string
}

function deriveFlat(initialConfig: any): NaiveFlat {
  const normalizeCongestionControl = (value: string) => {
    if (value === "new_reno") return "reno"
    return value
  }

  if (!initialConfig || initialConfig.type !== "naive") {
    return {
      listen: "0.0.0.0",
      listen_port: 443,
      users: [{ username: "", password: "" }],
      tls_mode: "manual",
      tls_acme_domain: "",
      tls_certificate_path: "/etc/sing-box/cert.pem",
      tls_key_path: "/etc/sing-box/key.pem",
      network: "",
      quic_congestion_control: "",
    }
  }
  const naiveUsers = (initialConfig.users || []).map((u: any) => ({
    username: u.username || "",
    password: u.password || "",
  }))
  return {
    listen: parseListen(initialConfig.listen),
    listen_port: initialConfig.listen_port || 443,
    users: naiveUsers.length > 0 ? naiveUsers : [{ username: "", password: "" }],
    tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
    tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
    tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
    tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
    network: (typeof initialConfig.network === "string" ? initialConfig.network : "") as "" | "tcp" | "udp",
    quic_congestion_control: normalizeCongestionControl(initialConfig.quic_congestion_control || ""),
  }
}

function buildNaiveInbound(flat: NaiveFlat): any {
  const naiveUsersPreview = flat.users
    .filter((u) => u.username && u.password)
    .map((u) => ({
      username: u.username,
      password: u.password,
    }))

  const previewConfig: any = {
    type: "naive",
    tag: "naive-in",
    listen: formatListen(flat.listen),
    listen_port: flat.listen_port,
    users: naiveUsersPreview,
    tls: flat.tls_mode === "acme" && flat.tls_acme_domain ? {
      enabled: true,
      acme: {
        domain: [flat.tls_acme_domain],
        data_directory: "/var/lib/sing-box/acme",
      },
    } : {
      enabled: true,
      certificate_path: flat.tls_certificate_path,
      key_path: flat.tls_key_path,
    },
  }
  if (flat.network) {
    previewConfig.network = flat.network
  }
  if (flat.quic_congestion_control) {
    previewConfig.quic_congestion_control = flat.quic_congestion_control
  }
  return previewConfig
}

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

  const flat = deriveFlat(initialConfig)

  function updateInbound(patch: Partial<NaiveFlat>) {
    const newFlat = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildNaiveInbound(newFlat))
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
        <div className="flex items-center justify-between">
          <Label>{t("users")}</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              updateInbound({
                users: [...flat.users, { username: "", password: "" }],
              })
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
                      updateInbound({
                        users: flat.users.filter((_, i) => i !== index),
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
                  const users = flat.users.map((u, i) => i === index ? { ...u, username: e.target.value } : u)
                  updateInbound({ users })
                }}
              />
              <div className="flex gap-2">
                <Input
                  placeholder={tc("password")}
                  value={user.password}
                  onChange={(e) => {
                    const users = flat.users.map((u, i) => i === index ? { ...u, password: e.target.value } : u)
                    updateInbound({ users })
                  }}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const users = flat.users.map((u, i) => i === index ? { ...u, password: generateSecureRandomString(16) } : u)
                    updateInbound({ users })
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
          value={flat.network}
          onChange={(e) => updateInbound({ network: e.target.value as "" | "tcp" | "udp" })}
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
          value={flat.quic_congestion_control}
          onChange={(e) => updateInbound({ quic_congestion_control: e.target.value })}
        >
          <option value="">{t("defaultAuto")}</option>
          <option value="cubic">Cubic</option>
          <option value="reno">New Reno</option>
          <option value="bbr">BBR</option>
        </select>
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
