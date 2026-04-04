"use client"

import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

interface AnytlsFlat {
  server: string
  server_port: number
  password: string
  tls_server_name: string
  tls_insecure: boolean
  idle_session_check_interval: string
  idle_session_timeout: string
  min_idle_session: number
  tls_alpn: string
  utls_enabled: boolean
  utls_fingerprint: string
}

function deriveFlat(initialConfig: any): AnytlsFlat {
  const c = initialConfig?.type === "anytls" ? initialConfig : null
  return {
    server: c?.server || "",
    server_port: c?.server_port || 443,
    password: c?.password || "",
    tls_server_name: c?.tls?.server_name || "",
    tls_insecure: c?.tls?.insecure || false,
    idle_session_check_interval: String(c?.idle_session_check_interval || ""),
    idle_session_timeout: String(c?.idle_session_timeout || ""),
    min_idle_session: Number(c?.min_idle_session) || 0,
    tls_alpn: Array.isArray(c?.tls?.alpn) ? c.tls.alpn.join(",") : "",
    utls_enabled: c?.tls?.utls?.enabled || false,
    utls_fingerprint: c?.tls?.utls?.fingerprint || "chrome",
  }
}

function buildAnytlsOutbound(s: AnytlsFlat): any {
  const previewConfig: any = {
    type: "anytls",
    tag: "proxy_out",
    server: s.server,
    server_port: s.server_port,
    password: s.password,
  }
  // TLS (AnyTLS must have TLS enabled)
  const anytlsTlsConfig: any = { enabled: true }
  if (s.tls_server_name) anytlsTlsConfig.server_name = s.tls_server_name
  if (s.tls_insecure) anytlsTlsConfig.insecure = true
  if (s.tls_alpn) {
    anytlsTlsConfig.alpn = s.tls_alpn.split(",").map((x: string) => x.trim()).filter(Boolean)
  }
  if (s.utls_enabled) {
    anytlsTlsConfig.utls = { enabled: true, fingerprint: s.utls_fingerprint }
  }
  previewConfig.tls = anytlsTlsConfig
  // Session management
  if (s.idle_session_check_interval) previewConfig.idle_session_check_interval = s.idle_session_check_interval
  if (s.idle_session_timeout) previewConfig.idle_session_timeout = s.idle_session_timeout
  if (s.min_idle_session > 0) previewConfig.min_idle_session = s.min_idle_session
  return previewConfig
}

export function AnytlsForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  const updateOutbound = useCallback((patch: Partial<AnytlsFlat>) => {
    const merged = { ...flat, ...patch }
    setOutbound(0, buildAnytlsOutbound(merged))
  }, [flat, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={flat.server}
            onChange={(e) => updateOutbound({ server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={flat.server_port}
            onChange={(e) => updateOutbound({ server_port: parseInt(e.target.value) || 443 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{tc("password")}</Label>
        <Input
          placeholder="password"
          value={flat.password}
          onChange={(e) => updateOutbound({ password: e.target.value })}
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
              value={flat.tls_server_name}
              onChange={(e) => updateOutbound({ tls_server_name: e.target.value })}
            />
          </div>
          <div className="space-y-2 flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={flat.tls_insecure}
                onChange={(e) => updateOutbound({ tls_insecure: e.target.checked })}
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
            value={flat.tls_alpn}
            onChange={(e) => updateOutbound({ tls_alpn: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flat.utls_enabled}
              onChange={(e) => updateOutbound({ utls_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableUtls")}
          </label>
        </div>
        {flat.utls_enabled && (
          <div className="space-y-2">
            <Label>{t("browserFingerprint")}</Label>
            <Select value={(flat.utls_fingerprint) || "none"} onValueChange={(val) => { updateOutbound({ utls_fingerprint: (val === "none" ? "" : val) }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chrome">Chrome</SelectItem>
                  <SelectItem value="firefox">Firefox</SelectItem>
                  <SelectItem value="safari">Safari</SelectItem>
                  <SelectItem value="edge">Edge</SelectItem>
                  <SelectItem value="ios">iOS</SelectItem>
                  <SelectItem value="android">Android</SelectItem>
                  <SelectItem value="random">{t("random")}</SelectItem>
                  <SelectItem value="randomized">{t("randomized")}</SelectItem>
                </SelectContent>
              </Select>
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
              value={flat.idle_session_check_interval}
              onChange={(e) => updateOutbound({ idle_session_check_interval: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("idleTimeout")}</Label>
            <Input
              placeholder="30s"
              value={flat.idle_session_timeout}
              onChange={(e) => updateOutbound({ idle_session_timeout: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("minIdleSessions")}</Label>
            <Input
              type="number"
              placeholder="0"
              value={flat.min_idle_session}
              onChange={(e) => updateOutbound({ min_idle_session: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
