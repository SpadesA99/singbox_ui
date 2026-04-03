"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, ShadowTLSUser, formatListen, parseListen } from "./types"

export function ShadowtlsForm({
  initialConfig,
  setInbound,
  clearEndpoints,
  onError,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const [shadowtlsConfig, setShadowtlsConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    version: 3,
    password: "", // v2 顶层 password
    users: [{ name: "", password: "" }] as ShadowTLSUser[], // v3 使用 users
    handshake_server: "www.google.com",
    handshake_server_port: 443,
    strict_mode: true,
    handshake_for_server_name: {} as Record<string, { server: string; server_port: number }>,
    wildcard_sni: "off" as "off" | "authed" | "all",
  })

  const [initialized, setInitialized] = useState(false)

  // Load from initialConfig
  useEffect(() => {
    if (initialized) return
    if (!initialConfig || initialConfig.type !== "shadowtls") {
      setInitialized(true)
      return
    }
    const shadowtlsUsers = (initialConfig.users || []).map((u: any) => ({
      name: u.name || "",
      password: u.password || "",
    }))
    setShadowtlsConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 443,
      version: initialConfig.version || 3,
      password: initialConfig.password || "",
      users: shadowtlsUsers.length > 0 ? shadowtlsUsers : [{ name: "", password: "" }],
      handshake_server: initialConfig.handshake?.server || "www.google.com",
      handshake_server_port: initialConfig.handshake?.server_port || 443,
      strict_mode: initialConfig.strict_mode !== false,
      handshake_for_server_name: (() => {
        const raw = initialConfig.handshake_for_server_name || {}
        const result: Record<string, { server: string; server_port: number }> = {}
        for (const [sni, config] of Object.entries(raw)) {
          result[sni] = { server: (config as any).server || "", server_port: (config as any).server_port || 443 }
        }
        return result
      })(),
      wildcard_sni: (initialConfig.wildcard_sni || "off") as "off" | "authed" | "all",
    })
    setInitialized(true)
  }, [initialConfig, initialized])

  // Build and sync preview config
  useEffect(() => {
    if (!initialized) return

    const previewConfig: any = {
      type: "shadowtls",
      tag: "shadowtls-in",
      listen: formatListen(shadowtlsConfig.listen),
      listen_port: shadowtlsConfig.listen_port,
      version: shadowtlsConfig.version,
      handshake: {
        server: shadowtlsConfig.handshake_server,
        server_port: shadowtlsConfig.handshake_server_port,
      },
    }
    // v2: 使用顶层 password
    if (shadowtlsConfig.version === 2 && shadowtlsConfig.password) {
      previewConfig.password = shadowtlsConfig.password
    }
    // v3: 使用 users 数组和 strict_mode
    if (shadowtlsConfig.version >= 3) {
      const shadowtlsUsersPreview = shadowtlsConfig.users
        .filter((u) => u.password)
        .map((u) => {
          const user: any = { password: u.password }
          if (u.name) user.name = u.name
          return user
        })
      previewConfig.users = shadowtlsUsersPreview
      previewConfig.strict_mode = shadowtlsConfig.strict_mode
    }
    if (shadowtlsConfig.version >= 3 && shadowtlsConfig.wildcard_sni && shadowtlsConfig.wildcard_sni !== "off") {
      previewConfig.wildcard_sni = shadowtlsConfig.wildcard_sni
    }
    if (shadowtlsConfig.version >= 2) {
      const sniMap = shadowtlsConfig.handshake_for_server_name
      const filteredSniMap: any = {}
      let hasSni = false
      for (const [sni, config] of Object.entries(sniMap)) {
        if (sni && config.server) {
          filteredSniMap[sni] = { server: config.server, server_port: config.server_port || 443 }
          hasSni = true
        }
      }
      if (hasSni) {
        previewConfig.handshake_for_server_name = filteredSniMap
      }
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [shadowtlsConfig, initialized, setInbound, clearEndpoints])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("listenAddr")}</Label>
          <Input
            value={shadowtlsConfig.listen}
            onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, listen: e.target.value })}
            className={!isValidListenAddress(shadowtlsConfig.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={shadowtlsConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, shadowtlsConfig.listen_port)
              setShadowtlsConfig({ ...shadowtlsConfig, listen_port: port })
            }}
            className={!isValidPort(shadowtlsConfig.listen_port) ? "border-red-500" : ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("protocolVersion")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={shadowtlsConfig.version}
          onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, version: parseInt(e.target.value) })}
        >
          <option value="1">v1</option>
          <option value="2">v2</option>
          <option value="3">{t("v3Recommended")}</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("handshakeServer")}</Label>
          <Input
            value={shadowtlsConfig.handshake_server}
            onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, handshake_server: e.target.value })}
            placeholder="www.google.com"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("handshakePort")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={shadowtlsConfig.handshake_server_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, shadowtlsConfig.handshake_server_port)
              setShadowtlsConfig({ ...shadowtlsConfig, handshake_server_port: port })
            }}
          />
        </div>
      </div>

      {shadowtlsConfig.version === 2 && (
        <div className="space-y-2">
          <Label>{t("passwordV2")}</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={shadowtlsConfig.password}
              onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, password: e.target.value })}
              placeholder={t("shadowtlsV2Password")}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShadowtlsConfig({ ...shadowtlsConfig, password: generateSecureRandomString(16) })}
            >
              <Key className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {shadowtlsConfig.version >= 3 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="shadowtls-strict-mode"
            checked={shadowtlsConfig.strict_mode}
            onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, strict_mode: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="shadowtls-strict-mode">{t("strictMode")}</Label>
        </div>
      )}

      {/* Wildcard SNI - v3 only */}
      {shadowtlsConfig.version >= 3 && (
        <div className="space-y-2">
          <Label>{t("shadowtlsWildcardSni")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={shadowtlsConfig.wildcard_sni}
            onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, wildcard_sni: e.target.value as "off" | "authed" | "all" })}
          >
            <option value="off">{t("disabled")}</option>
            <option value="authed">{t("shadowtlsWildcardAuthed")}</option>
            <option value="all">{t("shadowtlsWildcardAll")}</option>
          </select>
        </div>
      )}

      {shadowtlsConfig.version >= 3 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("usersV3")}</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setShadowtlsConfig({
                  ...shadowtlsConfig,
                  users: [...shadowtlsConfig.users, { name: "", password: "" }],
                })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              {tc("add")}
            </Button>
          </div>

          {shadowtlsConfig.users.map((user, index) => (
            <Card key={index} className="p-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                  {shadowtlsConfig.users.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setShadowtlsConfig({
                          ...shadowtlsConfig,
                          users: shadowtlsConfig.users.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <Input
                  placeholder={t("nameOptional")}
                  value={user.name || ""}
                  onChange={(e) => {
                    const newUsers = [...shadowtlsConfig.users]
                    newUsers[index].name = e.target.value
                    setShadowtlsConfig({ ...shadowtlsConfig, users: newUsers })
                  }}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder={tc("password")}
                    value={user.password}
                    onChange={(e) => {
                      const newUsers = [...shadowtlsConfig.users]
                      newUsers[index].password = e.target.value
                      setShadowtlsConfig({ ...shadowtlsConfig, users: newUsers })
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newUsers = [...shadowtlsConfig.users]
                      newUsers[index].password = generateSecureRandomString(16)
                      setShadowtlsConfig({ ...shadowtlsConfig, users: newUsers })
                    }}
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
