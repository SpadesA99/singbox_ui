"use client"

import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

interface HttpFlat {
  server: string
  server_port: number
  username: string
  password: string
  path: string
  tls_enabled: boolean
  tls_server_name: string
  tls_insecure: boolean
  headers: string
}

function deriveFlat(initialConfig: any): HttpFlat {
  const c = initialConfig?.type === "http" ? initialConfig : null
  return {
    server: c?.server || "",
    server_port: c?.server_port || 8080,
    username: c?.username || "",
    password: c?.password || "",
    path: c?.path || "",
    tls_enabled: c?.tls?.enabled || false,
    tls_server_name: c?.tls?.server_name || "",
    tls_insecure: c?.tls?.insecure || false,
    headers: c?.headers ? Object.entries(c.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join("\n") : "",
  }
}

function buildHttpOutbound(s: HttpFlat): any {
  const previewConfig: any = {
    type: "http",
    tag: "proxy_out",
    server: s.server,
    server_port: s.server_port,
  }
  if (s.username) previewConfig.username = s.username
  if (s.password) previewConfig.password = s.password
  if (s.path) previewConfig.path = s.path
  if (s.headers) {
    const headersMap: any = {}
    s.headers.split("\n").forEach((line: string) => {
      const idx = line.indexOf(":")
      if (idx > 0) {
        const key = line.slice(0, idx).trim()
        const val = line.slice(idx + 1).trim()
        if (key && val) headersMap[key] = [val]
      }
    })
    if (Object.keys(headersMap).length > 0) previewConfig.headers = headersMap
  }
  if (s.tls_enabled) {
    const httpTlsConfig: any = { enabled: true }
    if (s.tls_server_name) httpTlsConfig.server_name = s.tls_server_name
    if (s.tls_insecure) httpTlsConfig.insecure = true
    previewConfig.tls = httpTlsConfig
  }
  return previewConfig
}

export function HttpForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  const updateOutbound = useCallback((patch: Partial<HttpFlat>) => {
    const merged = { ...flat, ...patch }
    setOutbound(0, buildHttpOutbound(merged))
  }, [flat, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="127.0.0.1"
            value={flat.server}
            onChange={(e) => updateOutbound({ server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={flat.server_port}
            onChange={(e) => updateOutbound({ server_port: parseInt(e.target.value) || 8080 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("usernameOptional")}</Label>
          <Input
            value={flat.username}
            onChange={(e) => updateOutbound({ username: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("passwordOptional")}</Label>
          <Input
            type="password"
            value={flat.password}
            onChange={(e) => updateOutbound({ password: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("requestPathOptional")}</Label>
        <Input
          placeholder="/"
          value={flat.path}
          onChange={(e) => updateOutbound({ path: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("customHeaders")}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          rows={3}
          value={flat.headers}
          onChange={(e) => updateOutbound({ headers: e.target.value })}
          placeholder={t("customHeadersHint")}
        />
      </div>

      {/* TLS (for HTTPS proxy) */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("tlsSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flat.tls_enabled}
              onChange={(e) => updateOutbound({ tls_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableTlsHttps")}
          </label>
          {flat.tls_enabled && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={flat.tls_insecure}
                onChange={(e) => updateOutbound({ tls_insecure: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("insecure")}
            </label>
          )}
        </div>
        {flat.tls_enabled && (
          <div className="space-y-2">
            <Label>{t("sniServerName")}</Label>
            <Input
              placeholder={t("sniPlaceholder")}
              value={flat.tls_server_name}
              onChange={(e) => updateOutbound({ tls_server_name: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
