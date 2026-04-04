"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

export function HttpForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [httpConfig, setHttpConfig] = useState({
    server: "",
    server_port: 8080,
    username: "",
    password: "",
    path: "",
    tls_enabled: false,
    tls_server_name: "",
    tls_insecure: false,
    headers: "",
  })

  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "http") {
      setHttpConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 8080,
        username: initialConfig.username || "",
        password: initialConfig.password || "",
        path: initialConfig.path || "",
        tls_enabled: initialConfig.tls?.enabled || false,
        tls_server_name: initialConfig.tls?.server_name || "",
        tls_insecure: initialConfig.tls?.insecure || false,
        headers: initialConfig.headers ? Object.entries(initialConfig.headers).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join("\n") : "",
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  useEffect(() => {
    if (!isInitializedRef.current) return
    // allow partial writes so JSON preview stays in sync

    const previewConfig: any = {
      type: "http",
      tag: "proxy_out",
      server: httpConfig.server,
      server_port: httpConfig.server_port,
    }
    if (httpConfig.username) {
      previewConfig.username = httpConfig.username
    }
    if (httpConfig.password) {
      previewConfig.password = httpConfig.password
    }
    if (httpConfig.path) {
      previewConfig.path = httpConfig.path
    }
    if (httpConfig.headers) {
      const headersMap: any = {}
      httpConfig.headers.split("\n").forEach((line: string) => {
        const idx = line.indexOf(":")
        if (idx > 0) {
          const key = line.slice(0, idx).trim()
          const val = line.slice(idx + 1).trim()
          if (key && val) headersMap[key] = [val]
        }
      })
      if (Object.keys(headersMap).length > 0) {
        previewConfig.headers = headersMap
      }
    }
    if (httpConfig.tls_enabled) {
      const httpTlsConfig: any = { enabled: true }
      if (httpConfig.tls_server_name) {
        httpTlsConfig.server_name = httpConfig.tls_server_name
      }
      if (httpConfig.tls_insecure) {
        httpTlsConfig.insecure = true
      }
      previewConfig.tls = httpTlsConfig
    }

    setOutbound(0, previewConfig)
  }, [httpConfig, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="127.0.0.1"
            value={httpConfig.server}
            onChange={(e) => setHttpConfig({ ...httpConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={httpConfig.server_port}
            onChange={(e) => setHttpConfig({ ...httpConfig, server_port: parseInt(e.target.value) || 8080 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("usernameOptional")}</Label>
          <Input
            value={httpConfig.username}
            onChange={(e) => setHttpConfig({ ...httpConfig, username: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("passwordOptional")}</Label>
          <Input
            type="password"
            value={httpConfig.password}
            onChange={(e) => setHttpConfig({ ...httpConfig, password: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("requestPathOptional")}</Label>
        <Input
          placeholder="/"
          value={httpConfig.path}
          onChange={(e) => setHttpConfig({ ...httpConfig, path: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("customHeaders")}</Label>
        <textarea
          className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          rows={3}
          value={httpConfig.headers}
          onChange={(e) => setHttpConfig({ ...httpConfig, headers: e.target.value })}
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
              checked={httpConfig.tls_enabled}
              onChange={(e) => setHttpConfig({ ...httpConfig, tls_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableTlsHttps")}
          </label>
          {httpConfig.tls_enabled && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={httpConfig.tls_insecure}
                onChange={(e) => setHttpConfig({ ...httpConfig, tls_insecure: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("insecure")}
            </label>
          )}
        </div>
        {httpConfig.tls_enabled && (
          <div className="space-y-2">
            <Label>{t("sniServerName")}</Label>
            <Input
              placeholder={t("sniPlaceholder")}
              value={httpConfig.tls_server_name}
              onChange={(e) => setHttpConfig({ ...httpConfig, tls_server_name: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
