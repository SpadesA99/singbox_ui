"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

export function SocksForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [socksConfig, setSocksConfig] = useState({
    server: "",
    server_port: 1080,
    version: "5",
    username: "",
    password: "",
  })

  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "socks") {
      setSocksConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 1080,
        version: initialConfig.version || "5",
        username: initialConfig.username || "",
        password: initialConfig.password || "",
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!socksConfig.server) return

    const previewConfig: any = {
      type: "socks",
      tag: "proxy_out",
      server: socksConfig.server,
      server_port: socksConfig.server_port,
    }
    if (socksConfig.version && socksConfig.version !== "5") {
      previewConfig.version = socksConfig.version
    }
    if (socksConfig.username && socksConfig.password) {
      previewConfig.username = socksConfig.username
      previewConfig.password = socksConfig.password
    }

    setOutbound(0, previewConfig)
  }, [socksConfig, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="127.0.0.1"
            value={socksConfig.server}
            onChange={(e) => setSocksConfig({ ...socksConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={socksConfig.server_port}
            onChange={(e) => setSocksConfig({ ...socksConfig, server_port: parseInt(e.target.value) || 1080 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("socksVersion")}</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={socksConfig.version}
            onChange={(e) => setSocksConfig({ ...socksConfig, version: e.target.value })}
          >
            <option value="5">{t("socks5Default")}</option>
            <option value="4a">SOCKS4a</option>
            <option value="4">SOCKS4</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("usernameOptional")}</Label>
          <Input
            value={socksConfig.username}
            onChange={(e) => setSocksConfig({ ...socksConfig, username: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("passwordOptional")}</Label>
          <Input
            type="password"
            value={socksConfig.password}
            onChange={(e) => setSocksConfig({ ...socksConfig, password: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
