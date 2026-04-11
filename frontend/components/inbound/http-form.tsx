"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, Shield } from "lucide-react"
import { Card } from "@/components/ui/card"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, formatListen, parseListen } from "./types"

interface HttpFlat {
  listen: string
  listen_port: number
  auth: "none" | "password"
  users: { username: string; password: string }[]
  tls_enabled: boolean
  tls_mode: "manual" | "acme"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
}

function deriveFlat(initialConfig: any): HttpFlat {
  const c = initialConfig?.type === "http" ? initialConfig : null
  // 通过 users 字段是否存在（而非是否有有效记录）来判定 auth 模式，
  // 这样"选了密码认证但尚未填写凭据"的中间态也能持久化
  const hasUsersField = Array.isArray(c?.users)
  const loadedUsers = (c?.users || []).map((u: any) => ({
    username: u.username || u.Username || "",
    password: u.password || u.Password || "",
  }))
  return {
    listen: parseListen(c?.listen),
    listen_port: c?.listen_port || 8080,
    auth: hasUsersField ? "password" : "none",
    users: loadedUsers.length > 0 ? loadedUsers : [{ username: "", password: "" }],
    tls_enabled: c?.tls?.enabled || false,
    tls_mode: (c?.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
    tls_acme_domain: c?.tls?.acme?.domain?.[0] || "",
    tls_certificate_path: c?.tls?.certificate_path || "/etc/sing-box/cert.pem",
    tls_key_path: c?.tls?.key_path || "/etc/sing-box/key.pem",
  }
}

function buildHttpInbound(f: HttpFlat): any {
  const previewConfig: any = {
    type: "http",
    tag: "http-in",
    listen: formatListen(f.listen),
    listen_port: f.listen_port,
  }
  if (f.auth === "password") {
    // 始终写入 users 数组（即使为空或不完整），保持"密码认证"选择的持久化；
    // 这样:
    //   1. 重新派生 flat 时 Array.isArray(users)=true → auth 保持 password
    //   2. 用户正在输入的用户名/密码不会因 filter 丢失
    //   3. 若用户在未填凭据就启动 sing-box，容器会拒启动而非静默成为无认证代理
    previewConfig.users = f.users.map((u) => ({ username: u.username, password: u.password }))
  }
  if (f.tls_enabled) {
    if (f.tls_mode === "acme" && f.tls_acme_domain) {
      previewConfig.tls = {
        enabled: true,
        acme: {
          domain: [f.tls_acme_domain],
          data_directory: "/var/lib/sing-box/acme",
        },
      }
    } else {
      previewConfig.tls = {
        enabled: true,
        certificate_path: f.tls_certificate_path,
        key_path: f.tls_key_path,
      }
    }
  }
  return previewConfig
}

export function HttpForm({ initialConfig, setInbound, clearEndpoints, onError, certLoading, certInfo, onGenerateCert }: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  const updateInbound = useCallback((patch: Partial<HttpFlat>) => {
    const merged = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildHttpInbound(merged))
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
          {!isValidListenAddress(flat.listen) && (
            <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
          )}
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
          {!isValidPort(flat.listen_port) && (
            <p className="text-xs text-red-500">{t("portRange")}</p>
          )}
        </div>
      </div>

      {/* 认证配置 */}
      <div className="space-y-2">
        <Label>{t("authMode")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={flat.auth}
          onChange={(e) => updateInbound({ auth: e.target.value as "none" | "password" })}
        >
          <option value="none">{t("noAuth")}</option>
          <option value="password">{t("passwordAuth")}</option>
        </select>
      </div>
      {flat.auth === "password" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("users")}</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateInbound({ users: [...flat.users, { username: "", password: "" }] })
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
                  placeholder={tc("username")}
                  value={user.username}
                  onChange={(e) => {
                    const newUsers = [...flat.users]
                    newUsers[index] = { ...newUsers[index], username: e.target.value }
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
                      newUsers[index] = {
                        username: newUsers[index].username || generateSecureRandomString(8),
                        password: generateSecureRandomString(16),
                      }
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
      )}

      {/* TLS 配置 */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="http-tls-enabled"
            checked={flat.tls_enabled}
            onChange={(e) => updateInbound({ tls_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="http-tls-enabled">{t("enableTlsHttps")}</Label>
        </div>
        {flat.tls_enabled && (
          <div className="space-y-2 pl-6">
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
              {certInfo && flat.tls_mode === "manual" && (
                <span className="text-xs text-muted-foreground self-center">
                  {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                </span>
              )}
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
        )}
      </div>
    </div>
  )
}
