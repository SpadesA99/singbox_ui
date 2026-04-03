"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, Shield } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, formatListen, parseListen } from "./types"

export function HttpForm({ initialConfig, setInbound, clearEndpoints, onError, certLoading, certInfo, onGenerateCert }: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [config, setConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 8080,
    auth: "none" as "none" | "password",
    username: "",
    password: "",
    tls_enabled: false,
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
  })

  // Loading useEffect
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!initialConfig || initialConfig.type !== "http") {
      isInitializedRef.current = true
      return
    }
    setConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 8080,
      auth: (initialConfig.users?.length ?? 0) > 0 ? "password" : "none",
      username: (initialConfig.users?.[0] as any)?.username || "",
      password: (initialConfig.users?.[0] as any)?.password || "",
      tls_enabled: initialConfig.tls?.enabled || false,
      tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
      tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
    })
    isInitializedRef.current = true
  }, [initialConfig])

  // Building useEffect
  useEffect(() => {
    if (!isInitializedRef.current) return

    const previewConfig: any = {
      type: "http",
      tag: "http-in",
      listen: formatListen(config.listen),
      listen_port: config.listen_port,
    }
    if (config.auth === "password" && config.username && config.password) {
      previewConfig.users = [
        {
          username: config.username,
          password: config.password,
        },
      ]
    }
    if (config.tls_enabled) {
      previewConfig.tls = {
        enabled: true,
        certificate_path: config.tls_certificate_path,
        key_path: config.tls_key_path,
      }
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [config, setInbound, clearEndpoints])

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

      {/* 认证配置 */}
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
        <>
          <div className="space-y-2">
            <Label>{tc("username")}</Label>
            <Input
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder={t("enterUsername")}
            />
          </div>
          <div className="space-y-2">
            <Label>{tc("password")}</Label>
            <div className="flex gap-2">
              <Input
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder={t("enterPassword")}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig({
                    ...config,
                    username: generateSecureRandomString(8),
                    password: generateSecureRandomString(16),
                  })
                }
              >
                <Key className="h-4 w-4 mr-1" />
                {tc("generate")}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* TLS 配置 */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="http-tls-enabled"
            checked={config.tls_enabled}
            onChange={(e) => setConfig({ ...config, tls_enabled: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="http-tls-enabled">{t("enableTlsHttps")}</Label>
        </div>
        {config.tls_enabled && (
          <div className="space-y-2 pl-6">
            <div className="flex gap-2">
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
              {certInfo && (
                <span className="text-xs text-muted-foreground self-center">
                  {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                </span>
              )}
            </div>
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
          </div>
        )}
      </div>
    </div>
  )
}
