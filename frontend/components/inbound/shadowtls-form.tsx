"use client"

import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, ShadowTLSUser, formatListen, parseListen } from "./types"

interface ShadowtlsFlat {
  listen: string
  listen_port: number
  version: number
  password: string
  users: ShadowTLSUser[]
  handshake_server: string
  handshake_server_port: number
  handshake_detour: string
  strict_mode: boolean
  handshake_for_server_name: Record<string, { server: string; server_port: number }>
  wildcard_sni: "off" | "authed" | "all"
}

function deriveFlat(initialConfig: any): ShadowtlsFlat {
  const c = initialConfig?.type === "shadowtls" ? initialConfig : null
  const shadowtlsUsers = (c?.users || []).map((u: any) => ({
    name: u.name || "",
    password: u.password || "",
  }))
  const rawSniMap = c?.handshake_for_server_name || {}
  const sniMap: Record<string, { server: string; server_port: number }> = {}
  for (const [sni, config] of Object.entries(rawSniMap)) {
    sniMap[sni] = { server: (config as any).server || "", server_port: (config as any).server_port || 443 }
  }
  return {
    listen: parseListen(c?.listen),
    listen_port: c?.listen_port || 443,
    version: c?.version || 3,
    password: c?.password || "",
    users: shadowtlsUsers.length > 0 ? shadowtlsUsers : [{ name: "", password: "" }],
    handshake_server: c?.handshake?.server || "www.google.com",
    handshake_server_port: c?.handshake?.server_port || 443,
    handshake_detour: c?.handshake?.detour || "",
    strict_mode: c?.strict_mode !== false,
    handshake_for_server_name: sniMap,
    wildcard_sni: (c?.wildcard_sni || "off") as "off" | "authed" | "all",
  }
}

function buildShadowtlsInbound(f: ShadowtlsFlat): any {
  const previewConfig: any = {
    type: "shadowtls",
    tag: "shadowtls-in",
    listen: formatListen(f.listen),
    listen_port: f.listen_port,
    version: f.version,
    handshake: {
      server: f.handshake_server,
      server_port: f.handshake_server_port,
      ...(f.handshake_detour ? { detour: f.handshake_detour } : {}),
    },
  }
  // v2: 使用顶层 password
  if (f.version === 2 && f.password) {
    previewConfig.password = f.password
  }
  // v3: 使用 users 数组和 strict_mode
  if (f.version >= 3) {
    const shadowtlsUsersPreview = f.users
      .filter((u) => u.password)
      .map((u) => {
        const user: any = { password: u.password }
        if (u.name) user.name = u.name
        return user
      })
    previewConfig.users = shadowtlsUsersPreview
    previewConfig.strict_mode = f.strict_mode
  }
  if (f.version >= 3 && f.wildcard_sni && f.wildcard_sni !== "off") {
    previewConfig.wildcard_sni = f.wildcard_sni
  }
  if (f.version >= 2) {
    const sniMap = f.handshake_for_server_name
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
  return previewConfig
}

export function ShadowtlsForm({
  initialConfig,
  setInbound,
  clearEndpoints,
  onError,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  const updateInbound = useCallback((patch: Partial<ShadowtlsFlat>) => {
    const merged = { ...flat, ...patch }
    clearEndpoints()
    setInbound(0, buildShadowtlsInbound(merged))
  }, [flat, clearEndpoints, setInbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("listenAddr")}</Label>
          <Input
            value={flat.listen}
            onChange={(e) => updateInbound({ listen: e.target.value })}
            className={!isValidListenAddress(flat.listen) ? "border-red-500" : ""}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={flat.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, flat.listen_port)
              updateInbound({ listen_port: port })
            }}
            className={!isValidPort(flat.listen_port) ? "border-red-500" : ""}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("protocolVersion")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={flat.version}
          onChange={(e) => updateInbound({ version: parseInt(e.target.value) })}
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
            value={flat.handshake_server}
            onChange={(e) => updateInbound({ handshake_server: e.target.value })}
            placeholder="www.google.com"
          />
        </div>
        <div className="space-y-2">
          <Label>{t("handshakePort")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={flat.handshake_server_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, flat.handshake_server_port)
              updateInbound({ handshake_server_port: port })
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("handshakeDetour")}</Label>
        <Input
          value={flat.handshake_detour}
          onChange={(e) => updateInbound({ handshake_detour: e.target.value })}
          placeholder={t("handshakeDetourHint")}
        />
      </div>

      {flat.version === 2 && (
        <div className="space-y-2">
          <Label>{t("passwordV2")}</Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={flat.password}
              onChange={(e) => updateInbound({ password: e.target.value })}
              placeholder={t("shadowtlsV2Password")}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => updateInbound({ password: generateSecureRandomString(16) })}
            >
              <Key className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {flat.version >= 3 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="shadowtls-strict-mode"
            checked={flat.strict_mode}
            onChange={(e) => updateInbound({ strict_mode: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="shadowtls-strict-mode">{t("strictMode")}</Label>
        </div>
      )}

      {/* Wildcard SNI - v3 only */}
      {flat.version >= 3 && (
        <div className="space-y-2">
          <Label>{t("shadowtlsWildcardSni")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={flat.wildcard_sni}
            onChange={(e) => updateInbound({ wildcard_sni: e.target.value as "off" | "authed" | "all" })}
          >
            <option value="off">{t("disabled")}</option>
            <option value="authed">{t("shadowtlsWildcardAuthed")}</option>
            <option value="all">{t("shadowtlsWildcardAll")}</option>
          </select>
        </div>
      )}

      {flat.version >= 3 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("usersV3")}</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                updateInbound({ users: [...flat.users, { name: "", password: "" }] })
              }
            >
              <Plus className="h-4 w-4 mr-1" />
              {tc("add")}
            </Button>
          </div>

          {flat.users.map((user, index) => (
            <Card key={index} className="p-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                  {flat.users.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateInbound({ users: flat.users.filter((_, i) => i !== index) })
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
                    const newUsers = [...flat.users]
                    newUsers[index] = { ...newUsers[index], name: e.target.value }
                    updateInbound({ users: newUsers })
                  }}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder={tc("password")}
                    value={user.password}
                    onChange={(e) => {
                      const newUsers = [...flat.users]
                      newUsers[index] = { ...newUsers[index], password: e.target.value }
                      updateInbound({ users: newUsers })
                    }}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newUsers = [...flat.users]
                      newUsers[index] = { ...newUsers[index], password: generateSecureRandomString(16) }
                      updateInbound({ users: newUsers })
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
