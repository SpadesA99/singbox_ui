"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

interface Hy2Flat {
  server: string
  server_port: number
  password: string
  up_mbps: number
  down_mbps: number
  obfs_type: string
  obfs_password: string
  tls_server_name: string
  tls_insecure: boolean
  tls_alpn: string
  network: string
  hop_interval: string
  server_ports: string
}

function deriveFlat(initialConfig: any): Hy2Flat {
  const c = initialConfig?.type === "hysteria2" ? initialConfig : null
  return {
    server: c?.server || "",
    server_port: c?.server_port || 443,
    password: c?.password || "",
    up_mbps: c?.up_mbps || 100,
    down_mbps: c?.down_mbps || 100,
    obfs_type: c?.obfs?.type || "",
    obfs_password: c?.obfs?.password || "",
    tls_server_name: c?.tls?.server_name || "",
    tls_insecure: c?.tls?.insecure || false,
    tls_alpn: Array.isArray(c?.tls?.alpn) ? c.tls.alpn.join(",") : "",
    network: Array.isArray(c?.network) ? c.network[0] : (c?.network || ""),
    hop_interval: c?.hop_interval || "",
    server_ports: Array.isArray(c?.server_ports) ? c.server_ports.join(", ") : "",
  }
}

function buildHy2Outbound(s: Hy2Flat): any {
  const previewConfig: any = {
    type: "hysteria2",
    tag: "proxy_out",
    server: s.server,
    server_port: s.server_port,
    password: s.password,
  }
  if (s.up_mbps) previewConfig.up_mbps = s.up_mbps
  if (s.down_mbps) previewConfig.down_mbps = s.down_mbps
  if (s.network) previewConfig.network = s.network
  if (s.obfs_type === "salamander" && s.obfs_password) {
    previewConfig.obfs = { type: "salamander", password: s.obfs_password }
  }
  // TLS (Hysteria2 must have TLS enabled)
  const tlsConfig: any = { enabled: true }
  if (s.tls_server_name) tlsConfig.server_name = s.tls_server_name
  if (s.tls_insecure) tlsConfig.insecure = true
  if (s.tls_alpn) {
    tlsConfig.alpn = s.tls_alpn.split(",").map((x: string) => x.trim()).filter(Boolean)
  }
  previewConfig.tls = tlsConfig
  if (s.server_ports) {
    previewConfig.server_ports = s.server_ports.split(",").map((x: string) => x.trim()).filter(Boolean)
  }
  if (s.hop_interval) previewConfig.hop_interval = s.hop_interval
  return previewConfig
}

export function Hysteria2Form({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  function updateOutbound(patch: Partial<Hy2Flat>) {
    const merged = { ...flat, ...patch }
    setOutbound(0, buildHy2Outbound(merged))
  }

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
          type="password"
          value={flat.password}
          onChange={(e) => updateOutbound({ password: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t("upBandwidth")}</Label>
          <Input
            type="number"
            value={flat.up_mbps}
            onChange={(e) => updateOutbound({ up_mbps: parseInt(e.target.value) || 100 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("downBandwidth")}</Label>
          <Input
            type="number"
            value={flat.down_mbps}
            onChange={(e) => updateOutbound({ down_mbps: parseInt(e.target.value) || 100 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("networkProtocol")}</Label>
          <Select value={(flat.network) || "none"} onValueChange={(val) => { updateOutbound({ network: (val === "none" ? "" : val) }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("allDefault")}</SelectItem>
                  <SelectItem value="tcp">{t("tcpOnly")}</SelectItem>
                  <SelectItem value="udp">{t("udpOnly")}</SelectItem>
                </SelectContent>
              </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("serverPorts")}</Label>
        <Input
          value={flat.server_ports}
          onChange={(e) => updateOutbound({ server_ports: e.target.value })}
          placeholder={t("serverPortsHint")}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("hopInterval")}</Label>
        <Input
          value={flat.hop_interval}
          onChange={(e) => updateOutbound({ hop_interval: e.target.value })}
          placeholder={t("hopIntervalHint")}
        />
      </div>

      {/* Obfuscation */}
      <div className="border-t pt-4 mt-4">
        <div className="space-y-2 mb-4">
          <Label className="font-semibold">{t("quicObfs")}</Label>
          <Select value={(flat.obfs_type) || "none"} onValueChange={(val) => { updateOutbound({ obfs_type: (val === "none" ? "" : val) }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tc("disabled")}</SelectItem>
                  <SelectItem value="salamander">Salamander</SelectItem>
                </SelectContent>
              </Select>
        </div>
        {flat.obfs_type === "salamander" && (
          <div className="space-y-2">
            <Label>{t("obfsPassword")}</Label>
            <Input
              placeholder={t("obfsPassword")}
              value={flat.obfs_password}
              onChange={(e) => updateOutbound({ obfs_password: e.target.value })}
            />
          </div>
        )}
      </div>

      {/* TLS */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("tlsSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={flat.tls_insecure}
              onChange={(e) => updateOutbound({ tls_insecure: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("insecure")}
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("sniServerName")}</Label>
            <Input
              placeholder={t("sniPlaceholder")}
              value={flat.tls_server_name}
              onChange={(e) => updateOutbound({ tls_server_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>ALPN</Label>
            <Input
              placeholder="h3"
              value={flat.tls_alpn}
              onChange={(e) => updateOutbound({ tls_alpn: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
