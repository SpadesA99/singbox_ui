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
    if (vlessConfig.network) {
      previewConfig.network = vlessConfig.network
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
      if (vlessConfig.tls_fragment) {
        tlsConfig.fragment = true
      }
      if (vlessConfig.tls_record_fragment) {
        tlsConfig.record_fragment = true
      }
      if (vlessConfig.ech_enabled) {
        const echConfig: any = { enabled: true }
        if (vlessConfig.ech_config) {
          echConfig.config = vlessConfig.ech_config.split("\n").map((s: string) => s.trim()).filter(Boolean)
        }
        tlsConfig.ech = echConfig
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
          if (vlessConfig.transport_type === "ws") {
            transportConfig.headers = { Host: vlessConfig.transport_host }
          } else if (vlessConfig.transport_type === "httpupgrade") {
            transportConfig.host = vlessConfig.transport_host
          } else {
            transportConfig.host = vlessConfig.transport_host.split(",").map((s: string) => s.trim()).filter(Boolean)
          }
        }
        if (vlessConfig.transport_type === "ws") {
          if (vlessConfig.ws_max_early_data) transportConfig.max_early_data = vlessConfig.ws_max_early_data
          if (vlessConfig.ws_early_data_header) transportConfig.early_data_header_name = vlessConfig.ws_early_data_header
        }
      } else if (vlessConfig.transport_type === "grpc") {
        if (vlessConfig.transport_service_name) {
          transportConfig.service_name = vlessConfig.transport_service_name
        }
      }
      previewConfig.transport = transportConfig
    }
    // Multiplex
    if (vlessConfig.multiplex_enabled) {
      const mux: any = { enabled: true }
      if (vlessConfig.multiplex_protocol) mux.protocol = vlessConfig.multiplex_protocol
      if (vlessConfig.multiplex_max_connections) mux.max_connections = vlessConfig.multiplex_max_connections
      if (vlessConfig.multiplex_min_streams) mux.min_streams = vlessConfig.multiplex_min_streams
      if (vlessConfig.multiplex_max_streams) mux.max_streams = vlessConfig.multiplex_max_streams
      if (vlessConfig.multiplex_padding) mux.padding = true
      if (vlessConfig.multiplex_brutal) {
        mux.brutal = { enabled: true, up_mbps: vlessConfig.multiplex_brutal_up, down_mbps: vlessConfig.multiplex_brutal_down }
      }
      previewConfig.multiplex = mux
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
      <div className="grid grid-cols-3 gap-4">
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
          <Label>{t("networkType")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={vlessConfig.network}
            onChange={(e) => setVlessConfig({ ...vlessConfig, network: e.target.value })}
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

      {/* Fragment & ECH */}
      {vlessConfig.tls_enabled && (
        <div className="border-t pt-4">
          <div className="flex items-center gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vlessConfig.tls_fragment}
                onChange={(e) => setVlessConfig({ ...vlessConfig, tls_fragment: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("tlsFragment")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vlessConfig.tls_record_fragment}
                onChange={(e) => setVlessConfig({ ...vlessConfig, tls_record_fragment: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("tlsRecordFragment")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vlessConfig.ech_enabled}
                onChange={(e) => setVlessConfig({ ...vlessConfig, ech_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              ECH
            </label>
          </div>
          {vlessConfig.ech_enabled && (
            <div className="space-y-2">
              <Label>{t("echConfig")}</Label>
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                rows={2}
                value={vlessConfig.ech_config}
                onChange={(e) => setVlessConfig({ ...vlessConfig, ech_config: e.target.value })}
                placeholder={t("echConfigHint")}
              />
            </div>
          )}
        </div>
      )}

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
              <Label>{t("host")}</Label>
              <Input
                placeholder="example.com"
                value={vlessConfig.transport_host}
                onChange={(e) => setVlessConfig({ ...vlessConfig, transport_host: e.target.value })}
              />
            </div>
          </div>
        )}
        {vlessConfig.transport_type === "ws" && (
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="space-y-2">
              <Label>{t("maxEarlyData")}</Label>
              <Input
                type="number"
                value={vlessConfig.ws_max_early_data}
                onChange={(e) => setVlessConfig({ ...vlessConfig, ws_max_early_data: parseInt(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("earlyDataHeader")}</Label>
              <Input
                value={vlessConfig.ws_early_data_header}
                onChange={(e) => setVlessConfig({ ...vlessConfig, ws_early_data_header: e.target.value })}
                placeholder="Sec-WebSocket-Protocol"
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

      {/* Multiplex */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("multiplexSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={vlessConfig.multiplex_enabled}
              onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableMultiplex")}
          </label>
        </div>
        {vlessConfig.multiplex_enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("multiplexProtocol")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={vlessConfig.multiplex_protocol}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_protocol: e.target.value })}
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
                  value={vlessConfig.multiplex_max_connections}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("minStreams")}</Label>
                <Input
                  type="number"
                  value={vlessConfig.multiplex_min_streams}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("maxStreams")}</Label>
                <Input
                  type="number"
                  value={vlessConfig.multiplex_max_streams}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vlessConfig.multiplex_padding}
                onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_padding: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enablePadding")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={vlessConfig.multiplex_brutal}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_brutal: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {t("enableBrutal")}
              </label>
              {vlessConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label>{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={vlessConfig.multiplex_brutal_up}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={vlessConfig.multiplex_brutal_down}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
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
