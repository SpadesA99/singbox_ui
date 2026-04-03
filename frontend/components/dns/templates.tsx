"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { DnsServer, DnsRule } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"

interface TemplatesProps {
  onApply: (servers: DnsServer[], rules: DnsRule[], final: string) => void
}

export function Templates({ onApply }: TemplatesProps) {
  const { t } = useTranslation("dns")

  const applyTemplate = (template: string) => {
    let servers: DnsServer[] = []
    let rules: DnsRule[] = []
    let final = ""

    switch (template) {
      case "china-optimized":
        servers = [
          { tag: "local_dns", server: "223.5.5.5", type: "udp" },
          { tag: "remote_dns", server: "8.8.8.8", type: "udp", detour: "proxy_out" },
        ]
        rules = [{ action: "route", server: "local_dns", rule_set: ["geosite-cn"] }]
        final = "remote_dns"
        break

      case "cloudflare-doh":
        servers = [
          { tag: "local_dns", server: "223.5.5.5", type: "udp" },
          { tag: "cloudflare_dns", server: "cloudflare-dns.com", type: "https", path: "/dns-query", detour: "proxy_out" },
        ]
        rules = [{ action: "route", server: "local_dns", rule_set: ["geosite-cn"] }]
        final = "cloudflare_dns"
        break

      case "google-doh":
        servers = [
          { tag: "local_dns", server: "223.5.5.5", type: "udp" },
          { tag: "google_dns", server: "dns.google", type: "https", path: "/dns-query", detour: "proxy_out" },
        ]
        rules = [{ action: "route", server: "local_dns", rule_set: ["geosite-cn"] }]
        final = "google_dns"
        break

      case "simple":
        servers = [{ tag: "default_dns", server: "8.8.8.8", type: "udp" }]
        rules = []
        final = "default_dns"
        break
    }

    onApply(servers, rules, final)
  }

  return (
    <div className="space-y-2">
      <Label>{t("quickTemplate")}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("china-optimized")}>
          {t("chinaOptimized")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("cloudflare-doh")}>
          Cloudflare DoH
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("google-doh")}>
          Google DoH
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("simple")}>
          {t("simpleMode")}
        </Button>
      </div>
    </div>
  )
}
