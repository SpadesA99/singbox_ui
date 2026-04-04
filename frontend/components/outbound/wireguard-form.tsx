"use client"

import { useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"
import { Server, Settings } from "lucide-react"

interface WgFlat {
  private_key: string
  local_address: string
  mtu: number
  peer_address: string
  peer_port: number
  peer_public_key: string
  pre_shared_key: string
  allowed_ips: string
  keepalive_interval: number
  reserved: string
}

function deriveFlat(initialConfig: any): WgFlat {
  const c = initialConfig?.type === "wireguard" ? initialConfig : null
  const peer = c?.peers?.[0]
  const peerAddress = peer?.address || c?.server || ""
  const peerPort = peer?.port || c?.server_port || 51820
  const peerPublicKey = peer?.public_key || c?.peer_public_key || ""
  const peerPreSharedKey = peer?.pre_shared_key || c?.pre_shared_key || ""
  const peerReserved = peer?.reserved || c?.reserved
  const peerAllowedIPs = peer?.allowed_ips
  const peerKeepalive = peer?.persistent_keepalive_interval || 0
  const localAddr = c?.address?.[0] || c?.local_address?.[0] || "10.10.0.2/32"

  return {
    private_key: c?.private_key || "",
    local_address: typeof localAddr === "string" ? localAddr : "10.10.0.2/32",
    mtu: c?.mtu || 1420,
    peer_address: peerAddress,
    peer_port: peerPort,
    peer_public_key: peerPublicKey,
    pre_shared_key: peerPreSharedKey,
    allowed_ips: Array.isArray(peerAllowedIPs) ? peerAllowedIPs.join(", ") : "0.0.0.0/0, ::/0",
    keepalive_interval: peerKeepalive,
    reserved: Array.isArray(peerReserved) ? peerReserved.join(",") : "",
  }
}

function buildWgOutbound(s: WgFlat): any {
  const peer: any = {
    address: s.peer_address,
    port: s.peer_port,
    public_key: s.peer_public_key,
  }
  if (s.pre_shared_key) peer.pre_shared_key = s.pre_shared_key
  if (s.allowed_ips) {
    peer.allowed_ips = s.allowed_ips.split(",").map((x: string) => x.trim()).filter(Boolean)
  }
  if (s.keepalive_interval) peer.persistent_keepalive_interval = s.keepalive_interval
  if (s.reserved) {
    const reservedArr = s.reserved.split(",").map((x: string) => parseInt(x.trim())).filter((n: number) => !isNaN(n))
    if (reservedArr.length === 3) peer.reserved = reservedArr
  }
  return {
    type: "wireguard",
    tag: "proxy_out",
    address: [s.local_address],
    private_key: s.private_key,
    mtu: s.mtu,
    peers: [peer],
  }
}

export function WireguardForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")

  const flat = deriveFlat(initialConfig)

  const updateOutbound = useCallback((patch: Partial<WgFlat>) => {
    const merged = { ...flat, ...patch }
    setOutbound(0, buildWgOutbound(merged))
  }, [flat, setOutbound])

  return (
    <div className="space-y-6">
      {/* Local config */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
            <Settings className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{t("localConfig") || "Local Configuration"}</h3>
            <p className="text-xs text-muted-foreground">{t("localConfigDesc") || "Your device settings"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("localPrivateKey")}</Label>
            <Input
              value={flat.private_key}
              onChange={(e) => updateOutbound({ private_key: e.target.value })}
              placeholder={t("enterPrivateKey")}
              className="h-9 text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("localAddress")}</Label>
              <Input
                value={flat.local_address}
                onChange={(e) => updateOutbound({ local_address: e.target.value })}
                placeholder="10.10.0.2/32"
                className="h-9 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">MTU</Label>
              <Input
                type="number"
                value={flat.mtu}
                onChange={(e) => updateOutbound({ mtu: parseInt(e.target.value) || 1420 })}
                className="h-9 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Peer config */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-green-500/10 text-green-500">
            <Server className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{t("wgPeer")}</h3>
            <p className="text-xs text-muted-foreground">{t("wgPeerDesc") || "Server endpoint configuration"}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("serverAddr")}</Label>
              <Input
                placeholder="example.com"
                value={flat.peer_address}
                onChange={(e) => updateOutbound({ peer_address: e.target.value })}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{tc("port")}</Label>
              <Input
                type="number"
                value={flat.peer_port}
                onChange={(e) => updateOutbound({ peer_port: parseInt(e.target.value) || 51820 })}
                className="h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("serverPublicKey")}</Label>
            <Input
              value={flat.peer_public_key}
              onChange={(e) => updateOutbound({ peer_public_key: e.target.value })}
              placeholder={t("serverPublicKeyPlaceholder")}
              className="h-9 text-sm font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("presharedKeyOptional")}</Label>
            <Input
              value={flat.pre_shared_key}
              onChange={(e) => updateOutbound({ pre_shared_key: e.target.value })}
              placeholder="Pre-Shared Key"
              className="h-9 text-sm font-mono"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("allowedIps")}</Label>
              <Input
                value={flat.allowed_ips}
                onChange={(e) => updateOutbound({ allowed_ips: e.target.value })}
                placeholder="0.0.0.0/0, ::/0"
                className="h-9 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">{t("keepaliveInterval")}</Label>
              <Input
                type="number"
                value={flat.keepalive_interval}
                onChange={(e) => updateOutbound({ keepalive_interval: parseInt(e.target.value) || 0 })}
                placeholder="0"
                className="h-9 text-sm"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">{t("keepaliveIntervalHint")}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground/80">Reserved (WARP)</Label>
              <Input
                value={flat.reserved}
                onChange={(e) => updateOutbound({ reserved: e.target.value })}
                placeholder="0,0,0"
                className="h-9 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground leading-tight">{t("forCloudflareWarp")}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
