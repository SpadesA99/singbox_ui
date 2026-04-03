"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

export function Hysteria2Form({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [hy2Config, setHy2Config] = useState({
    server: "",
    server_port: 443,
    password: "",
    up_mbps: 100,
    down_mbps: 100,
    obfs_type: "",
    obfs_password: "",
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    network: "",
    hop_interval: "",
    server_ports: "",
  })

  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "hysteria2") {
      setHy2Config({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 443,
        password: initialConfig.password || "",
        up_mbps: initialConfig.up_mbps || 100,
        down_mbps: initialConfig.down_mbps || 100,
        obfs_type: initialConfig.obfs?.type || "",
        obfs_password: initialConfig.obfs?.password || "",
        tls_server_name: initialConfig.tls?.server_name || "",
        tls_insecure: initialConfig.tls?.insecure || false,
        tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
        network: Array.isArray(initialConfig.network) ? initialConfig.network[0] : (initialConfig.network || ""),
        hop_interval: initialConfig.hop_interval || "",
        server_ports: Array.isArray(initialConfig.server_ports) ? initialConfig.server_ports.join(", ") : "",
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!hy2Config.server || !hy2Config.password) return

    const previewConfig: any = {
      type: "hysteria2",
      tag: "proxy_out",
      server: hy2Config.server,
      server_port: hy2Config.server_port,
      password: hy2Config.password,
    }
    if (hy2Config.up_mbps) {
      previewConfig.up_mbps = hy2Config.up_mbps
    }
    if (hy2Config.down_mbps) {
      previewConfig.down_mbps = hy2Config.down_mbps
    }
    if (hy2Config.network) {
      previewConfig.network = hy2Config.network
    }
    if (hy2Config.obfs_type === "salamander" && hy2Config.obfs_password) {
      previewConfig.obfs = {
        type: "salamander",
        password: hy2Config.obfs_password,
      }
    }
    // TLS (Hysteria2 must have TLS enabled)
    const tlsConfig: any = { enabled: true }
    if (hy2Config.tls_server_name) {
      tlsConfig.server_name = hy2Config.tls_server_name
    }
    if (hy2Config.tls_insecure) {
      tlsConfig.insecure = true
    }
    if (hy2Config.tls_alpn) {
      tlsConfig.alpn = hy2Config.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
    }
    previewConfig.tls = tlsConfig
    if (hy2Config.server_ports) {
      previewConfig.server_ports = hy2Config.server_ports.split(",").map((s: string) => s.trim()).filter(Boolean)
    }
    if (hy2Config.hop_interval) {
      previewConfig.hop_interval = hy2Config.hop_interval
    }

    setOutbound(0, previewConfig)
  }, [hy2Config, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={hy2Config.server}
            onChange={(e) => setHy2Config({ ...hy2Config, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={hy2Config.server_port}
            onChange={(e) => setHy2Config({ ...hy2Config, server_port: parseInt(e.target.value) || 443 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{tc("password")}</Label>
        <Input
          type="password"
          value={hy2Config.password}
          onChange={(e) => setHy2Config({ ...hy2Config, password: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t("upBandwidth")}</Label>
          <Input
            type="number"
            value={hy2Config.up_mbps}
            onChange={(e) => setHy2Config({ ...hy2Config, up_mbps: parseInt(e.target.value) || 100 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("downBandwidth")}</Label>
          <Input
            type="number"
            value={hy2Config.down_mbps}
            onChange={(e) => setHy2Config({ ...hy2Config, down_mbps: parseInt(e.target.value) || 100 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("networkProtocol")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={hy2Config.network}
            onChange={(e) => setHy2Config({ ...hy2Config, network: e.target.value })}
          >
            <option value="">{t("allDefault")}</option>
            <option value="tcp">{t("tcpOnly")}</option>
            <option value="udp">{t("udpOnly")}</option>
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("serverPorts")}</Label>
        <Input
          value={hy2Config.server_ports}
          onChange={(e) => setHy2Config({ ...hy2Config, server_ports: e.target.value })}
          placeholder={t("serverPortsHint")}
        />
      </div>
      <div className="space-y-2">
        <Label>{t("hopInterval")}</Label>
        <Input
          value={hy2Config.hop_interval}
          onChange={(e) => setHy2Config({ ...hy2Config, hop_interval: e.target.value })}
          placeholder={t("hopIntervalHint")}
        />
      </div>

      {/* Obfuscation */}
      <div className="border-t pt-4 mt-4">
        <div className="space-y-2 mb-4">
          <Label className="font-semibold">{t("quicObfs")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={hy2Config.obfs_type}
            onChange={(e) => setHy2Config({ ...hy2Config, obfs_type: e.target.value })}
          >
            <option value="">{tc("disabled")}</option>
            <option value="salamander">Salamander</option>
          </select>
        </div>
        {hy2Config.obfs_type === "salamander" && (
          <div className="space-y-2">
            <Label>{t("obfsPassword")}</Label>
            <Input
              placeholder={t("obfsPassword")}
              value={hy2Config.obfs_password}
              onChange={(e) => setHy2Config({ ...hy2Config, obfs_password: e.target.value })}
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
              checked={hy2Config.tls_insecure}
              onChange={(e) => setHy2Config({ ...hy2Config, tls_insecure: e.target.checked })}
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
              value={hy2Config.tls_server_name}
              onChange={(e) => setHy2Config({ ...hy2Config, tls_server_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>ALPN</Label>
            <Input
              placeholder="h3"
              value={hy2Config.tls_alpn}
              onChange={(e) => setHy2Config({ ...hy2Config, tls_alpn: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
