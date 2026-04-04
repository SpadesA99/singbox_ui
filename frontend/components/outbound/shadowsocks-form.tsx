"use client"

import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"
import { Zap, Server, Network } from "lucide-react"

interface SsFlat {
  server: string
  server_port: number
  method: string
  password: string
  plugin: string
  plugin_opts: string
  network: string
  udp_over_tcp: boolean
  multiplex_enabled: boolean
  multiplex_protocol: string
  multiplex_max_connections: number
  multiplex_min_streams: number
  multiplex_max_streams: number
  multiplex_padding: boolean
  multiplex_brutal: boolean
  multiplex_brutal_up: number
  multiplex_brutal_down: number
}

function deriveFlat(initialConfig: any): SsFlat {
  const c = initialConfig?.type === "shadowsocks" ? initialConfig : null
  return {
    server: c?.server || "",
    server_port: c?.server_port || 8388,
    method: c?.method || "aes-128-gcm",
    password: c?.password || "",
    plugin: c?.plugin || "",
    plugin_opts: c?.plugin_opts || "",
    network: (typeof c?.network === "string" ? c.network : "") as string,
    udp_over_tcp: typeof c?.udp_over_tcp === "boolean" ? c.udp_over_tcp : c?.udp_over_tcp?.enabled || false,
    multiplex_enabled: c?.multiplex?.enabled || false,
    multiplex_protocol: c?.multiplex?.protocol || "",
    multiplex_max_connections: c?.multiplex?.max_connections || 0,
    multiplex_min_streams: c?.multiplex?.min_streams || 0,
    multiplex_max_streams: c?.multiplex?.max_streams || 0,
    multiplex_padding: c?.multiplex?.padding || false,
    multiplex_brutal: c?.multiplex?.brutal?.enabled || false,
    multiplex_brutal_up: c?.multiplex?.brutal?.up_mbps || 0,
    multiplex_brutal_down: c?.multiplex?.brutal?.down_mbps || 0,
  }
}

function buildSsOutbound(s: SsFlat): any {
  const previewConfig: any = {
    type: "shadowsocks",
    tag: "proxy_out",
    server: s.server,
    server_port: s.server_port,
    method: s.method,
    password: s.password,
  }
  if (s.plugin) {
    previewConfig.plugin = s.plugin
    if (s.plugin_opts) previewConfig.plugin_opts = s.plugin_opts
  }
  if (s.network) previewConfig.network = s.network
  if (s.udp_over_tcp) previewConfig.udp_over_tcp = { enabled: true }
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

export function ShadowsocksForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  function updateOutbound(patch: Partial<SsFlat>) {
    const merged = { ...flat, ...patch }
    setOutbound(0, buildSsOutbound(merged))
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
                onChange={(e) => updateOutbound({ server_port: parseInt(e.target.value) || 8388 })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("security")}</Label>
              <Select value={(flat.method) || "none"} onValueChange={(val) => { updateOutbound({ method: val }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aes-128-gcm">aes-128-gcm</SelectItem>
                  <SelectItem value="aes-256-gcm">aes-256-gcm</SelectItem>
                  <SelectItem value="chacha20-poly1305">chacha20-poly1305</SelectItem>
                  <SelectItem value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</SelectItem>
                  <SelectItem value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</SelectItem>
                  <SelectItem value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</SelectItem>
                  <SelectItem value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</SelectItem>
                  <SelectItem value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</SelectItem>
                  <SelectItem value="none">none</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("password")}</Label>
              <Input
                type="text"
                value={flat.password}
                onChange={(e) => updateOutbound({ password: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Network & Plugin */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-green-500/10 text-green-500">
            <Network className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{t("networkProtocol")} & {t("sip003Plugin")}</h3>
            <p className="text-xs text-muted-foreground">{"Protocol and plugin configuration"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("networkProtocol")}</Label>
              <Select value={(flat.network) || "none"} onValueChange={(val) => { updateOutbound({ network: (val === "none" ? "" : val) }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("allDefault")}</SelectItem>
                  <SelectItem value="tcp">{t("tcpOnly")}</SelectItem>
                  <SelectItem value="udp">{t("udpOnly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 cursor-pointer group/label">
                <input
                  type="checkbox"
                  id="ss-udp-over-tcp"
                  checked={flat.udp_over_tcp}
                  onChange={(e) => updateOutbound({ udp_over_tcp: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableUdpOverTcp")}</span>
              </label>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("sip003Plugin")}</Label>
              <Select value={(flat.plugin) || "none"} onValueChange={(val) => { updateOutbound({ plugin: (val === "none" ? "" : val) }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tc("none")}</SelectItem>
                  <SelectItem value="obfs-local">obfs-local</SelectItem>
                  <SelectItem value="v2ray-plugin">v2ray-plugin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {flat.plugin && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("pluginOpts")}</Label>
                <Input
                  placeholder="obfs=http;obfs-host=example.com"
                  value={flat.plugin_opts}
                  onChange={(e) => updateOutbound({ plugin_opts: e.target.value })}
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {flat.plugin === "obfs-local" && t("obfsExample")}
                  {flat.plugin === "v2ray-plugin" && t("v2rayPluginExample")}
                </p>
              </div>
            )}
          </div>
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
