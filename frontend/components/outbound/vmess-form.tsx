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
    multiplex_enabled: false,
    multiplex_protocol: "",
    multiplex_max_connections: 0,
    multiplex_min_streams: 0,
    multiplex_max_streams: 0,
    multiplex_padding: false,
    multiplex_brutal: false,
    multiplex_brutal_up: 0,
    multiplex_brutal_down: 0,
    network: "",
    ws_max_early_data: 0,
    ws_early_data_header: "",
    tls_fragment: false,
    tls_record_fragment: false,
    ech_enabled: false,
    ech_config: "",
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
        network: initialConfig.network || "",
        packet_encoding: initialConfig.packet_encoding || "",
        multiplex_enabled: initialConfig.multiplex?.enabled || false,
        multiplex_protocol: initialConfig.multiplex?.protocol || "",
        multiplex_max_connections: initialConfig.multiplex?.max_connections || 0,
        multiplex_min_streams: initialConfig.multiplex?.min_streams || 0,
        multiplex_max_streams: initialConfig.multiplex?.max_streams || 0,
        multiplex_padding: initialConfig.multiplex?.padding || false,
        multiplex_brutal: initialConfig.multiplex?.brutal?.enabled || false,
        multiplex_brutal_up: initialConfig.multiplex?.brutal?.up_mbps || 0,
        multiplex_brutal_down: initialConfig.multiplex?.brutal?.down_mbps || 0,
        ws_max_early_data: initialConfig.transport?.max_early_data || 0,
        ws_early_data_header: initialConfig.transport?.early_data_header_name || "",
        tls_fragment: initialConfig.tls?.fragment || false,
        tls_record_fragment: initialConfig.tls?.record_fragment || false,
        ech_enabled: initialConfig.tls?.ech?.enabled || false,
        ech_config: Array.isArray(initialConfig.tls?.ech?.config) ? initialConfig.tls.ech.config.join("\n") : "",
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
    if (vmessConfig.network) {
      previewConfig.network = vmessConfig.network
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
      if (vmessConfig.tls_fragment) {
        tlsConfig.fragment = true
      }
      if (vmessConfig.tls_record_fragment) {
        tlsConfig.record_fragment = true
      }
      if (vmessConfig.ech_enabled) {
        const echConfig: any = { enabled: true }
        if (vmessConfig.ech_config) {
          echConfig.config = vmessConfig.ech_config.split("\n").map((s: string) => s.trim()).filter(Boolean)
        }
        tlsConfig.ech = echConfig
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
          if (vmessConfig.transport_type === "ws") {
            transportConfig.headers = { Host: vmessConfig.transport_host }
          } else if (vmessConfig.transport_type === "httpupgrade") {
            transportConfig.host = vmessConfig.transport_host
          } else {
            transportConfig.host = vmessConfig.transport_host.split(",").map((s: string) => s.trim()).filter(Boolean)
          }
        }
        if (vmessConfig.transport_type === "ws") {
          if (vmessConfig.ws_max_early_data) transportConfig.max_early_data = vmessConfig.ws_max_early_data
          if (vmessConfig.ws_early_data_header) transportConfig.early_data_header_name = vmessConfig.ws_early_data_header
        }
      } else if (vmessConfig.transport_type === "grpc") {
        if (vmessConfig.transport_service_name) {
          transportConfig.service_name = vmessConfig.transport_service_name
        }
      }
      previewConfig.transport = transportConfig
    }
    // Multiplex
    if (vmessConfig.multiplex_enabled) {
      const mux: any = { enabled: true }
      if (vmessConfig.multiplex_protocol) mux.protocol = vmessConfig.multiplex_protocol
      if (vmessConfig.multiplex_max_connections) mux.max_connections = vmessConfig.multiplex_max_connections
      if (vmessConfig.multiplex_min_streams) mux.min_streams = vmessConfig.multiplex_min_streams
      if (vmessConfig.multiplex_max_streams) mux.max_streams = vmessConfig.multiplex_max_streams
      if (vmessConfig.multiplex_padding) mux.padding = true
      if (vmessConfig.multiplex_brutal) {
        mux.brutal = { enabled: true, up_mbps: vmessConfig.multiplex_brutal_up, down_mbps: vmessConfig.multiplex_brutal_down }
      }
      previewConfig.multiplex = mux
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
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>{t("networkType")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vmessConfig.network}
            onChange={(e) => setVmessConfig({ ...vmessConfig, network: e.target.value })}
          >
            <option value="">{t("tcpAndUdp")}</option>
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </select>
        </div>
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

      {/* Fragment & ECH */}
      {vmessConfig.tls_enabled && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vmessConfig.tls_fragment}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_fragment: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("tlsFragment")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vmessConfig.tls_record_fragment}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_record_fragment: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("tlsRecordFragment")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vmessConfig.ech_enabled}
                onChange={(e) => setVmessConfig({ ...vmessConfig, ech_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              ECH
            </label>
          </div>
          {vmessConfig.ech_enabled && (
            <div className="space-y-2">
              <Label>{t("echConfig")}</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                rows={2}
                value={vmessConfig.ech_config}
                onChange={(e) => setVmessConfig({ ...vmessConfig, ech_config: e.target.value })}
                placeholder={t("echConfigHint")}
              />
            </div>
          )}
        </div>
      )}

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
              <Label>{t("host")}</Label>
              <Input
                placeholder="example.com"
                value={vmessConfig.transport_host}
                onChange={(e) => setVmessConfig({ ...vmessConfig, transport_host: e.target.value })}
              />
            </div>
          </div>
        )}
        {vmessConfig.transport_type === "ws" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label>{t("maxEarlyData")}</Label>
              <Input
                type="number"
                value={vmessConfig.ws_max_early_data}
                onChange={(e) => setVmessConfig({ ...vmessConfig, ws_max_early_data: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("earlyDataHeader")}</Label>
              <Input
                value={vmessConfig.ws_early_data_header}
                onChange={(e) => setVmessConfig({ ...vmessConfig, ws_early_data_header: e.target.value })}
                placeholder="Sec-WebSocket-Protocol"
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

      {/* Multiplex */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("multiplexSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vmessConfig.multiplex_enabled}
              onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableMultiplex")}
          </label>
        </div>
        {vmessConfig.multiplex_enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("multiplexProtocol")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={vmessConfig.multiplex_protocol}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_protocol: e.target.value })}
                >
                  <option value="">smux</option>
                  <option value="yamux">yamux</option>
                  <option value="h2mux">h2mux</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{t("maxConnections")}</Label>
                <Input
                  type="number"
                  value={vmessConfig.multiplex_max_connections}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("minStreams")}</Label>
                <Input
                  type="number"
                  value={vmessConfig.multiplex_min_streams}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("maxStreams")}</Label>
                <Input
                  type="number"
                  value={vmessConfig.multiplex_max_streams}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vmessConfig.multiplex_padding}
                onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_padding: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enablePadding")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vmessConfig.multiplex_brutal}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_brutal: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {t("enableBrutal")}
              </label>
              {vmessConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label>{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={vmessConfig.multiplex_brutal_up}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={vmessConfig.multiplex_brutal_down}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
