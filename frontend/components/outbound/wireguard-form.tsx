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
    server: "",
    server_port: 51820,
    private_key: "",
    peer_public_key: "",
    pre_shared_key: "",
    local_address: "10.10.0.2/32",
    reserved: "",
    mtu: 1420,
  })

  useEffect(() => {
    if (isInitializedRef.current) return
    if (initialConfig && initialConfig.type === "wireguard") {
      setWgConfig({
        server: initialConfig.server || "",
        server_port: initialConfig.server_port || 51820,
        private_key: initialConfig.private_key || "",
        peer_public_key: initialConfig.peer_public_key || "",
        pre_shared_key: initialConfig.pre_shared_key || "",
        local_address: initialConfig.local_address?.[0] || "10.10.0.2/32",
        reserved: Array.isArray(initialConfig.reserved) ? initialConfig.reserved.join(",") : "",
        mtu: initialConfig.mtu || 1420,
      })
    }
    isInitializedRef.current = true
  }, [initialConfig])

  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!wgConfig.private_key || !wgConfig.peer_public_key || !wgConfig.server) return

    const previewConfig: any = {
      type: "wireguard",
      tag: "proxy_out",
      server: wgConfig.server,
      server_port: wgConfig.server_port,
      private_key: wgConfig.private_key,
      peer_public_key: wgConfig.peer_public_key,
      local_address: [wgConfig.local_address],
      mtu: wgConfig.mtu,
    }
    if (wgConfig.pre_shared_key) {
      previewConfig.pre_shared_key = wgConfig.pre_shared_key
    }
    if (wgConfig.reserved) {
      const reservedArr = wgConfig.reserved.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n))
      if (reservedArr.length === 3) {
        previewConfig.reserved = reservedArr
      }
    }

    setOutbound(0, previewConfig)
  }, [wgConfig, setOutbound])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("serverAddr")}</Label>
          <Input
            placeholder="example.com"
            value={wgConfig.server}
            onChange={(e) => setWgConfig({ ...wgConfig, server: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            value={wgConfig.server_port}
            onChange={(e) => setWgConfig({ ...wgConfig, server_port: parseInt(e.target.value) || 51820 })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("localPrivateKey")}</Label>
        <Input
          value={wgConfig.private_key}
          onChange={(e) => setWgConfig({ ...wgConfig, private_key: e.target.value })}
          placeholder={t("enterPrivateKey")}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label>{t("serverPublicKey")}</Label>
        <Input
          value={wgConfig.peer_public_key}
          onChange={(e) => setWgConfig({ ...wgConfig, peer_public_key: e.target.value })}
          placeholder={t("serverPublicKeyPlaceholder")}
          className="font-mono text-xs"
        />
      </div>
      <div className="space-y-2">
        <Label>{t("presharedKeyOptional")}</Label>
        <Input
          value={wgConfig.pre_shared_key}
          onChange={(e) => setWgConfig({ ...wgConfig, pre_shared_key: e.target.value })}
          placeholder="Pre-Shared Key"
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
  )
}
