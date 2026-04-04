"use client"

import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

interface SocksFlat {
  server: string
  server_port: number
  version: string
  username: string
  password: string
  network: string
  udp_over_tcp: boolean
}

function deriveFlat(initialConfig: any): SocksFlat {
  const c = initialConfig?.type === "socks" ? initialConfig : null
  return {
    server: c?.server || "",
    server_port: c?.server_port || 1080,
    version: c?.version || "5",
    username: c?.username || "",
    password: c?.password || "",
    network: (typeof c?.network === "string" ? c.network : "") as string,
    udp_over_tcp: c?.udp_over_tcp?.enabled || false,
  }
}

function buildSocksOutbound(s: SocksFlat): any {
  const previewConfig: any = {
    type: "socks",
    tag: "proxy_out",
    server: s.server,
    server_port: s.server_port,
  }
  if (s.version && s.version !== "5") previewConfig.version = s.version
  if (s.username) previewConfig.username = s.username
  if (s.password) previewConfig.password = s.password
  if (s.network) previewConfig.network = s.network
  if (s.udp_over_tcp) previewConfig.udp_over_tcp = { enabled: true }
  return previewConfig
}

export function SocksForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  const updateOutbound = useCallback((patch: Partial<SocksFlat>) => {
    const merged = { ...flat, ...patch }
    setOutbound(0, buildSocksOutbound(merged))
  }, [flat, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="127.0.0.1"
            value={flat.server}
            onChange={(e) => updateOutbound({ server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={flat.server_port}
            onChange={(e) => updateOutbound({ server_port: parseInt(e.target.value) || 1080 })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("socksVersion")}</Label>
          <Select value={(flat.version) || "none"} onValueChange={(val) => { updateOutbound({ version: (val === "none" ? "" : val) }) }}>
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
            value={flat.username}
            onChange={(e) => updateOutbound({ username: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("passwordOptional")}</Label>
          <Input
            type="password"
            value={flat.password}
            onChange={(e) => updateOutbound({ password: e.target.value })}
          />
        </div>
      </div>

      {/* Network & UDP over TCP */}
      <div className="border-t pt-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("networkProtocol")}</Label>
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
          <div className="space-y-2 flex items-end">
            <label className="flex items-center gap-2 text-sm pb-2">
              <input
                type="checkbox"
                checked={flat.udp_over_tcp}
                onChange={(e) => updateOutbound({ udp_over_tcp: e.target.checked })}
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
