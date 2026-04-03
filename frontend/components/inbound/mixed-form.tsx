"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, QrCode } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, formatListen, parseListen, getPublicIP } from "./types"

export function MixedForm({ initialConfig, setInbound, clearEndpoints, onError, onShowQrCode, serverIP, setServerIP }: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [config, setConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 1080,
    auth: "none" as "none" | "password",
    username: "",
    password: "",
  })

  // Loading useEffect
  useEffect(() => {
    if (isInitializedRef.current) return
    if (!initialConfig || (initialConfig.type !== "mixed" && initialConfig.type !== "socks")) {
      isInitializedRef.current = true
      return
    }
    setConfig({
      listen: parseListen(initialConfig.listen),
      listen_port: initialConfig.listen_port || 1080,
      auth: (initialConfig.users?.length ?? 0) > 0 ? "password" : "none",
      username: (initialConfig.users?.[0] as any)?.username || "",
      password: (initialConfig.users?.[0] as any)?.password || "",
    })
    isInitializedRef.current = true
  }, [initialConfig])

  // Building useEffect
  useEffect(() => {
    if (!isInitializedRef.current) return

    const previewConfig: any = {
      type: "mixed",
      tag: "mixed-in",
      listen: formatListen(config.listen),
      listen_port: config.listen_port,
    }
    if (config.auth === "password" && config.username && config.password) {
      previewConfig.users = [
        {
          username: config.username,
          password: config.password,
        },
      ]
    }

    clearEndpoints()
    setInbound(0, previewConfig)
  }, [config, setInbound, clearEndpoints])

  const generateCredentials = () => {
    setConfig({
      ...config,
      username: generateSecureRandomString(8),
      password: generateSecureRandomString(16),
    })
  }

  const showQrCode = async () => {
    onError("")
    try {
      const ip = await getPublicIP(serverIP, setServerIP)

      let url: string
      if (config.auth === "password" && config.username && config.password) {
        url = `socks5://${config.username}:${config.password}@${ip}:${config.listen_port}#Mixed`
      } else {
        url = `socks5://${ip}:${config.listen_port}#Mixed`
      }

      onShowQrCode(url, "socks5")
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
            value={config.listen}
            onChange={(e) => setConfig({ ...config, listen: e.target.value })}
            className={!isValidListenAddress(config.listen) ? "border-red-500" : ""}
          />
          {!isValidListenAddress(config.listen) && (
            <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={config.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, config.listen_port)
              setConfig({ ...config, listen_port: port })
            }}
            className={!isValidPort(config.listen_port) ? "border-red-500" : ""}
          />
          {!isValidPort(config.listen_port) && (
            <p className="text-xs text-red-500">{t("portRange")}</p>
          )}
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("authMode")}</Label>
        <select
          className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
          value={config.auth}
          onChange={(e) => setConfig({ ...config, auth: e.target.value as "none" | "password" })}
        >
          <option value="none">{t("noAuth")}</option>
          <option value="password">{t("passwordAuth")}</option>
        </select>
      </div>
      {config.auth === "password" && (
        <>
          <div className="space-y-2">
            <Label>{tc("username")}</Label>
            <Input
              value={config.username}
              onChange={(e) => setConfig({ ...config, username: e.target.value })}
              placeholder={t("enterUsername")}
            />
          </div>
          <div className="space-y-2">
            <Label>{tc("password")}</Label>
            <div className="flex gap-2">
              <Input
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                placeholder={t("enterPassword")}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={generateCredentials}>
                <Key className="h-4 w-4 mr-1" />
                {tc("generate")}
              </Button>
            </div>
          </div>
        </>
      )}
      <div className="pt-2">
        <Button type="button" variant="outline" onClick={showQrCode}>
          <QrCode className="h-4 w-4 mr-1" />
          {t("generateQrCode")}
        </Button>
      </div>
    </div>
  )
}
