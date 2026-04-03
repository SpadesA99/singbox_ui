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
    utls_enabled: false,
    utls_fingerprint: "chrome",
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
        network: initialConfig.network || "",
        utls_enabled: initialConfig.tls?.utls?.enabled || false,
        utls_fingerprint: initialConfig.tls?.utls?.fingerprint || "chrome",
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
    if (!trojanConfig.server || !trojanConfig.password) return

    const previewConfig: any = {
      type: "trojan",
      tag: "proxy_out",
      server: trojanConfig.server,
      server_port: trojanConfig.server_port,
      password: trojanConfig.password,
    }
    if (trojanConfig.network) {
      previewConfig.network = trojanConfig.network
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
    if (trojanConfig.utls_enabled) {
      trojanTlsConfig.utls = { enabled: true, fingerprint: trojanConfig.utls_fingerprint }
    }
    if (trojanConfig.tls_fragment) {
      trojanTlsConfig.fragment = true
    }
    if (trojanConfig.tls_record_fragment) {
      trojanTlsConfig.record_fragment = true
    }
    if (trojanConfig.ech_enabled) {
      const echConfig: any = { enabled: true }
      if (trojanConfig.ech_config) {
        echConfig.config = trojanConfig.ech_config.split("\n").map((s: string) => s.trim()).filter(Boolean)
      }
      trojanTlsConfig.ech = echConfig
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
          if (trojanConfig.transport_type === "ws") {
            transportConfig.headers = { Host: trojanConfig.transport_host }
          } else if (trojanConfig.transport_type === "httpupgrade") {
            transportConfig.host = trojanConfig.transport_host
          } else {
            transportConfig.host = trojanConfig.transport_host.split(",").map((s: string) => s.trim()).filter(Boolean)
          }
        }
        if (trojanConfig.transport_type === "ws") {
          if (trojanConfig.ws_max_early_data) transportConfig.max_early_data = trojanConfig.ws_max_early_data
          if (trojanConfig.ws_early_data_header) transportConfig.early_data_header_name = trojanConfig.ws_early_data_header
        }
      } else if (trojanConfig.transport_type === "grpc") {
        if (trojanConfig.transport_service_name) {
          transportConfig.service_name = trojanConfig.transport_service_name
        }
      }
      previewConfig.transport = transportConfig
    }
    // Multiplex
    if (trojanConfig.multiplex_enabled) {
      const mux: any = { enabled: true }
      if (trojanConfig.multiplex_protocol) mux.protocol = trojanConfig.multiplex_protocol
      if (trojanConfig.multiplex_max_connections) mux.max_connections = trojanConfig.multiplex_max_connections
      if (trojanConfig.multiplex_min_streams) mux.min_streams = trojanConfig.multiplex_min_streams
      if (trojanConfig.multiplex_max_streams) mux.max_streams = trojanConfig.multiplex_max_streams
      if (trojanConfig.multiplex_padding) mux.padding = true
      if (trojanConfig.multiplex_brutal) {
        mux.brutal = { enabled: true, up_mbps: trojanConfig.multiplex_brutal_up, down_mbps: trojanConfig.multiplex_brutal_down }
      }
      previewConfig.multiplex = mux
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

      <div className="space-y-2">
        <Label>{t("networkType")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={trojanConfig.network}
          onChange={(e) => setTrojanConfig({ ...trojanConfig, network: e.target.value })}
        >
          <option value="">{t("tcpAndUdp")}</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
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

      {/* Fragment & ECH */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trojanConfig.tls_fragment}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_fragment: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("tlsFragment")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trojanConfig.tls_record_fragment}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_record_fragment: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("tlsRecordFragment")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trojanConfig.ech_enabled}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, ech_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            ECH
          </label>
        </div>
        {trojanConfig.ech_enabled && (
          <div className="space-y-2">
            <Label>{t("echConfig")}</Label>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              rows={2}
              value={trojanConfig.ech_config}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, ech_config: e.target.value })}
              placeholder={t("echConfigHint")}
            />
          </div>
        )}
      </div>

      {/* uTLS */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trojanConfig.utls_enabled}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, utls_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableUtls")}
          </label>
        </div>
        {trojanConfig.utls_enabled && (
          <div className="space-y-2">
            <Label>{t("browserFingerprint")}</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={trojanConfig.utls_fingerprint}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, utls_fingerprint: e.target.value })}
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
              <Label>{t("host")}</Label>
              <Input
                placeholder="example.com"
                value={trojanConfig.transport_host}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_host: e.target.value })}
              />
            </div>
          </div>
        )}
        {trojanConfig.transport_type === "ws" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label>{t("maxEarlyData")}</Label>
              <Input
                type="number"
                value={trojanConfig.ws_max_early_data}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, ws_max_early_data: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("earlyDataHeader")}</Label>
              <Input
                value={trojanConfig.ws_early_data_header}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, ws_early_data_header: e.target.value })}
                placeholder="Sec-WebSocket-Protocol"
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

      {/* Multiplex */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("multiplexSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={trojanConfig.multiplex_enabled}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableMultiplex")}
          </label>
        </div>
        {trojanConfig.multiplex_enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("multiplexProtocol")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={trojanConfig.multiplex_protocol}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_protocol: e.target.value })}
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
                  value={trojanConfig.multiplex_max_connections}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("minStreams")}</Label>
                <Input
                  type="number"
                  value={trojanConfig.multiplex_min_streams}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("maxStreams")}</Label>
                <Input
                  type="number"
                  value={trojanConfig.multiplex_max_streams}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={trojanConfig.multiplex_padding}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_padding: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enablePadding")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={trojanConfig.multiplex_brutal}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {t("enableBrutal")}
              </label>
              {trojanConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label>{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={trojanConfig.multiplex_brutal_up}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={trojanConfig.multiplex_brutal_down}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
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
