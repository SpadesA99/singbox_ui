"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps, extractTransportHost } from "./types"
import { Shield, Zap, Globe, Server, Settings, ShieldCheck, Cpu, Network } from "lucide-react"

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
    // allow partial writes so JSON preview stays in sync

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
    <div className="space-y-6">
      {/* Server Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Server className="h-4 w-4" />
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
                value={trojanConfig.server}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, server: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("port")}</Label>
              <Input
                type="number"
                value={trojanConfig.server_port}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, server_port: parseInt(e.target.value) || 443 })}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("password")}</Label>
            <Input
              type="password"
              value={trojanConfig.password}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, password: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("networkType")}</Label>
            <Select value={(trojanConfig.network) || "none"} onValueChange={(val) => { setTrojanConfig({ ...trojanConfig, network: (val === "none" ? "" : val)  }) }}>
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
        </div>
      </div>

      {/* TLS Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-500">
              <ShieldCheck className="h-4 w-4" />
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
                checked={trojanConfig.tls_insecure}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_insecure: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 transition-colors"
              />
              <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("insecure")}</span>
            </label>
          </div>
        </div>

        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("sniServerName")}</Label>
              <Input
                placeholder={t("sniPlaceholder")}
                value={trojanConfig.tls_server_name}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_server_name: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">ALPN</Label>
              <Input
                placeholder="h2,http/1.1"
                value={trojanConfig.tls_alpn}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_alpn: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer group/label">
                <input
                  type="checkbox"
                  checked={trojanConfig.tls_fragment}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_fragment: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsFragment")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group/label">
                <input
                  type="checkbox"
                  checked={trojanConfig.tls_record_fragment}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_record_fragment: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsRecordFragment")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group/label">
                <input
                  type="checkbox"
                  checked={trojanConfig.ech_enabled}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, ech_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">ECH</span>
              </label>
            </div>

            {trojanConfig.ech_enabled && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("echConfig")}</Label>
                <textarea
                  className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  rows={2}
                  value={trojanConfig.ech_config}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, ech_config: e.target.value })}
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
                  checked={trojanConfig.utls_enabled}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, utls_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableUtls")}</span>
              </label>
            </div>

            {trojanConfig.utls_enabled && (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("browserFingerprint")}</Label>
                  <Select value={(trojanConfig.utls_fingerprint) || "none"} onValueChange={(val) => { setTrojanConfig({ ...trojanConfig, utls_fingerprint: (val === "none" ? "" : val)  }) }}>
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
      </div>

      {/* Transport Settings */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{t("transport")}</h3>
            <p className="text-xs text-muted-foreground">{t("transportDesc") || "Data transmission protocol"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("transportType")}</Label>
            <Select value={(trojanConfig.transport_type) || "none"} onValueChange={(val) => { setTrojanConfig({ ...trojanConfig, transport_type: (val === "none" ? "" : val)  }) }}>
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

          {(trojanConfig.transport_type === "ws" || trojanConfig.transport_type === "http" || trojanConfig.transport_type === "httpupgrade") && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("path")}</Label>
                <Input
                  placeholder="/"
                  value={trojanConfig.transport_path}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_path: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("host")}</Label>
                <Input
                  placeholder="example.com"
                  value={trojanConfig.transport_host}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_host: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              {trojanConfig.transport_type === "ws" && (
                <>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxEarlyData")}</Label>
                    <Input
                      type="number"
                      value={trojanConfig.ws_max_early_data}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, ws_max_early_data: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("earlyDataHeader")}</Label>
                    <Input
                      value={trojanConfig.ws_early_data_header}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, ws_early_data_header: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {trojanConfig.transport_type === "grpc" && (
            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("serviceName")}</Label>
                <Input
                  placeholder="grpc_service"
                  value={trojanConfig.transport_service_name}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_service_name: e.target.value })}
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
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{t("multiplexSettings")}</h3>
              <p className="text-xs text-muted-foreground">{t("multiplexDesc") || "Connection optimization"}</p>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer group/label">
            <input
              type="checkbox"
              checked={trojanConfig.multiplex_enabled}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableMultiplex")}</span>
          </label>
        </div>

        {trojanConfig.multiplex_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("multiplexProtocol")}</Label>
                <Select value={(trojanConfig.multiplex_protocol) || "none"} onValueChange={(val) => { setTrojanConfig({ ...trojanConfig, multiplex_protocol: (val === "none" ? "" : val)  }) }}>
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
                  value={trojanConfig.multiplex_max_connections}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
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
                    value={trojanConfig.multiplex_min_streams}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxStreams")}</Label>
                  <Input
                    type="number"
                    value={trojanConfig.multiplex_max_streams}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={trojanConfig.multiplex_padding}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enablePadding")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={trojanConfig.multiplex_brutal}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableBrutal")}</span>
                </label>
              </div>

              {trojanConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-blue-500/20 animate-in fade-in slide-in-from-left-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={trojanConfig.multiplex_brutal_up}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={trojanConfig.multiplex_brutal_down}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
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
