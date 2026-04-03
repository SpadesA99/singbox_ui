"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSS2022Key } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, formatListen, parseListen } from "./types"

interface ShadowsocksConfig {
  listen: string
  listen_port: number
  method: string
  password: string
  users: { name: string; password: string }[]
  multiplex_enabled: boolean
  multiplex_padding: boolean
}

export function ShadowsocksForm({
  initialConfig,
  setInbound,
  clearEndpoints,
  onError,
  onShowQrCode,
  serverIP,
  setServerIP,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const [ssConfig, setSsConfig] = useState<ShadowsocksConfig>({
    listen: "0.0.0.0",
    listen_port: 8388,
    method: "2022-blake3-chacha20-poly1305",
    password: "",
    users: [],
    multiplex_enabled: false,
    multiplex_padding: false,
  })

  // Load from initialConfig
  useEffect(() => {
    if (!initialConfig || initialConfig.type !== "shadowsocks") return
    setSsConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 8388,
      method: initialConfig.method || "2022-blake3-chacha20-poly1305",
      password: initialConfig.password || "",
      users: (initialConfig.users || []).map((u: any) => ({ name: u.name || "", password: u.password || "" })),
      multiplex_enabled: initialConfig.multiplex?.enabled || false,
      multiplex_padding: initialConfig.multiplex?.padding || false,
    })
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    const previewConfig: any = {
      type: "shadowsocks",
      tag: "ss-in",
      listen: formatListen(ssConfig.listen),
      listen_port: ssConfig.listen_port,
      method: ssConfig.method,
      password: ssConfig.password,
    }
    if (ssConfig.users.length > 0) {
      previewConfig.users = ssConfig.users
        .filter((u) => u.password)
        .map((u) => {
          const user: any = { password: u.password }
          if (u.name) user.name = u.name
          return user
        })
    }
    if (ssConfig.multiplex_enabled) {
      previewConfig.multiplex = { enabled: true, padding: ssConfig.multiplex_padding }
    }
    setInbound(0, previewConfig)
    clearEndpoints()
  }, [ssConfig])

  const showShadowsocksQrCode = async () => {
    onError("")
    try {
      if (!ssConfig.password) {
        throw new Error(t("setPasswordKeyFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      const userInfo = `${ssConfig.method}:${ssConfig.password}`
      const base64UserInfo = btoa(userInfo)
      const ssUrl = `ss://${base64UserInfo}@${ip}:${ssConfig.listen_port}#Shadowsocks`

      onShowQrCode(ssUrl, "shadowsocks")
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("listenAddr")}</Label>
          <Input
            value={ssConfig.listen}
            onChange={(e) => setSsConfig({ ...ssConfig, listen: e.target.value })}
            className={!isValidListenAddress(ssConfig.listen) ? "border-red-500" : ""}
          />
          {!isValidListenAddress(ssConfig.listen) && (
            <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={ssConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, ssConfig.listen_port)
              setSsConfig({ ...ssConfig, listen_port: port })
            }}
            className={!isValidPort(ssConfig.listen_port) ? "border-red-500" : ""}
          />
          {!isValidPort(ssConfig.listen_port) && (
            <p className="text-xs text-red-500">{t("portRange")}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("encryption")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={ssConfig.method}
          onChange={(e) => setSsConfig({ ...ssConfig, method: e.target.value })}
        >
          <option value="none">{t("noEncryption")}</option>
          <option value="aes-128-gcm">aes-128-gcm</option>
          <option value="aes-192-gcm">aes-192-gcm</option>
          <option value="aes-256-gcm">aes-256-gcm</option>
          <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</option>
          <option value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</option>
          <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</option>
          <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</option>
          <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label>{tc("password")} {ssConfig.method.startsWith("2022-") && t("ssPasswordLabel")}</Label>
        <div className="flex gap-2">
          <Input
            value={ssConfig.password}
            onChange={(e) => setSsConfig({ ...ssConfig, password: e.target.value })}
            placeholder={ssConfig.method.startsWith("2022-") ? t("clickGenerateBase64") : t("enterPassword")}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setSsConfig({ ...ssConfig, password: generateSS2022Key(ssConfig.method) })}
          >
            <Key className="h-4 w-4 mr-1" />
            {tc("generate")}
          </Button>
        </div>
        {ssConfig.method.startsWith("2022-") && (
          <p className="text-xs text-muted-foreground">
            {t("ss2022Hint")}
          </p>
        )}
      </div>
      {/* 多用户 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("ssMultiUser")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSsConfig({ ...ssConfig, users: [...ssConfig.users, { name: "", password: "" }] })}
          >
            <Plus className="h-4 w-4 mr-1" /> {t("addUser")}
          </Button>
        </div>
        {ssConfig.users.map((user, index) => (
          <div key={index} className="flex gap-2 items-center">
            <Input
              value={user.name}
              onChange={(e) => {
                const newUsers = [...ssConfig.users]
                newUsers[index] = { ...newUsers[index], name: e.target.value }
                setSsConfig({ ...ssConfig, users: newUsers })
              }}
              placeholder={t("userName")}
              className="flex-1"
            />
            <Input
              value={user.password}
              onChange={(e) => {
                const newUsers = [...ssConfig.users]
                newUsers[index] = { ...newUsers[index], password: e.target.value }
                setSsConfig({ ...ssConfig, users: newUsers })
              }}
              placeholder={tc("password")}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSsConfig({ ...ssConfig, users: ssConfig.users.filter((_, i) => i !== index) })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("ssMultiUserHint")}</p>
      </div>
      {/* Multiplex */}
      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="ss-multiplex"
            checked={ssConfig.multiplex_enabled}
            onChange={(e) => setSsConfig({ ...ssConfig, multiplex_enabled: e.target.checked })}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="ss-multiplex">{t("multiplexEnabled")}</Label>
        </div>
        {ssConfig.multiplex_enabled && (
          <div className="flex items-center space-x-2 ml-6">
            <input
              type="checkbox"
              id="ss-multiplex-padding"
              checked={ssConfig.multiplex_padding}
              onChange={(e) => setSsConfig({ ...ssConfig, multiplex_padding: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="ss-multiplex-padding">{t("multiplexPadding")}</Label>
          </div>
        )}
      </div>
      <div className="pt-2">
        <Button type="button" variant="outline" onClick={showShadowsocksQrCode} disabled={!ssConfig.password}>
          <QrCode className="h-4 w-4 mr-1" />
          {t("generateQrCode")}
        </Button>
      </div>
    </div>
  )
}
