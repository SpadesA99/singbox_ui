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
    </div>
  )
}
