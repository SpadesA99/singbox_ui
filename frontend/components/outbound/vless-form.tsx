"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps, extractTransportHost } from "./types"
import { Zap, Globe, Server, ShieldCheck } from "lucide-react"

interface VlessFlat {
  server: string
  server_port: number
  uuid: string
  flow: string
  tls_enabled: boolean
  tls_server_name: string
  tls_insecure: boolean
  tls_alpn: string
  utls_enabled: boolean
  utls_fingerprint: string
  reality_enabled: boolean
  reality_public_key: string
  reality_short_id: string
  transport_type: string
  transport_path: string
  transport_host: string
  transport_service_name: string
  packet_encoding: string
  multiplex_enabled: boolean
  multiplex_protocol: string
  multiplex_max_connections: number
  multiplex_min_streams: number
  multiplex_max_streams: number
  multiplex_padding: boolean
  multiplex_brutal: boolean
  multiplex_brutal_up: number
  multiplex_brutal_down: number
  network: string
  ws_max_early_data: number
  ws_early_data_header: string
  tls_fragment: boolean
  tls_record_fragment: boolean
  ech_enabled: boolean
  ech_config: string
}

function deriveFlat(initialConfig: any): VlessFlat {
  const c = initialConfig?.type === "vless" ? initialConfig : null
  return {
    server: c?.server || "",
    server_port: c?.server_port || 443,
    uuid: c?.uuid || "",
    flow: c?.flow || "",
    tls_enabled: c?.tls?.enabled ?? true,
    tls_server_name: c?.tls?.server_name || "",
    tls_insecure: c?.tls?.insecure || false,
    tls_alpn: Array.isArray(c?.tls?.alpn) ? c.tls.alpn.join(",") : "",
    utls_enabled: c?.tls?.utls?.enabled || false,
    utls_fingerprint: c?.tls?.utls?.fingerprint || "chrome",
    reality_enabled: c?.tls?.reality?.enabled || false,
    reality_public_key: c?.tls?.reality?.public_key || "",
    reality_short_id: c?.tls?.reality?.short_id || "",
    transport_type: c?.transport?.type || "",
    transport_path: c?.transport?.path || "",
    transport_host: extractTransportHost(c?.transport),
    transport_service_name: c?.transport?.service_name || "",
    network: c?.network || "",
    packet_encoding: c?.packet_encoding || "",
    multiplex_enabled: c?.multiplex?.enabled || false,
    multiplex_protocol: c?.multiplex?.protocol || "",
    multiplex_max_connections: c?.multiplex?.max_connections || 0,
    multiplex_min_streams: c?.multiplex?.min_streams || 0,
    multiplex_max_streams: c?.multiplex?.max_streams || 0,
    multiplex_padding: c?.multiplex?.padding || false,
    multiplex_brutal: c?.multiplex?.brutal?.enabled || false,
    multiplex_brutal_up: c?.multiplex?.brutal?.up_mbps || 0,
    multiplex_brutal_down: c?.multiplex?.brutal?.down_mbps || 0,
    ws_max_early_data: c?.transport?.max_early_data || 0,
    ws_early_data_header: c?.transport?.early_data_header_name || "",
    tls_fragment: c?.tls?.fragment || false,
    tls_record_fragment: c?.tls?.record_fragment || false,
    ech_enabled: c?.tls?.ech?.enabled || false,
    ech_config: Array.isArray(c?.tls?.ech?.config) ? c.tls.ech.config.join("\n") : "",
  }
}

function buildVlessOutbound(s: VlessFlat): any {
  const previewConfig: any = {
    type: "vless",
    tag: "proxy_out",
    server: s.server,
    server_port: s.server_port,
    uuid: s.uuid,
  }
  if (s.flow) previewConfig.flow = s.flow
  if (s.network) previewConfig.network = s.network
  if (s.packet_encoding) previewConfig.packet_encoding = s.packet_encoding
  // TLS
  if (s.tls_enabled) {
    const tlsConfig: any = { enabled: true }
    if (s.tls_server_name) tlsConfig.server_name = s.tls_server_name
    if (s.tls_insecure) tlsConfig.insecure = true
    if (s.tls_alpn) {
      tlsConfig.alpn = s.tls_alpn.split(",").map((x: string) => x.trim()).filter(Boolean)
    }
    if (s.reality_enabled) {
      tlsConfig.utls = { enabled: true, fingerprint: s.utls_fingerprint }
      tlsConfig.reality = { enabled: true, public_key: s.reality_public_key, short_id: s.reality_short_id }
    } else if (s.utls_enabled) {
      tlsConfig.utls = { enabled: true, fingerprint: s.utls_fingerprint }
    }
    if (s.tls_fragment) tlsConfig.fragment = true
    if (s.tls_record_fragment) tlsConfig.record_fragment = true
    if (s.ech_enabled) {
      const echConfig: any = { enabled: true }
      if (s.ech_config) {
        echConfig.config = s.ech_config.split("\n").map((x: string) => x.trim()).filter(Boolean)
      }
      tlsConfig.ech = echConfig
    }
    previewConfig.tls = tlsConfig
  }
  // Transport
  if (s.transport_type) {
    const transportConfig: any = { type: s.transport_type }
    if (s.transport_type === "ws" || s.transport_type === "http" || s.transport_type === "httpupgrade") {
      if (s.transport_path) transportConfig.path = s.transport_path
      if (s.transport_host) {
        if (s.transport_type === "ws") {
          transportConfig.headers = { Host: s.transport_host }
        } else if (s.transport_type === "httpupgrade") {
          transportConfig.host = s.transport_host
        } else {
          transportConfig.host = s.transport_host.split(",").map((x: string) => x.trim()).filter(Boolean)
        }
      }
      if (s.transport_type === "ws") {
        if (s.ws_max_early_data) transportConfig.max_early_data = s.ws_max_early_data
        if (s.ws_early_data_header) transportConfig.early_data_header_name = s.ws_early_data_header
      }
    } else if (s.transport_type === "grpc") {
      if (s.transport_service_name) transportConfig.service_name = s.transport_service_name
    }
    previewConfig.transport = transportConfig
  }
  // Multiplex
  if (s.multiplex_enabled) {
    const mux: any = { enabled: true }
    if (s.multiplex_protocol) mux.protocol = s.multiplex_protocol
    if (s.multiplex_max_connections) mux.max_connections = s.multiplex_max_connections
    if (s.multiplex_min_streams) mux.min_streams = s.multiplex_min_streams
    if (s.multiplex_max_streams) mux.max_streams = s.multiplex_max_streams
    if (s.multiplex_padding) mux.padding = true
    if (s.multiplex_brutal) {
      mux.brutal = { enabled: true, up_mbps: s.multiplex_brutal_up, down_mbps: s.multiplex_brutal_down }
    }
    previewConfig.multiplex = mux
  }
  return previewConfig
}

export function VlessForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  function updateOutbound(patch: Partial<VlessFlat>) {
    const merged = { ...flat, ...patch }
    setOutbound(0, buildVlessOutbound(merged))
  }

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
                value={flat.server}
                onChange={(e) => updateOutbound({ server: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("port")}</Label>
              <Input
                type="number"
                value={flat.server_port}
                onChange={(e) => updateOutbound({ server_port: parseInt(e.target.value) || 443 })}
                className="h-9 text-sm"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">UUID</Label>
            <Input
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              value={flat.uuid}
              onChange={(e) => updateOutbound({ uuid: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("flow")}</Label>
              <Select value={(flat.flow) || "none"} onValueChange={(val) => { updateOutbound({ flow: (val === "none" ? "" : val) }) }}>
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
              <Select value={(flat.network) || "none"} onValueChange={(val) => { updateOutbound({ network: (val === "none" ? "" : val) }) }}>
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
              <Select value={(flat.packet_encoding) || "none"} onValueChange={(val) => { updateOutbound({ packet_encoding: (val === "none" ? "" : val) }) }}>
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
                checked={flat.tls_enabled}
                onChange={(e) => updateOutbound({ tls_enabled: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 transition-colors"
              />
              <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableTls")}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer group/label">
              <input
                type="checkbox"
                checked={flat.tls_insecure}
                onChange={(e) => updateOutbound({ tls_insecure: e.target.checked })}
                className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 transition-colors"
              />
              <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("insecure")}</span>
            </label>
          </div>
        </div>

        {flat.tls_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("sniServerName")}</Label>
                <Input
                  placeholder={t("sniPlaceholder")}
                  value={flat.tls_server_name}
                  onChange={(e) => updateOutbound({ tls_server_name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">ALPN</Label>
                <Input
                  placeholder="h2,http/1.1"
                  value={flat.tls_alpn}
                  onChange={(e) => updateOutbound({ tls_alpn: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={flat.tls_fragment}
                    onChange={(e) => updateOutbound({ tls_fragment: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsFragment")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={flat.tls_record_fragment}
                    onChange={(e) => updateOutbound({ tls_record_fragment: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("tlsRecordFragment")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={flat.ech_enabled}
                    onChange={(e) => updateOutbound({ ech_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">ECH</span>
                </label>
              </div>

              {flat.ech_enabled && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("echConfig")}</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    rows={2}
                    value={flat.ech_config}
                    onChange={(e) => updateOutbound({ ech_config: e.target.value })}
                    placeholder={t("echConfigHint")}
                  />
                </div>
              )}
            </div>

            {/* Reality & uTLS */}
            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
              <div className="flex items-center gap-6">
                {!flat.reality_enabled && (
                  <label className="flex items-center gap-2 cursor-pointer group/label">
                    <input
                      type="checkbox"
                      checked={flat.utls_enabled}
                      onChange={(e) => updateOutbound({ utls_enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableUtls")}</span>
                  </label>
                )}
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={flat.reality_enabled}
                    onChange={(e) => updateOutbound({ reality_enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableReality")}</span>
                </label>
              </div>

              {(flat.utls_enabled || flat.reality_enabled) && (
                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("browserFingerprint")}</Label>
                    <Select value={(flat.utls_fingerprint) || "none"} onValueChange={(val) => { updateOutbound({ utls_fingerprint: (val === "none" ? "" : val) }) }}>
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

              {flat.reality_enabled && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("realityPublicKey")}</Label>
                    <Input
                      placeholder={t("serverPublicKeyPlaceholder")}
                      value={flat.reality_public_key}
                      onChange={(e) => updateOutbound({ reality_public_key: e.target.value })}
                      className="h-9 text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">Short ID</Label>
                    <Input
                      placeholder="0123456789abcdef"
                      value={flat.reality_short_id}
                      onChange={(e) => updateOutbound({ reality_short_id: e.target.value })}
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
            <Select value={(flat.transport_type) || "none"} onValueChange={(val) => { updateOutbound({ transport_type: (val === "none" ? "" : val) }) }}>
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

          {(flat.transport_type === "ws" || flat.transport_type === "http" || flat.transport_type === "httpupgrade") && (
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("path")}</Label>
                <Input
                  placeholder="/"
                  value={flat.transport_path}
                  onChange={(e) => updateOutbound({ transport_path: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("host")}</Label>
                <Input
                  placeholder="example.com"
                  value={flat.transport_host}
                  onChange={(e) => updateOutbound({ transport_host: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              {flat.transport_type === "ws" && (
                <>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxEarlyData")}</Label>
                    <Input
                      type="number"
                      value={flat.ws_max_early_data}
                      onChange={(e) => updateOutbound({ ws_max_early_data: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 mt-2">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("earlyDataHeader")}</Label>
                    <Input
                      value={flat.ws_early_data_header}
                      onChange={(e) => updateOutbound({ ws_early_data_header: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {flat.transport_type === "grpc" && (
            <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("serviceName")}</Label>
                <Input
                  placeholder="grpc_service"
                  value={flat.transport_service_name}
                  onChange={(e) => updateOutbound({ transport_service_name: e.target.value })}
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
              checked={flat.multiplex_enabled}
              onChange={(e) => updateOutbound({ multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableMultiplex")}</span>
          </label>
        </div>

        {flat.multiplex_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("multiplexProtocol")}</Label>
                <Select value={(flat.multiplex_protocol) || "none"} onValueChange={(val) => { updateOutbound({ multiplex_protocol: (val === "none" ? "" : val) }) }}>
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
                  value={flat.multiplex_max_connections}
                  onChange={(e) => updateOutbound({ multiplex_max_connections: parseInt(e.target.value) || 0 })}
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
                    value={flat.multiplex_min_streams}
                    onChange={(e) => updateOutbound({ multiplex_min_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxStreams")}</Label>
                  <Input
                    type="number"
                    value={flat.multiplex_max_streams}
                    onChange={(e) => updateOutbound({ multiplex_max_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={flat.multiplex_padding}
                    onChange={(e) => updateOutbound({ multiplex_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enablePadding")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={flat.multiplex_brutal}
                    onChange={(e) => updateOutbound({ multiplex_brutal: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableBrutal")}</span>
                </label>
              </div>

              {flat.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-blue-500/20 animate-in fade-in slide-in-from-left-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={flat.multiplex_brutal_up}
                      onChange={(e) => updateOutbound({ multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={flat.multiplex_brutal_down}
                      onChange={(e) => updateOutbound({ multiplex_brutal_down: parseInt(e.target.value) || 0 })}
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
