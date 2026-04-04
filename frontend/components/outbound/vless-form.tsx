"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps, extractTransportHost } from "./types"
import { Zap, Globe, Server, ShieldCheck } from "lucide-react"

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
                value={vlessConfig.server}
                onChange={(e) => setVlessConfig({ ...vlessConfig, server: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("port")}</Label>
              <Input
                type="number"
                value={vlessConfig.server_port}
                onChange={(e) => setVlessConfig({ ...vlessConfig, server_port: parseInt(e.target.value) || 443 })}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">UUID</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={vlessConfig.uuid}
              onChange={(e) => setVlessConfig({ ...vlessConfig, uuid: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("flow")}</Label>
              <Select value={(vlessConfig.flow) || "none"} onValueChange={(val) => { setVlessConfig({ ...vlessConfig, flow: (val === "none" ? "" : val)  }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noneDefault")}</SelectItem>
                  <SelectItem value="xtls-rprx-vision">{t("xtlsVisionRecommended")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("networkType")}</Label>
              <Select value={(vlessConfig.network) || "none"} onValueChange={(val) => { setVlessConfig({ ...vlessConfig, network: (val === "none" ? "" : val)  }) }}>
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
              <Select value={(vlessConfig.packet_encoding) || "none"} onValueChange={(val) => { setVlessConfig({ ...vlessConfig, packet_encoding: (val === "none" ? "" : val)  }) }}>
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
                checked={vlessConfig.tls_enabled}
                onChange={(e) => setVlessConfig({ ...vlessConfig, tls_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 transition-colors"
              />
              <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableTls")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group/label">
              <input
                type="checkbox"
                checked={vlessConfig.tls_insecure}
                onChange={(e) => setVlessConfig({ ...vlessConfig, tls_insecure: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 transition-colors"
              />
              <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("insecure")}</span>
            </label>
          </div>
        </div>

        {vlessConfig.tls_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("sniServerName")}</Label>
                <Input
                  placeholder={t("sniPlaceholder")}
                  value={vlessConfig.tls_server_name}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, tls_server_name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">ALPN</Label>
                <Input
                  placeholder="h2,http/1.1"
                  value={vlessConfig.tls_alpn}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, tls_alpn: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vlessConfig.tls_fragment}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, tls_fragment: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsFragment")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vlessConfig.tls_record_fragment}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, tls_record_fragment: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsRecordFragment")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vlessConfig.ech_enabled}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, ech_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">ECH</span>
                </label>
              </div>

              {vlessConfig.ech_enabled && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("echConfig")}</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    rows={2}
                    value={vlessConfig.ech_config}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, ech_config: e.target.value })}
                    placeholder={t("echConfigHint")}
                  />
                </div>
              )}
            </div>

            {/* Reality & uTLS */}
            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
              <div className="flex items-center gap-6">
                {!vlessConfig.reality_enabled && (
                  <label className="flex items-center gap-2 cursor-pointer group/label">
                    <input
                      type="checkbox"
                      checked={vlessConfig.utls_enabled}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, utls_enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableUtls")}</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vlessConfig.reality_enabled}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, reality_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableReality")}</span>
                </label>
              </div>

              {(vlessConfig.utls_enabled || vlessConfig.reality_enabled) && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("browserFingerprint")}</Label>
                    <Select value={(vlessConfig.utls_fingerprint) || "none"} onValueChange={(val) => { setVlessConfig({ ...vlessConfig, utls_fingerprint: (val === "none" ? "" : val)  }) }}>
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

              {vlessConfig.reality_enabled && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("realityPublicKey")}</Label>
                    <Input
                      placeholder={t("serverPublicKeyPlaceholder")}
                      value={vlessConfig.reality_public_key}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, reality_public_key: e.target.value })}
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">Short ID</Label>
                    <Input
                      placeholder="0123456789abcdef"
                      value={vlessConfig.reality_short_id}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, reality_short_id: e.target.value })}
                      className="h-9 text-sm font-mono"
                    />
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
            <Select value={(vlessConfig.transport_type) || "none"} onValueChange={(val) => { setVlessConfig({ ...vlessConfig, transport_type: (val === "none" ? "" : val)  }) }}>
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

          {(vlessConfig.transport_type === "ws" || vlessConfig.transport_type === "http" || vlessConfig.transport_type === "httpupgrade") && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("path")}</Label>
                <Input
                  placeholder="/"
                  value={vlessConfig.transport_path}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, transport_path: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("host")}</Label>
                <Input
                  placeholder="example.com"
                  value={vlessConfig.transport_host}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, transport_host: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              {vlessConfig.transport_type === "ws" && (
                <>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxEarlyData")}</Label>
                    <Input
                      type="number"
                      value={vlessConfig.ws_max_early_data}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, ws_max_early_data: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("earlyDataHeader")}</Label>
                    <Input
                      value={vlessConfig.ws_early_data_header}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, ws_early_data_header: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {vlessConfig.transport_type === "grpc" && (
            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("serviceName")}</Label>
                <Input
                  placeholder="grpc_service"
                  value={vlessConfig.transport_service_name}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, transport_service_name: e.target.value })}
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
              checked={vlessConfig.multiplex_enabled}
              onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableMultiplex")}</span>
          </label>
        </div>

        {vlessConfig.multiplex_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("multiplexProtocol")}</Label>
                <Select value={(vlessConfig.multiplex_protocol) || "none"} onValueChange={(val) => { setVlessConfig({ ...vlessConfig, multiplex_protocol: (val === "none" ? "" : val)  }) }}>
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
                  value={vlessConfig.multiplex_max_connections}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
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
                    value={vlessConfig.multiplex_min_streams}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxStreams")}</Label>
                  <Input
                    type="number"
                    value={vlessConfig.multiplex_max_streams}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vlessConfig.multiplex_padding}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enablePadding")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={vlessConfig.multiplex_brutal}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_brutal: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableBrutal")}</span>
                </label>
              </div>

              {vlessConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-blue-500/20 animate-in fade-in slide-in-from-left-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={vlessConfig.multiplex_brutal_up}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={vlessConfig.multiplex_brutal_down}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
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
