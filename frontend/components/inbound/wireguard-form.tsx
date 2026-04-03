"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Download } from "lucide-react"
import { isValidPort, parsePort, parseErrorResponse } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, LocalPeer } from "./types"

export function WireguardForm({
  initialConfig,
  initialEndpoint,
  setEndpoint,
  onError,
  onShowQrCode,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")
  const isInitializedRef = useRef(false)

  const [wgConfig, setWgConfig] = useState({
    listen_port: 5353,
    local_address: "10.10.0.1/32",
    private_key: "",
    peers: [{ publicKey: "", allowedIPs: ["10.10.0.2/32"] }] as LocalPeer[],
    mtu: 1420,
  })

  // Loading useEffect
  useEffect(() => {
    if (isInitializedRef.current) return
    const wgEndpoint = initialEndpoint?.type === "wireguard" ? initialEndpoint : null
    const loadedPeers = ((wgEndpoint?.peers || initialConfig.peers) || []).map((peer: any) => ({
      publicKey: peer.public_key || "",
      privateKey: peer.private_key,
      allowedIPs: peer.allowed_ips || [],
    }))
    setWgConfig({
      listen_port: wgEndpoint?.listen_port || initialConfig.listen_port || 5353,
      local_address: (wgEndpoint?.address?.[0] || initialConfig.address?.[0]) || "10.10.0.1/32",
      private_key: wgEndpoint?.private_key || initialConfig.private_key || "",
      peers: loadedPeers.length > 0 ? loadedPeers : [{ publicKey: "", allowedIPs: ["10.10.0.2/32"] }],
      mtu: wgEndpoint?.mtu || initialConfig.mtu || 1420,
    })
    isInitializedRef.current = true
  }, [initialConfig, initialEndpoint])

  // Building useEffect — WireGuard is an endpoint, not an inbound
  useEffect(() => {
    if (!isInitializedRef.current) return
    const wgPeers = wgConfig.peers
      .filter((p) => p.publicKey)
      .map((p) => ({
        public_key: p.publicKey,
        allowed_ips: p.allowedIPs,
      }))

    setEndpoint(0, {
      type: "wireguard",
      tag: "wireguard-ep",
      listen_port: wgConfig.listen_port,
      private_key: wgConfig.private_key,
      address: [wgConfig.local_address],
      peers: wgPeers,
      mtu: wgConfig.mtu,
    })
    // WireGuard returns early — no clearEndpoints, no setInbound
  }, [wgConfig, setEndpoint])

  const generateWireGuardKeys = async () => {
    onError("")
    try {
      const response = await fetch("/api/wireguard/keygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: "10.10.0.1" }),
      })

      if (!response.ok) {
        const errorMsg = await parseErrorResponse(response)
        throw new Error(errorMsg)
      }

      const data = await response.json()
      setWgConfig({ ...wgConfig, private_key: data.privateKey })
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateKeysFailed"))
    }
  }

  const findNextAvailableIP = () => {
    const usedIPs = wgConfig.peers
      .map((peer) => {
        const allowedIP = peer.allowedIPs[0] || ""
        const match = allowedIP.match(/10\.10\.0\.(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter((ip) => ip > 0)

    const maxIP = usedIPs.length > 0 ? Math.max(...usedIPs) : 1
    return `10.10.0.${maxIP + 1}`
  }

  const generatePeerKeys = async (peerIndex: number) => {
    onError("")
    try {
      const currentPeer = wgConfig.peers[peerIndex]
      let peerIP: string

      if (currentPeer.allowedIPs && currentPeer.allowedIPs.length > 0) {
        peerIP = currentPeer.allowedIPs[0].split("/")[0]
      } else {
        peerIP = findNextAvailableIP()
      }

      const response = await fetch("/api/wireguard/keygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: peerIP }),
      })

      if (!response.ok) {
        const errorMsg = await parseErrorResponse(response)
        throw new Error(errorMsg)
      }

      const clientKeys = await response.json()
      const clientIPWithCIDR = `${peerIP}/32`

      const newPeers = [...wgConfig.peers]
      newPeers[peerIndex] = {
        ...newPeers[peerIndex],
        publicKey: clientKeys.publicKey,
        privateKey: clientKeys.privateKey,
        allowedIPs: [clientIPWithCIDR],
      }
      setWgConfig({ ...wgConfig, peers: newPeers })

      if (wgConfig.private_key) {
        const serverPubKeyResponse = await fetch("/api/wireguard/pubkey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privateKey: wgConfig.private_key }),
        })

        if (serverPubKeyResponse.ok) {
          const serverPubKeyData = await serverPubKeyResponse.json()
          const configContent = `[Interface]
PrivateKey = ${clientKeys.privateKey}
Address = ${peerIP}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${serverPubKeyData.publicKey}
Endpoint = your-server-ip:${wgConfig.listen_port}
AllowedIPs = 0.0.0.0/0, ::/0
`
          try {
            await fetch("/api/wireguard/save-client-file", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clientIndex: peerIndex + 1, configContent }),
            })
          } catch {}
        }
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateKeysFailed"))
    }
  }

  const downloadPeerConfig = async (peerIndex: number) => {
    const peer = wgConfig.peers[peerIndex]
    if (!peer.privateKey || !wgConfig.private_key) {
      onError(t("generateKeysFirst"))
      return
    }

    try {
      const serverPubKeyResponse = await fetch("/api/wireguard/pubkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateKey: wgConfig.private_key }),
      })

      if (!serverPubKeyResponse.ok) throw new Error(await parseErrorResponse(serverPubKeyResponse))

      const serverPubKeyData = await serverPubKeyResponse.json()
      const publicIPResponse = await fetch("/api/wireguard/public-ip")
      if (!publicIPResponse.ok) throw new Error(await parseErrorResponse(publicIPResponse))

      const publicIPData = await publicIPResponse.json()
      const clientIP = (peer.allowedIPs[0] || "10.10.0.2/32").split("/")[0]
      const configContent = `[Interface]
PrivateKey = ${peer.privateKey}
Address = ${clientIP}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${serverPubKeyData.publicKey}
Endpoint = ${publicIPData.ip}:${wgConfig.listen_port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`
      const blob = new Blob([configContent], { type: "text/plain" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `wireguard-client${peerIndex + 1}.conf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      onError(err instanceof Error ? err.message : t("downloadConfigFailed"))
    }
  }

  const showPeerQrCode = async (peerIndex: number) => {
    const peer = wgConfig.peers[peerIndex]
    if (!peer.privateKey || !wgConfig.private_key) {
      onError(t("generateKeysFirst"))
      return
    }

    try {
      const serverPubKeyResponse = await fetch("/api/wireguard/pubkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateKey: wgConfig.private_key }),
      })

      if (!serverPubKeyResponse.ok) throw new Error(await parseErrorResponse(serverPubKeyResponse))

      const serverPubKeyData = await serverPubKeyResponse.json()
      const publicIPResponse = await fetch("/api/wireguard/public-ip")
      if (!publicIPResponse.ok) throw new Error(await parseErrorResponse(publicIPResponse))

      const publicIPData = await publicIPResponse.json()
      const clientIP = (peer.allowedIPs[0] || "10.10.0.2/32").split("/")[0]
      const configContent = `[Interface]
PrivateKey = ${peer.privateKey}
Address = ${clientIP}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${serverPubKeyData.publicKey}
Endpoint = ${publicIPData.ip}:${wgConfig.listen_port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`

      onShowQrCode(configContent, "wireguard", peerIndex)
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>{tc("port")}</Label>
          <Input
            type="number"
            min="1"
            max="65535"
            value={wgConfig.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, wgConfig.listen_port)
              setWgConfig({ ...wgConfig, listen_port: port })
            }}
            className={!isValidPort(wgConfig.listen_port) ? "border-red-500" : ""}
          />
          {!isValidPort(wgConfig.listen_port) && (
            <p className="text-xs text-red-500">{t("portRange")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("interfaceAddr")}</Label>
          <Input
            value={wgConfig.local_address}
            onChange={(e) => setWgConfig({ ...wgConfig, local_address: e.target.value })}
            placeholder="10.10.0.1/32"
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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("privateKey")}</Label>
          <Button type="button" size="sm" variant="outline" onClick={generateWireGuardKeys}>
            <Key className="h-4 w-4 mr-1" />
            {t("generateKey")}
          </Button>
        </div>
        <Input
          value={wgConfig.private_key}
          onChange={(e) => setWgConfig({ ...wgConfig, private_key: e.target.value })}
          placeholder={t("clickToGenerate")}
          readOnly
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t("peers")}</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const nextIP = findNextAvailableIP()
              setWgConfig({
                ...wgConfig,
                peers: [...wgConfig.peers, { publicKey: "", allowedIPs: [`${nextIP}/32`] }],
              })
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            {tc("add")}
          </Button>
        </div>

        {wgConfig.peers.map((peer, index) => (
          <Card key={index} className="p-3">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-sm">Peer {index + 1}</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => generatePeerKeys(index)}>
                    <Key className="h-4 w-4 mr-1" />
                    {t("generateKey")}
                  </Button>
                  {peer.privateKey && (
                    <>
                      <Button type="button" size="sm" variant="outline" onClick={() => showPeerQrCode(index)}>
                        <QrCode className="h-4 w-4 mr-1" />
                        {t("qrCode")}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => downloadPeerConfig(index)}>
                        {t("downloadConfig")}
                      </Button>
                    </>
                  )}
                  {wgConfig.peers.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setWgConfig({
                          ...wgConfig,
                          peers: wgConfig.peers.filter((_, i) => i !== index),
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("publicKeyLabel")}</Label>
                <Input
                  placeholder={t("clickGenerateKey")}
                  value={peer.publicKey}
                  readOnly
                  className="font-mono text-xs"
                />
              </div>
              {peer.privateKey && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">{t("privateKeyPeer")}</Label>
                  <Input value={peer.privateKey} readOnly className="font-mono text-xs bg-muted" />
                </div>
              )}
              <div className="space-y-2">
                <Label className="text-xs">{t("allowedIpComma")}</Label>
                <Input
                  placeholder="0.0.0.0/0"
                  value={peer.allowedIPs.join(", ")}
                  onChange={(e) => {
                    const newPeers = [...wgConfig.peers]
                    newPeers[index].allowedIPs = e.target.value.split(",").map((s) => s.trim())
                    setWgConfig({ ...wgConfig, peers: newPeers })
                  }}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
