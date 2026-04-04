"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
    network: "",
    udp_over_tcp: false,
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
        network: (typeof initialConfig.network === "string" ? initialConfig.network : "") as "" | "tcp" | "udp",
        udp_over_tcp: initialConfig.udp_over_tcp?.enabled || false,
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
    if (socksConfig.username) {
      previewConfig.username = socksConfig.username
    }
    if (socksConfig.password) {
      previewConfig.password = socksConfig.password
    }
    if (socksConfig.network) {
      previewConfig.network = socksConfig.network
    }
    if (socksConfig.udp_over_tcp) {
      previewConfig.udp_over_tcp = { enabled: true }
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
          <Select value={(socksConfig.version) || "none"} onValueChange={(val) => { setSocksConfig({ ...socksConfig, version: (val === "none" ? "" : val)  }) }}>
                <SelectTrigger className="h-9 w-full bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">{t("socks5Default")}</SelectItem>
                  <SelectItem value="4a">SOCKS4a</SelectItem>
                  <SelectItem value="4">SOCKS4</SelectItem>
                </SelectContent>
              </Select>
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

      {/* Network & UDP over TCP */}
      <div className="border-t pt-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("networkProtocol")}</Label>
            <Select value={(socksConfig.network) || "none"} onValueChange={(val) => { setSocksConfig({ ...socksConfig, network: (val === "none" ? "" : val)  }) }}>
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
          <div className="space-y-2 flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={socksConfig.udp_over_tcp}
                onChange={(e) => setSocksConfig({ ...socksConfig, udp_over_tcp: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              {t("enableUdpOverTcp")}
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
