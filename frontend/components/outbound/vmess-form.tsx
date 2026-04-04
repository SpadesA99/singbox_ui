"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps, extractTransportHost } from "./types"
import { Shield, Zap, Globe, Server, Settings, ShieldCheck, Cpu, Network } from "lucide-react"

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
    // allow partial writes so JSON preview stays in sync

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
    <div className="space-y-6">
      {/* Server Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
            <Server className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{t("serverAddr")}</h3>
            <p className="text-xs text-muted-foreground">{t("serverSettingsDesc") || "Basic connection details"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("serverAddr")}</Label>
              <Input
                placeholder="example.com"
                value={vmessConfig.server}
                onChange={(e) => setVmessConfig({ ...vmessConfig, server: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("port")}</Label>
              <Input
                type="number"
                value={vmessConfig.server_port}
                onChange={(e) => setVmessConfig({ ...vmessConfig, server_port: parseInt(e.target.value) || 443 })}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">UUID</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={vmessConfig.uuid}
              onChange={(e) => setVmessConfig({ ...vmessConfig, uuid: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">Alter ID</Label>
              <Input
                type="number"
                value={vmessConfig.alter_id}
                onChange={(e) => setVmessConfig({ ...vmessConfig, alter_id: parseInt(e.target.value) || 0 })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("security")}</Label>
              <Select value={(vmessConfig.security) || "none"} onValueChange={(val) => { setVmessConfig({ ...vmessConfig, security: val }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">auto</SelectItem>
                  <SelectItem value="aes-128-gcm">aes-128-gcm</SelectItem>
                  <SelectItem value="chacha20-poly1305">chacha20-poly1305</SelectItem>
                  <SelectItem value="none">none</SelectItem>
                  <SelectItem value="zero">zero</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("networkType")}</Label>
              <Select value={(vmessConfig.network) || "none"} onValueChange={(val) => { setVmessConfig({ ...vmessConfig, network: (val === "none" ? "" : val)  }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("tcpAndUdp")}</SelectItem>
                  <SelectItem value="tcp">TCP</SelectItem>
                  <SelectItem value="udp">UDP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("packetEncoding")}</Label>
              <Select value={(vmessConfig.packet_encoding) || "none"} onValueChange={(val) => { setVmessConfig({ ...vmessConfig, packet_encoding: (val === "none" ? "" : val)  }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tc("disabled")}</SelectItem>
                  <SelectItem value="xudp">xudp</SelectItem>
                  <SelectItem value="packetaddr">packetaddr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center lg:justify-center pt-2 lg:pt-6">
              <label className="flex items-center gap-2 cursor-pointer group/label">
                <input
                  type="checkbox"
                  checked={vmessConfig.global_padding}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, global_padding: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">Global Padding</span>
              </label>
            </div>
            <div className="flex items-center lg:justify-center pt-2 lg:pt-6">
              <label className="flex items-center gap-2 cursor-pointer group/label">
                <input
                  type="checkbox"
                  checked={vmessConfig.authenticated_length}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, authenticated_length: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">Auth Length</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* TLS Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{t("tlsSettings")}</h3>
              <p className="text-xs text-muted-foreground">{t("tlsSettingsDesc") || "Security and encryption options"}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer group/label">
              <input
                type="checkbox"
                checked={vmessConfig.tls_enabled}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableTls")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group/label">
              <input
                type="checkbox"
                checked={vmessConfig.tls_insecure}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_insecure: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("insecure")}</span>
            </label>
          </div>
        </div>

        {vmessConfig.tls_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("sniServerName")}</Label>
                <Input
                  placeholder={t("sniPlaceholder")}
                  value={vmessConfig.tls_server_name}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, tls_server_name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">ALPN</Label>
                <Input
                  placeholder="h2,http/1.1"
                  value={vmessConfig.tls_alpn}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, tls_alpn: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vmessConfig.tls_fragment}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, tls_fragment: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsFragment")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vmessConfig.tls_record_fragment}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, tls_record_fragment: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsRecordFragment")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vmessConfig.ech_enabled}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, ech_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">ECH</span>
                </label>
              </div>

              {vmessConfig.ech_enabled && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("echConfig")}</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    rows={2}
                    value={vmessConfig.ech_config}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, ech_config: e.target.value })}
                    placeholder={t("echConfigHint")}
                  />
                </div>
              )}
            </div>

            {/* uTLS */}
            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vmessConfig.utls_enabled}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, utls_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableUtls")}</span>
                </label>
              </div>

              {vmessConfig.utls_enabled && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("browserFingerprint")}</Label>
                    <Select value={(vmessConfig.utls_fingerprint) || "none"} onValueChange={(val) => { setVmessConfig({ ...vmessConfig, utls_fingerprint: (val === "none" ? "" : val)  }) }}>
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
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Transport Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-500">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{t("transport")}</h3>
            <p className="text-xs text-muted-foreground">{t("transportDesc") || "Data transmission protocol"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("transportType")}</Label>
            <Select value={(vmessConfig.transport_type) || "none"} onValueChange={(val) => { setVmessConfig({ ...vmessConfig, transport_type: (val === "none" ? "" : val)  }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("tcpDefault")}</SelectItem>
                  <SelectItem value="ws">WebSocket</SelectItem>
                  <SelectItem value="grpc">gRPC</SelectItem>
                  <SelectItem value="http">HTTP/2</SelectItem>
                  <SelectItem value="httpupgrade">HTTPUpgrade</SelectItem>
                </SelectContent>
              </Select>
          </div>

          {(vmessConfig.transport_type === "ws" || vmessConfig.transport_type === "http" || vmessConfig.transport_type === "httpupgrade") && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("path")}</Label>
                <Input
                  placeholder="/"
                  value={vmessConfig.transport_path}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, transport_path: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("host")}</Label>
                <Input
                  placeholder="example.com"
                  value={vmessConfig.transport_host}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, transport_host: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              {vmessConfig.transport_type === "ws" && (
                <>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxEarlyData")}</Label>
                    <Input
                      type="number"
                      value={vmessConfig.ws_max_early_data}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, ws_max_early_data: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("earlyDataHeader")}</Label>
                    <Input
                      value={vmessConfig.ws_early_data_header}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, ws_early_data_header: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {vmessConfig.transport_type === "grpc" && (
            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("serviceName")}</Label>
                <Input
                  placeholder="grpc_service"
                  value={vmessConfig.transport_service_name}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, transport_service_name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Multiplex Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{t("multiplexSettings")}</h3>
              <p className="text-xs text-muted-foreground">{t("multiplexDesc") || "Connection optimization"}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer group/label">
            <input
              type="checkbox"
              checked={vmessConfig.multiplex_enabled}
              onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableMultiplex")}</span>
          </label>
        </div>

        {vmessConfig.multiplex_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("multiplexProtocol")}</Label>
                <Select value={(vmessConfig.multiplex_protocol) || "none"} onValueChange={(val) => { setVmessConfig({ ...vmessConfig, multiplex_protocol: (val === "none" ? "" : val)  }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">smux</SelectItem>
                  <SelectItem value="yamux">yamux</SelectItem>
                  <SelectItem value="h2mux">h2mux</SelectItem>
                </SelectContent>
              </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxConnections")}</Label>
                <Input
                  type="number"
                  value={vmessConfig.multiplex_max_connections}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("minStreams")}</Label>
                  <Input
                    type="number"
                    value={vmessConfig.multiplex_min_streams}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxStreams")}</Label>
                  <Input
                    type="number"
                    value={vmessConfig.multiplex_max_streams}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vmessConfig.multiplex_padding}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enablePadding")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vmessConfig.multiplex_brutal}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_brutal: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableBrutal")}</span>
                </label>
              </div>

              {vmessConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-blue-500/20 animate-in fade-in slide-in-from-left-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={vmessConfig.multiplex_brutal_up}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={vmessConfig.multiplex_brutal_down}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
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
