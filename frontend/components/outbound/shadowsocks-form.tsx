"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

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
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={ssConfig.server}
            onChange={(e) => setSsConfig({ ...ssConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={ssConfig.server_port}
            onChange={(e) => setSsConfig({ ...ssConfig, server_port: parseInt(e.target.value) || 8388 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("security")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          value={ssConfig.method}
          onChange={(e) => setSsConfig({ ...ssConfig, method: e.target.value })}
        >
          <option value="aes-128-gcm">aes-128-gcm</option>
          <option value="aes-256-gcm">aes-256-gcm</option>
          <option value="chacha20-poly1305">chacha20-poly1305</option>
          <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</option>
          <option value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</option>
          <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</option>
          <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</option>
          <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</option>
          <option value="none">none</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>{tc("password")}</Label>
        <Input
          type="text"
          value={ssConfig.password}
          onChange={(e) => setSsConfig({ ...ssConfig, password: e.target.value })}
        />
      </div>

      {/* Plugin */}
      <div className="border-t pt-4 mt-4">
        <div className="space-y-2 mb-4">
          <Label className="font-semibold">{t("sip003Plugin")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={ssConfig.plugin}
            onChange={(e) => setSsConfig({ ...ssConfig, plugin: e.target.value })}
          >
            <option value="">{tc("none")}</option>
            <option value="obfs-local">obfs-local</option>
            <option value="v2ray-plugin">v2ray-plugin</option>
          </select>
        </div>
        {ssConfig.plugin && (
          <div className="space-y-2">
            <Label>{t("pluginOpts")}</Label>
            <Input
              placeholder="obfs=http;obfs-host=example.com"
              value={ssConfig.plugin_opts}
              onChange={(e) => setSsConfig({ ...ssConfig, plugin_opts: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              {ssConfig.plugin === "obfs-local" && t("obfsExample")}
              {ssConfig.plugin === "v2ray-plugin" && t("v2rayPluginExample")}
            </p>
          </div>
        )}
      </div>

      {/* Network */}
      <div className="border-t pt-4 mt-4">
        <div className="space-y-2">
          <Label>{t("networkProtocol")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={ssConfig.network}
            onChange={(e) => setSsConfig({ ...ssConfig, network: e.target.value })}
          >
            <option value="">{t("allDefault")}</option>
            <option value="tcp">{t("tcpOnly")}</option>
            <option value="udp">{t("udpOnly")}</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="ss-udp-over-tcp"
          checked={ssConfig.udp_over_tcp}
          onChange={(e) => setSsConfig({ ...ssConfig, udp_over_tcp: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="ss-udp-over-tcp">{t("enableUdpOverTcp")}</Label>
      </div>

      {/* Multiplex */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-4 mb-4">
          <Label className="font-semibold">{t("multiplexSettings")}</Label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={ssConfig.multiplex_enabled}
              onChange={(e) => setSsConfig({ ...ssConfig, multiplex_enabled: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            {t("enableMultiplex")}
          </label>
        </div>
        {ssConfig.multiplex_enabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("multiplexProtocol")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={ssConfig.multiplex_protocol}
                  onChange={(e) => setSsConfig({ ...ssConfig, multiplex_protocol: e.target.value })}
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
                  value={ssConfig.multiplex_max_connections}
                  onChange={(e) => setSsConfig({ ...ssConfig, multiplex_max_connections: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("minStreams")}</Label>
                <Input
                  type="number"
                  value={ssConfig.multiplex_min_streams}
                  onChange={(e) => setSsConfig({ ...ssConfig, multiplex_min_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("maxStreams")}</Label>
                <Input
                  type="number"
                  value={ssConfig.multiplex_max_streams}
                  onChange={(e) => setSsConfig({ ...ssConfig, multiplex_max_streams: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={ssConfig.multiplex_padding}
                onChange={(e) => setSsConfig({ ...ssConfig, multiplex_padding: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enablePadding")}
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={ssConfig.multiplex_brutal}
                  onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                {t("enableBrutal")}
              </label>
              {ssConfig.multiplex_brutal && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label>{t("upMbps")}</Label>
                    <Input
                      type="number"
                      value={ssConfig.multiplex_brutal_up}
                      onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal_up: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("downMbps")}</Label>
                    <Input
                      type="number"
                      value={ssConfig.multiplex_brutal_down}
                      onChange={(e) => setSsConfig({ ...ssConfig, multiplex_brutal_down: parseInt(e.target.value) || 0 })}
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
