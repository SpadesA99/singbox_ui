"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTranslation } from "@/lib/i18n"
import { OutboundFormProps } from "./types"

export function WireguardForm({ initialConfig, setOutbound }: OutboundFormProps) {
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [wgConfig, setWgConfig] = useState({
    private_key: "",
    local_address: "10.10.0.2/32",
    mtu: 1420,
    // Peer fields (single peer)
    peer_address: "",
    peer_port: 51820,
    peer_public_key: "",
    pre_shared_key: "",
    allowed_ips: "0.0.0.0/0, ::/0",
    keepalive_interval: 0,
    reserved: "",
  })

  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "wireguard") {
      // Support both new peers[] format and deprecated flat format
      const peer = initialConfig.peers?.[0]
      const peerAddress = peer?.address || initialConfig.server || ""
      const peerPort = peer?.port || initialConfig.server_port || 51820
      const peerPublicKey = peer?.public_key || initialConfig.peer_public_key || ""
      const peerPreSharedKey = peer?.pre_shared_key || initialConfig.pre_shared_key || ""
      const peerReserved = peer?.reserved || initialConfig.reserved
      const peerAllowedIPs = peer?.allowed_ips
      const peerKeepalive = peer?.persistent_keepalive_interval || 0
      const localAddr = initialConfig.address?.[0] || initialConfig.local_address?.[0] || "10.10.0.2/32"

      setWgConfig({
        private_key: initialConfig.private_key || "",
        local_address: typeof localAddr === "string" ? localAddr : "10.10.0.2/32",
        mtu: initialConfig.mtu || 1420,
        peer_address: peerAddress,
        peer_port: peerPort,
        peer_public_key: peerPublicKey,
        pre_shared_key: peerPreSharedKey,
        allowed_ips: Array.isArray(peerAllowedIPs) ? peerAllowedIPs.join(", ") : "0.0.0.0/0, ::/0",
        keepalive_interval: peerKeepalive,
        reserved: Array.isArray(peerReserved) ? peerReserved.join(",") : "",
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!wgConfig.private_key || !wgConfig.peer_public_key || !wgConfig.peer_address) return

    const peer: any = {
      address: wgConfig.peer_address,
      port: wgConfig.peer_port,
      public_key: wgConfig.peer_public_key,
    }
    if (wgConfig.pre_shared_key) {
      peer.pre_shared_key = wgConfig.pre_shared_key
    }
    if (wgConfig.allowed_ips) {
      peer.allowed_ips = wgConfig.allowed_ips.split(",").map((s: string) => s.trim()).filter(Boolean)
    }
    if (wgConfig.keepalive_interval) {
      peer.persistent_keepalive_interval = wgConfig.keepalive_interval
    }
    if (wgConfig.reserved) {
      const reservedArr = wgConfig.reserved.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n))
      if (reservedArr.length === 3) {
        peer.reserved = reservedArr
      }
    }

    const previewConfig: any = {
      type: "wireguard",
      tag: "proxy_out",
      address: [wgConfig.local_address],
      private_key: wgConfig.private_key,
      mtu: wgConfig.mtu,
      peers: [peer],
    }

    setOutbound(0, previewConfig)
  }, [wgConfig, setOutbound])

  return (
    <div className="space-y-4">
      {/* Local config */}
      <div className="space-y-2">
        <Label>{t("localPrivateKey")}</Label>
        <Input
          value={wgConfig.private_key}
          onChange={(e) => setWgConfig({ ...wgConfig, private_key: e.target.value })}
          placeholder={t("enterPrivateKey")}
          className="font-mono text-xs"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{t("localAddress")}</Label>
          <Input
            value={wgConfig.local_address}
            onChange={(e) => setWgConfig({ ...wgConfig, local_address: e.target.value })}
            placeholder="10.10.0.2/32"
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2">
          <Label>MTU</Label>
          <Input
            type="number"
            value={wgConfig.mtu}
            onChange={(e) => setWgConfig({ ...wgConfig, mtu: parseInt(e.target.value) || 1420 })}
          />
        </div>
      </div>

      {/* Peer config */}
      <div className="border-t pt-4">
        <Label className="font-semibold mb-2 block">{t("wgPeer")}</Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("serverAddr")}</Label>
            <Input
              placeholder="example.com"
              value={wgConfig.peer_address}
              onChange={(e) => setWgConfig({ ...wgConfig, peer_address: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{tc("port")}</Label>
            <Input
              type="number"
              value={wgConfig.peer_port}
              onChange={(e) => setWgConfig({ ...wgConfig, peer_port: parseInt(e.target.value) || 51820 })}
            />
          </div>
        </div>
        <div className="space-y-2 mt-2">
          <Label>{t("serverPublicKey")}</Label>
          <Input
            value={wgConfig.peer_public_key}
            onChange={(e) => setWgConfig({ ...wgConfig, peer_public_key: e.target.value })}
            placeholder={t("serverPublicKeyPlaceholder")}
            className="font-mono text-xs"
          />
        </div>
        <div className="space-y-2 mt-2">
          <Label>{t("presharedKeyOptional")}</Label>
          <Input
            value={wgConfig.pre_shared_key}
            onChange={(e) => setWgConfig({ ...wgConfig, pre_shared_key: e.target.value })}
            placeholder="Pre-Shared Key"
            className="font-mono text-xs"
          />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <div className="space-y-2">
            <Label>{t("allowedIps")}</Label>
            <Input
              value={wgConfig.allowed_ips}
              onChange={(e) => setWgConfig({ ...wgConfig, allowed_ips: e.target.value })}
              placeholder="0.0.0.0/0, ::/0"
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label>{t("keepaliveInterval")}</Label>
            <Input
              type="number"
              value={wgConfig.keepalive_interval}
              onChange={(e) => setWgConfig({ ...wgConfig, keepalive_interval: parseInt(e.target.value) || 0 })}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">{t("keepaliveIntervalHint")}</p>
          </div>
          <div className="space-y-2">
            <Label>Reserved (WARP)</Label>
            <Input
              value={wgConfig.reserved}
              onChange={(e) => setWgConfig({ ...wgConfig, reserved: e.target.value })}
              placeholder="0,0,0"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">{t("forCloudflareWarp")}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
