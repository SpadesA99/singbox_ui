"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

export function AnytlsForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [anytlsConfig, setAnytlsConfig] = useState({
    server: "",
    server_port: 443,
    password: "",
    tls_server_name: "",
    tls_insecure: false,
    idle_session_check_interval: "",
    idle_session_timeout: "",
    min_idle_session: 0,
    tls_alpn: "",
    utls_enabled: false,
    utls_fingerprint: "chrome",
  })

  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "anytls") {
      setAnytlsConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 443,
        password: initialConfig.password || "",
        tls_server_name: initialConfig.tls?.server_name || "",
        tls_insecure: initialConfig.tls?.insecure || false,
        idle_session_check_interval: String(initialConfig.idle_session_check_interval || ""),
        idle_session_timeout: String(initialConfig.idle_session_timeout || ""),
        min_idle_session: Number(initialConfig.min_idle_session) || 0,
        tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
        utls_enabled: initialConfig.tls?.utls?.enabled || false,
        utls_fingerprint: initialConfig.tls?.utls?.fingerprint || "chrome",
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!anytlsConfig.server || !anytlsConfig.password) return

    const previewConfig: any = {
      type: "anytls",
      tag: "proxy_out",
      server: anytlsConfig.server,
      server_port: anytlsConfig.server_port,
      password: anytlsConfig.password,
    }
    // TLS (AnyTLS must have TLS enabled)
    const anytlsTlsConfig: any = { enabled: true }
    if (anytlsConfig.tls_server_name) {
      anytlsTlsConfig.server_name = anytlsConfig.tls_server_name
    }
    if (anytlsConfig.tls_insecure) {
      anytlsTlsConfig.insecure = true
    }
    if (anytlsConfig.tls_alpn) {
      anytlsTlsConfig.alpn = anytlsConfig.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
    }
    if (anytlsConfig.utls_enabled) {
      anytlsTlsConfig.utls = { enabled: true, fingerprint: anytlsConfig.utls_fingerprint }
    }
    previewConfig.tls = anytlsTlsConfig
    // Session management
    if (anytlsConfig.idle_session_check_interval) {
      previewConfig.idle_session_check_interval = anytlsConfig.idle_session_check_interval
    }
    if (anytlsConfig.idle_session_timeout) {
      previewConfig.idle_session_timeout = anytlsConfig.idle_session_timeout
    }
    if (anytlsConfig.min_idle_session > 0) {
      previewConfig.min_idle_session = anytlsConfig.min_idle_session
    }

    setOutbound(0, previewConfig)
  }, [anytlsConfig, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={anytlsConfig.server}
            onChange={(e) => setAnytlsConfig({ ...anytlsConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={anytlsConfig.server_port}
            onChange={(e) => setAnytlsConfig({ ...anytlsConfig, server_port: parseInt(e.target.value) || 443 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{tc("password")}</Label>
        <Input
          placeholder="password"
          value={anytlsConfig.password}
          onChange={(e) => setAnytlsConfig({ ...anytlsConfig, password: e.target.value })}
        />
      </div>

      {/* TLS */}
      <div className="border-t pt-4 mt-4 space-y-4">
        <div className="text-sm font-medium">{t("tlsRequired")}</div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("serverName")}</Label>
            <Input
              placeholder="example.com"
              value={anytlsConfig.tls_server_name}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_server_name: e.target.value })}
            />
          </div>
          <div className="space-y-2 flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={anytlsConfig.tls_insecure}
                onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_insecure: e.target.checked })}
                className="h-4 w-4"
              />
              {t("insecure")}
            </label>
          </div>
        </div>
        <div className="space-y-2">
          <Label>ALPN</Label>
          <Input
            placeholder="h2,http/1.1"
            value={anytlsConfig.tls_alpn}
            onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_alpn: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={anytlsConfig.utls_enabled}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, utls_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableUtls")}
          </label>
        </div>
        {anytlsConfig.utls_enabled && (
          <div className="space-y-2">
            <Label>{t("browserFingerprint")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={anytlsConfig.utls_fingerprint}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, utls_fingerprint: e.target.value })}
            >
              <option value="chrome">Chrome</option>
              <option value="firefox">Firefox</option>
              <option value="safari">Safari</option>
              <option value="edge">Edge</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
              <option value="random">{t("random")}</option>
              <option value="randomized">{t("randomized")}</option>
            </select>
          </div>
        )}
      </div>

      {/* Session management */}
      <div className="border-t pt-4 mt-4 space-y-4">
        <div className="text-sm font-medium">{t("sessionManagement")}</div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>{t("idleCheckInterval")}</Label>
            <Input
              placeholder="30s"
              value={anytlsConfig.idle_session_check_interval}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, idle_session_check_interval: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("idleTimeout")}</Label>
            <Input
              placeholder="30s"
              value={anytlsConfig.idle_session_timeout}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, idle_session_timeout: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("minIdleSessions")}</Label>
            <Input
              type="number"
              placeholder="0"
              value={anytlsConfig.min_idle_session}
              onChange={(e) => setAnytlsConfig({ ...anytlsConfig, min_idle_session: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
