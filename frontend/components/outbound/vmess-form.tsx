"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps, extractTransportHost } from "./types"

export function VmessForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [vmessConfig, setVmessConfig] = useState({
    server: "",
    server_port: 443,
    uuid: "",
    alter_id: 0,
    security: "auto",
    global_padding: false,
    authenticated_length: true,
    tls_enabled: false,
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    utls_enabled: false,
    utls_fingerprint: "chrome",
    transport_type: "",
    transport_path: "",
    transport_host: "",
    transport_service_name: "",
    packet_encoding: "",
  })

  // Load from initialConfig
  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "vmess") {
      setVmessConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 443,
        uuid: initialConfig.uuid || "",
        alter_id: initialConfig.alter_id || 0,
        security: initialConfig.security || "auto",
        global_padding: initialConfig.global_padding || false,
        authenticated_length: initialConfig.authenticated_length ?? true,
        tls_enabled: initialConfig.tls?.enabled || false,
        tls_server_name: initialConfig.tls?.server_name || "",
        tls_insecure: initialConfig.tls?.insecure || false,
        tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
        utls_enabled: initialConfig.tls?.utls?.enabled || false,
        utls_fingerprint: initialConfig.tls?.utls?.fingerprint || "chrome",
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
    if (!vmessConfig.server || !vmessConfig.uuid) return

    const previewConfig: any = {
      type: "vmess",
      tag: "proxy_out",
      server: vmessConfig.server,
      server_port: vmessConfig.server_port,
      uuid: vmessConfig.uuid,
      security: vmessConfig.security,
      alter_id: vmessConfig.alter_id,
    }
    if (vmessConfig.global_padding) {
      previewConfig.global_padding = true
    }
    if (vmessConfig.authenticated_length) {
      previewConfig.authenticated_length = true
    }
    if (vmessConfig.packet_encoding) {
      previewConfig.packet_encoding = vmessConfig.packet_encoding
    }
    // TLS
    if (vmessConfig.tls_enabled) {
      const tlsConfig: any = { enabled: true }
      if (vmessConfig.tls_server_name) {
        tlsConfig.server_name = vmessConfig.tls_server_name
      }
      if (vmessConfig.tls_insecure) {
        tlsConfig.insecure = true
      }
      if (vmessConfig.tls_alpn) {
        tlsConfig.alpn = vmessConfig.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
      }
      if (vmessConfig.utls_enabled) {
        tlsConfig.utls = {
          enabled: true,
          fingerprint: vmessConfig.utls_fingerprint,
        }
      }
      previewConfig.tls = tlsConfig
    }
    // Transport
    if (vmessConfig.transport_type) {
      const transportConfig: any = { type: vmessConfig.transport_type }
      if (vmessConfig.transport_type === "ws" || vmessConfig.transport_type === "http" || vmessConfig.transport_type === "httpupgrade") {
        if (vmessConfig.transport_path) {
          transportConfig.path = vmessConfig.transport_path
        }
        if (vmessConfig.transport_host) {
          if (vmessConfig.transport_type === "ws" || vmessConfig.transport_type === "httpupgrade") {
            transportConfig.headers = { Host: vmessConfig.transport_host }
          } else {
            transportConfig.host = [vmessConfig.transport_host]
          }
        }
      } else if (vmessConfig.transport_type === "grpc") {
        if (vmessConfig.transport_service_name) {
          transportConfig.service_name = vmessConfig.transport_service_name
        }
      }
      previewConfig.transport = transportConfig
    }

    setOutbound(0, previewConfig)
  }, [vmessConfig, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={vmessConfig.server}
            onChange={(e) => setVmessConfig({ ...vmessConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={vmessConfig.server_port}
            onChange={(e) => setVmessConfig({ ...vmessConfig, server_port: parseInt(e.target.value) || 443 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>UUID</Label>
        <Input
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          value={vmessConfig.uuid}
          onChange={(e) => setVmessConfig({ ...vmessConfig, uuid: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Alter ID</Label>
          <Input
            type="number"
            value={vmessConfig.alter_id}
            onChange={(e) => setVmessConfig({ ...vmessConfig, alter_id: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("security")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vmessConfig.security}
            onChange={(e) => setVmessConfig({ ...vmessConfig, security: e.target.value })}
          >
            <option value="auto">auto</option>
            <option value="aes-128-gcm">aes-128-gcm</option>
            <option value="chacha20-poly1305">chacha20-poly1305</option>
            <option value="none">none</option>
            <option value="zero">zero</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t("packetEncoding")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vmessConfig.packet_encoding}
            onChange={(e) => setVmessConfig({ ...vmessConfig, packet_encoding: e.target.value })}
          >
            <option value="">{tc("disabled")}</option>
            <option value="xudp">xudp</option>
            <option value="packetaddr">packetaddr</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm pt-8">
          <input
            type="checkbox"
            checked={vmessConfig.global_padding}
            onChange={(e) => setVmessConfig({ ...vmessConfig, global_padding: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          Global Padding
        </label>
        <label className="flex items-center gap-2 text-sm pt-8">
          <input
            type="checkbox"
            checked={vmessConfig.authenticated_length}
            onChange={(e) => setVmessConfig({ ...vmessConfig, authenticated_length: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          Authenticated Length
        </label>
      </div>

      {/* TLS */}
      <div className="border-t pt-4 mt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("tlsSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vmessConfig.tls_enabled}
              onChange={(e) => setVmessConfig({ ...vmessConfig, tls_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableTls")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vmessConfig.tls_insecure}
              onChange={(e) => setVmessConfig({ ...vmessConfig, tls_insecure: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("insecure")}
          </label>
        </div>
        {vmessConfig.tls_enabled && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("sniServerName")}</Label>
              <Input
                placeholder={t("sniPlaceholder")}
                value={vmessConfig.tls_server_name}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_server_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>ALPN</Label>
              <Input
                placeholder="h2,http/1.1"
                value={vmessConfig.tls_alpn}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_alpn: e.target.value })}
              />
            </div>
          </div>
        )}
      </div>

      {/* uTLS */}
      {vmessConfig.tls_enabled && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vmessConfig.utls_enabled}
                onChange={(e) => setVmessConfig({ ...vmessConfig, utls_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enableUtls")}
            </label>
          </div>
          {vmessConfig.utls_enabled && (
            <div className="space-y-2">
              <Label>{t("browserFingerprint")}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={vmessConfig.utls_fingerprint}
                onChange={(e) => setVmessConfig({ ...vmessConfig, utls_fingerprint: e.target.value })}
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

      {/* Transport */}
      <div className="border-t pt-4">
        <div className="space-y-2 mb-4">
          <Label className="font-semibold">{t("transport")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vmessConfig.transport_type}
            onChange={(e) => setVmessConfig({ ...vmessConfig, transport_type: e.target.value })}
          >
            <option value="">{t("tcpDefault")}</option>
            <option value="ws">WebSocket</option>
            <option value="grpc">gRPC</option>
            <option value="http">HTTP/2</option>
            <option value="httpupgrade">HTTPUpgrade</option>
          </select>
        </div>
        {(vmessConfig.transport_type === "ws" || vmessConfig.transport_type === "http" || vmessConfig.transport_type === "httpupgrade") && (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("path")}</Label>
              <Input
                placeholder="/"
                value={vmessConfig.transport_path}
                onChange={(e) => setVmessConfig({ ...vmessConfig, transport_path: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Host</Label>
              <Input
                placeholder="example.com"
                value={vmessConfig.transport_host}
                onChange={(e) => setVmessConfig({ ...vmessConfig, transport_host: e.target.value })}
              />
            </div>
          </div>
        )}
        {vmessConfig.transport_type === "grpc" && (
          <div className="space-y-2">
            <Label>{t("serviceName")}</Label>
            <Input
              placeholder="grpc_service"
              value={vmessConfig.transport_service_name}
              onChange={(e) => setVmessConfig({ ...vmessConfig, transport_service_name: e.target.value })}
            />
          </div>
        )}
      </div>
    </div>
  )
}
