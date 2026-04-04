"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import { DnsServer } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"

interface ServerCardProps {
  server: DnsServer
  index: number
  expanded: boolean
  onToggleExpand: () => void
  onUpdate: (field: keyof DnsServer, value: any) => void
  onRemove: () => void
}

export function ServerCard({ server, index, expanded, onToggleExpand, onUpdate, onRemove }: ServerCardProps) {
  const { t } = useTranslation("dns")
  const { t: tc } = useTranslation("common")

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 space-y-3 bg-white dark:bg-zinc-900/50 shadow-sm hover:shadow-md hover:border-primary/40 transition-all duration-200">
      <div className="flex items-center gap-2">
        <Input
          placeholder={t("serverTag")}
          value={server.tag}
          onChange={(e) => onUpdate("tag", e.target.value)}
          className="h-8 text-sm flex-1"
        />
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[100px]"
          value={server.type || "udp"}
          onChange={(e) => onUpdate("type", e.target.value)}
        >
          <option value="udp">{t("typeUdp")}</option>
          <option value="tcp">{t("typeTcp")}</option>
          <option value="https">{t("typeHttps")}</option>
          <option value="tls">{t("typeTls")}</option>
          <option value="quic">{t("typeDoQ")}</option>
          <option value="h3">{t("typeH3")}</option>
          <option value="local">{t("typeLocal")}</option>
          <option value="dhcp">{t("typeDhcp")}</option>
          <option value="fakeip">{t("typeFakeip")}</option>
          <option value="hosts">{t("typeHosts")}</option>
        </select>
        {server.type !== "local" && server.type !== "fakeip" && server.type !== "dhcp" && (
          <Input
            placeholder={t("serverAddr")}
            value={server.server || ""}
            onChange={(e) => onUpdate("server", e.target.value)}
            className="h-8 text-sm flex-[2]"
          />
        )}
        <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Advanced options */}
      <div className="border-t pt-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 text-xs w-full justify-between px-1"
          onClick={onToggleExpand}
        >
          <span>{t("advancedOptions")}</span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {expanded && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {(server.type === "udp" || server.type === "tcp" || server.type === "tls" || server.type === "quic" || server.type === "https" || server.type === "http3") && (
              <div className="space-y-1">
                <Label className="text-xs">{tc("port")}</Label>
                <Input
                  type="number"
                  placeholder={
                    server.type === "udp" || server.type === "tcp"
                      ? "53"
                      : server.type === "tls" || server.type === "quic"
                      ? "853"
                      : "443"
                  }
                  value={server.server_port || ""}
                  onChange={(e) => onUpdate("server_port", parseInt(e.target.value) || undefined)}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {(server.type === "https" || server.type === "http3") && (
              <div className="space-y-1">
                <Label className="text-xs">{t("path")}</Label>
                <Input
                  placeholder="/dns-query"
                  value={server.path || ""}
                  onChange={(e) => onUpdate("path", e.target.value || undefined)}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {server.type === "dhcp" && (
              <div className="space-y-1">
                <Label className="text-xs">{t("networkInterface")}</Label>
                <Input
                  placeholder="eth0"
                  value={server.interface || ""}
                  onChange={(e) => onUpdate("interface", e.target.value || undefined)}
                  className="h-8 text-sm"
                />
              </div>
            )}

            {server.type === "fakeip" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">{t("ipv4Range")}</Label>
                  <Input
                    placeholder="198.18.0.0/15"
                    value={server.inet4_range || ""}
                    onChange={(e) => onUpdate("inet4_range", e.target.value || undefined)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("ipv6Range")}</Label>
                  <Input
                    placeholder="fc00::/18"
                    value={server.inet6_range || ""}
                    onChange={(e) => onUpdate("inet6_range", e.target.value || undefined)}
                    className="h-8 text-sm"
                  />
                </div>
              </>
            )}

            {server.type !== "local" && server.type !== "fakeip" && server.type !== "dhcp" && server.type !== "hosts" && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">{t("outboundProxy")}</Label>
                  <Input
                    placeholder="proxy"
                    value={server.detour || ""}
                    onChange={(e) => onUpdate("detour", e.target.value || undefined)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{t("domainResolver")}</Label>
                  <Input
                    placeholder="local_dns"
                    value={typeof server.domain_resolver === "string" ? server.domain_resolver : ""}
                    onChange={(e) => onUpdate("domain_resolver", e.target.value || undefined)}
                    className="h-8 text-sm"
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
