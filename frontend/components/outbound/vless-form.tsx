"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps, extractTransportHost } from "./types"

export function VlessForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [vlessConfig, setVlessConfig] = useState({
    server: "",
    server_port: 443,
    uuid: "",
    flow: "",
    tls_enabled: true,
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    utls_enabled: false,
    utls_fingerprint: "chrome",
    reality_enabled: false,
    reality_public_key: "",
    reality_short_id: "",
    transport_type: "",
    transport_path: "",
    transport_host: "",
    transport_service_name: "",
    packet_encoding: "",
  })

  // Load from initialConfig
  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "vless") {
      setVlessConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 443,
        uuid: initialConfig.uuid || "",
        flow: initialConfig.flow || "",
        tls_enabled: initialConfig.tls?.enabled ?? true,
        tls_server_name: initialConfig.tls?.server_name || "",
        tls_insecure: initialConfig.tls?.insecure || false,
        tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
        utls_enabled: initialConfig.tls?.utls?.enabled || false,
        utls_fingerprint: initialConfig.tls?.utls?.fingerprint || "chrome",
        reality_enabled: initialConfig.tls?.reality?.enabled || false,
        reality_public_key: initialConfig.tls?.reality?.public_key || "",
        reality_short_id: initialConfig.tls?.reality?.short_id || "",
        transport_type: initialConfig.transport?.type || "",
        transport_path: initialConfig.transport?.path || "",
        transport_host: extractTransportHost(initialConfig.transport),
        transport_service_name: initialConfig.transport?.service_name || "",
        packet_encoding: initialConfig.packet_encoding || "",
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!vlessConfig.server || !vlessConfig.uuid) return

    const previewConfig: any = {
      type: "vless",
      tag: "proxy_out",
      server: vlessConfig.server,
      server_port: vlessConfig.server_port,
      uuid: vlessConfig.uuid,
    }
    if (vlessConfig.flow) {
      previewConfig.flow = vlessConfig.flow
    }
    if (vlessConfig.packet_encoding) {
      previewConfig.packet_encoding = vlessConfig.packet_encoding
    }
    // TLS
    if (vlessConfig.tls_enabled) {
      const tlsConfig: any = { enabled: true }
      if (vlessConfig.tls_server_name) {
        tlsConfig.server_name = vlessConfig.tls_server_name
      }
      if (vlessConfig.tls_insecure) {
        tlsConfig.insecure = true
      }
      if (vlessConfig.tls_alpn) {
        tlsConfig.alpn = vlessConfig.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
      }
      if (vlessConfig.reality_enabled) {
        tlsConfig.utls = {
          enabled: true,
          fingerprint: vlessConfig.utls_fingerprint,
        }
        tlsConfig.reality = {
          enabled: true,
          public_key: vlessConfig.reality_public_key,
          short_id: vlessConfig.reality_short_id,
        }
      } else if (vlessConfig.utls_enabled) {
        tlsConfig.utls = {
          enabled: true,
          fingerprint: vlessConfig.utls_fingerprint,
        }
      }
      previewConfig.tls = tlsConfig
    }
    // Transport
    if (vlessConfig.transport_type) {
      const transportConfig: any = { type: vlessConfig.transport_type }
      if (vlessConfig.transport_type === "ws" || vlessConfig.transport_type === "http" || vlessConfig.transport_type === "httpupgrade") {
        if (vlessConfig.transport_path) {
          transportConfig.path = vlessConfig.transport_path
        }
        if (vlessConfig.transport_host) {
          if (vlessConfig.transport_type === "ws" || vlessConfig.transport_type === "httpupgrade") {
            transportConfig.headers = { Host: vlessConfig.transport_host }
          } else {
            transportConfig.host = [vlessConfig.transport_host]
          }
        }
      } else if (vlessConfig.transport_type === "grpc") {
        if (vlessConfig.transport_service_name) {
          transportConfig.service_name = vlessConfig.transport_service_name
        }
      }
      previewConfig.transport = transportConfig
    }

    setOutbound(0, previewConfig)
  }, [vlessConfig, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={vlessConfig.server}
            onChange={(e) => setVlessConfig({ ...vlessConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={vlessConfig.server_port}
            onChange={(e) => setVlessConfig({ ...vlessConfig, server_port: parseInt(e.target.value) || 443 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>UUID</Label>
        <Input
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={vlessConfig.uuid}
          onChange={(e) => setVlessConfig({ ...vlessConfig, uuid: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("flow")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vlessConfig.flow}
            onChange={(e) => setVlessConfig({ ...vlessConfig, flow: e.target.value })}
          >
            <option value="">{t("noneDefault")}</option>
            <option value="xtls-rprx-vision">{t("xtlsVisionRecommended")}</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>{t("packetEncoding")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vlessConfig.packet_encoding}
            onChange={(e) => setVlessConfig({ ...vlessConfig, packet_encoding: e.target.value })}
          >
            <option value="">{tc("disabled")}</option>
            <option value="xudp">xudp</option>
            <option value="packetaddr">packetaddr</option>
          </select>
        </div>
      </div>

      {/* TLS */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("tlsSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vlessConfig.tls_enabled}
              onChange={(e) => setVlessConfig({ ...vlessConfig, tls_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableTls")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vlessConfig.tls_insecure}
              onChange={(e) => setVlessConfig({ ...vlessConfig, tls_insecure: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("insecure")}
          </label>
        </div>
        {vlessConfig.tls_enabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("sniServerName")}</Label>
              <Input
                placeholder={t("sniPlaceholder")}
                value={vlessConfig.tls_server_name}
                onChange={(e) => setVlessConfig({ ...vlessConfig, tls_server_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ALPN</Label>
              <Input
                placeholder="h2,http/1.1"
                value={vlessConfig.tls_alpn}
                onChange={(e) => setVlessConfig({ ...vlessConfig, tls_alpn: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* uTLS (only when TLS enabled and Reality disabled) */}
      {vlessConfig.tls_enabled && !vlessConfig.reality_enabled && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vlessConfig.utls_enabled}
                onChange={(e) => setVlessConfig({ ...vlessConfig, utls_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enableUtls")}
            </label>
          </div>
          {vlessConfig.utls_enabled && (
            <div className="space-y-2">
              <Label>{t("browserFingerprint")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={vlessConfig.utls_fingerprint}
                onChange={(e) => setVlessConfig({ ...vlessConfig, utls_fingerprint: e.target.value })}
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
      )}

      {/* Reality */}
      {vlessConfig.tls_enabled && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vlessConfig.reality_enabled}
                onChange={(e) => setVlessConfig({ ...vlessConfig, reality_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enableReality")}
            </label>
          </div>
          {vlessConfig.reality_enabled && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("utlsFingerprintRequired")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={vlessConfig.utls_fingerprint}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, utls_fingerprint: e.target.value })}
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("realityPublicKey")}</Label>
                  <Input
                    placeholder={t("serverPublicKeyPlaceholder")}
                    value={vlessConfig.reality_public_key}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, reality_public_key: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Short ID</Label>
                  <Input
                    placeholder="0123456789abcdef"
                    value={vlessConfig.reality_short_id}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, reality_short_id: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transport */}
      <div className="border-t pt-4">
        <div className="space-y-2 mb-4">
          <Label className="font-semibold">{t("transport")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vlessConfig.transport_type}
            onChange={(e) => setVlessConfig({ ...vlessConfig, transport_type: e.target.value })}
          >
            <option value="">{t("tcpDefault")}</option>
            <option value="ws">WebSocket</option>
            <option value="grpc">gRPC</option>
            <option value="http">HTTP/2</option>
            <option value="httpupgrade">HTTPUpgrade</option>
          </select>
        </div>
        {(vlessConfig.transport_type === "ws" || vlessConfig.transport_type === "http" || vlessConfig.transport_type === "httpupgrade") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("path")}</Label>
              <Input
                placeholder="/"
                value={vlessConfig.transport_path}
                onChange={(e) => setVlessConfig({ ...vlessConfig, transport_path: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                placeholder="example.com"
                value={vlessConfig.transport_host}
                onChange={(e) => setVlessConfig({ ...vlessConfig, transport_host: e.target.value })}
              />
            </div>
          </div>
        )}
        {vlessConfig.transport_type === "grpc" && (
          <div className="space-y-2">
            <Label>{t("serviceName")}</Label>
            <Input
              placeholder="grpc_service"
              value={vlessConfig.transport_service_name}
              onChange={(e) => setVlessConfig({ ...vlessConfig, transport_service_name: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
