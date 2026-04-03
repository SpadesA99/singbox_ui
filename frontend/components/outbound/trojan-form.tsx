"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps, extractTransportHost } from "./types"

export function TrojanForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [trojanConfig, setTrojanConfig] = useState({
    server: "",
    server_port: 443,
    password: "",
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    transport_type: "",
    transport_path: "",
    transport_host: "",
    transport_service_name: "",
  })

  // Load from initialConfig
  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "trojan") {
      setTrojanConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 443,
        password: initialConfig.password || "",
        tls_server_name: initialConfig.tls?.server_name || "",
        tls_insecure: initialConfig.tls?.insecure || false,
        tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
        transport_type: initialConfig.transport?.type || "",
        transport_path: initialConfig.transport?.path || "",
        transport_host: extractTransportHost(initialConfig.transport),
        transport_service_name: initialConfig.transport?.service_name || "",
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!trojanConfig.server || !trojanConfig.password) return

    const previewConfig: any = {
      type: "trojan",
      tag: "proxy_out",
      server: trojanConfig.server,
      server_port: trojanConfig.server_port,
      password: trojanConfig.password,
    }
    // TLS (Trojan always has TLS enabled)
    const trojanTlsConfig: any = { enabled: true }
    if (trojanConfig.tls_server_name) {
      trojanTlsConfig.server_name = trojanConfig.tls_server_name
    }
    if (trojanConfig.tls_insecure) {
      trojanTlsConfig.insecure = true
    }
    if (trojanConfig.tls_alpn) {
      trojanTlsConfig.alpn = trojanConfig.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
    }
    previewConfig.tls = trojanTlsConfig
    // Transport
    if (trojanConfig.transport_type) {
      const transportConfig: any = { type: trojanConfig.transport_type }
      if (trojanConfig.transport_type === "ws" || trojanConfig.transport_type === "http" || trojanConfig.transport_type === "httpupgrade") {
        if (trojanConfig.transport_path) {
          transportConfig.path = trojanConfig.transport_path
        }
        if (trojanConfig.transport_host) {
          if (trojanConfig.transport_type === "ws" || trojanConfig.transport_type === "httpupgrade") {
            transportConfig.headers = { Host: trojanConfig.transport_host }
          } else {
            transportConfig.host = [trojanConfig.transport_host]
          }
        }
      } else if (trojanConfig.transport_type === "grpc") {
        if (trojanConfig.transport_service_name) {
          transportConfig.service_name = trojanConfig.transport_service_name
        }
      }
      previewConfig.transport = transportConfig
    }

    setOutbound(0, previewConfig)
  }, [trojanConfig, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={trojanConfig.server}
            onChange={(e) => setTrojanConfig({ ...trojanConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={trojanConfig.server_port}
            onChange={(e) => setTrojanConfig({ ...trojanConfig, server_port: parseInt(e.target.value) || 443 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{tc("password")}</Label>
        <Input
          type="password"
          value={trojanConfig.password}
          onChange={(e) => setTrojanConfig({ ...trojanConfig, password: e.target.value })}
        />
      </div>

      {/* TLS (Trojan must have TLS) */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("tlsSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trojanConfig.tls_insecure}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_insecure: e.target.checked })}
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
              value={trojanConfig.tls_server_name}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_server_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>ALPN</Label>
            <Input
              placeholder="h2,http/1.1"
              value={trojanConfig.tls_alpn}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_alpn: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Transport */}
      <div className="border-t pt-4">
        <div className="space-y-2 mb-4">
          <Label className="font-semibold">{t("transport")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={trojanConfig.transport_type}
            onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_type: e.target.value })}
          >
            <option value="">{t("tcpDefault")}</option>
            <option value="ws">WebSocket</option>
            <option value="grpc">gRPC</option>
            <option value="http">HTTP/2</option>
            <option value="httpupgrade">HTTPUpgrade</option>
          </select>
        </div>
        {(trojanConfig.transport_type === "ws" || trojanConfig.transport_type === "http" || trojanConfig.transport_type === "httpupgrade") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("path")}</Label>
              <Input
                placeholder="/"
                value={trojanConfig.transport_path}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_path: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                placeholder="example.com"
                value={trojanConfig.transport_host}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_host: e.target.value })}
              />
            </div>
          </div>
        )}
        {trojanConfig.transport_type === "grpc" && (
          <div className="space-y-2">
            <Label>{t("serviceName")}</Label>
            <Input
              placeholder="grpc_service"
              value={trojanConfig.transport_service_name}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_service_name: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
