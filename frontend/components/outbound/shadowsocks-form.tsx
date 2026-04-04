"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"
import { Shield, Zap, Globe, Server, Settings, ShieldCheck, Cpu, Network, Plug } from "lucide-react"

export function ShadowsocksForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [ssConfig, setSsConfig] = useState({
    server: "",
    server_port: 8388,
    method: "aes-128-gcm",
    password: "",
    plugin: "",
    plugin_opts: "",
    network: "",
    udp_over_tcp: false,
    multiplex_enabled: false,
    multiplex_protocol: "",
    multiplex_max_connections: 0,
    multiplex_min_streams: 0,
    multiplex_max_streams: 0,
    multiplex_padding: false,
    multiplex_brutal: false,
    multiplex_brutal_up: 0,
    multiplex_brutal_down: 0,
  })

  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "shadowsocks") {
      setSsConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 8388,
        method: initialConfig.method || "aes-128-gcm",
        password: initialConfig.password || "",
        plugin: initialConfig.plugin || "",
        plugin_opts: initialConfig.plugin_opts || "",
        network: (typeof initialConfig.network === "string" ? initialConfig.network : "") as "" | "tcp" | "udp",
        udp_over_tcp: typeof initialConfig.udp_over_tcp === "boolean" ? initialConfig.udp_over_tcp : initialConfig.udp_over_tcp?.enabled || false,
        multiplex_enabled: initialConfig.multiplex?.enabled || false,
        multiplex_protocol: initialConfig.multiplex?.protocol || "",
        multiplex_max_connections: initialConfig.multiplex?.max_connections || 0,
        multiplex_min_streams: initialConfig.multiplex?.min_streams || 0,
        multiplex_max_streams: initialConfig.multiplex?.max_streams || 0,
        multiplex_padding: initialConfig.multiplex?.padding || false,
        multiplex_brutal: initialConfig.multiplex?.brutal?.enabled || false,
        multiplex_brutal_up: initialConfig.multiplex?.brutal?.up_mbps || 0,
        multiplex_brutal_down: initialConfig.multiplex?.brutal?.down_mbps || 0,
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!ssConfig.server || !ssConfig.password) return

    const previewConfig: any = {
      type: "shadowsocks",
      tag: "proxy_out",
      server: ssConfig.server,
      server_port: ssConfig.server_port,
      method: ssConfig.method,
      password: ssConfig.password,
    }
    if (ssConfig.plugin) {
      previewConfig.plugin = ssConfig.plugin
      if (ssConfig.plugin_opts) {
        previewConfig.plugin_opts = ssConfig.plugin_opts
      }
    }
    if (ssConfig.network) {
      previewConfig.network = ssConfig.network
    }
    if (ssConfig.udp_over_tcp) {
      previewConfig.udp_over_tcp = { enabled: true }
    }
    // Multiplex
    if (ssConfig.multiplex_enabled) {
      const mux: any = { enabled: true }
      if (ssConfig.multiplex_protocol) mux.protocol = ssConfig.multiplex_protocol
      if (ssConfig.multiplex_max_connections) mux.max_connections = ssConfig.multiplex_max_connections
      if (ssConfig.multiplex_min_streams) mux.min_streams = ssConfig.multiplex_min_streams
      if (ssConfig.multiplex_max_streams) mux.max_streams = ssConfig.multiplex_max_streams
      if (ssConfig.multiplex_padding) mux.padding = true
      if (ssConfig.multiplex_brutal) {
        mux.brutal = { enabled: true, up_mbps: ssConfig.multiplex_brutal_up, down_mbps: ssConfig.multiplex_brutal_down }
      }
      previewConfig.multiplex = mux
    }

    setOutbound(0, previewConfig)
  }, [ssConfig, setOutbound])

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
                value={ssConfig.server}
                onChange={(e) => setSsConfig({ ...ssConfig, server: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("port")}</Label>
              <Input
                type="number"
                value={ssConfig.server_port}
                onChange={(e) => setSsConfig({ ...ssConfig, server_port: parseInt(e.target.value) || 8388 })}
                className="h-9 text-sm"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("security")}</Label>
              <Select value={(ssConfig.method) || "none"} onValueChange={(val) => { setSsConfig({ ...ssConfig, method: val }) }}>
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
                value={ssConfig.password}
                onChange={(e) => setSsConfig({ ...ssConfig, password: e.target.value })}
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
              <Select value={(ssConfig.network) || "none"} onValueChange={(val) => { setSsConfig({ ...ssConfig, network: (val === "none" ? "" : val)  }) }}>
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
                  checked={ssConfig.udp_over_tcp}
                  onChange={(e) => setSsConfig({ ...ssConfig, udp_over_tcp: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableUdpOverTcp")}</span>
              </label>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("sip003Plugin")}</Label>
              <Select value={(ssConfig.plugin) || "none"} onValueChange={(val) => { setSsConfig({ ...ssConfig, plugin: (val === "none" ? "" : val)  }) }}>
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
            {ssConfig.plugin && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("pluginOpts")}</Label>
                <Input
                  placeholder="obfs=http;obfs-host=example.com"
                  value={ssConfig.plugin_opts}
                  onChange={(e) => setSsConfig({ ...ssConfig, plugin_opts: e.target.value })}
                  className="h-9 text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {ssConfig.plugin === "obfs-local" && t("obfsExample")}
                  {ssConfig.plugin === "v2ray-plugin" && t("v2rayPluginExample")}
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
              checked={ssConfig.multiplex_enabled}
              onChange={(e) => setSsConfig({ ...ssConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableMultiplex")}</span>
          </label>
        </div>

        {ssConfig.multiplex_enabled && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("multiplexProtocol")}</Label>
                <Select value={(ssConfig.multiplex_protocol) || "none"} onValueChange={(val) => { setSsConfig({ ...ssConfig, multiplex_protocol: (val === "none" ? "" : val)  }) }}>
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
                  value={ssConfig.multiplex_max_connections}
                  onChange={(e) => setSsConfig({ ...ssConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
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
                    value={ssConfig.multiplex_min_streams}
                    onChange={(e) => setSsConfig({ ...ssConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("maxStreams")}</Label>
                  <Input
                    type="number"
                    value={ssConfig.multiplex_max_streams}
                    onChange={(e) => setSsConfig({ ...ssConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={ssConfig.multiplex_padding}
                    onChange={(e) => setSsConfig({ ...ssConfig, multiplex_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enablePadding")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer group/label">
                  <input
                    type="checkbox"
                    checked={ssConfig.multiplex_brutal}
                    onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal: e.target.checked })}
                    className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium group-hover/label:text-blue-500 transition-colors">{t("enableBrutal")}</span>
                </label>
              </div>

              {ssConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-blue-500/20 animate-in fade-in slide-in-from-left-1 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={ssConfig.multiplex_brutal_up}
                      onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={ssConfig.multiplex_brutal_down}
                      onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
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
