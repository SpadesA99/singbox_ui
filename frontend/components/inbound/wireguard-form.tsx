"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Download } from "lucide-react"
import { isValidPort, parsePort, parseErrorResponse } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, LocalPeer } from "./types"

function parseKeepaliveSeconds(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (!normalized) return undefined
    const match = normalized.match(/^(\d+)(s)?$/)
    if (!match) return undefined
    const parsed = parseInt(match[1], 10)
    if (parsed > 0) return parsed
  }
  return undefined
}

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
    const loadedPeers = ((wgEndpoint?.peers || initialConfig?.peers) || []).map((peer: any) => ({
      publicKey: peer.public_key || "",
      privateKey: peer.private_key,
      presharedKey: peer.pre_shared_key || "",
      allowedIPs: peer.allowed_ips || [],
      persistentKeepaliveInterval: parseKeepaliveSeconds(peer.persistent_keepalive_interval),
    }))
    setWgConfig({
      listen_port: wgEndpoint?.listen_port || initialConfig?.listen_port || 5353,
      local_address: (wgEndpoint?.address?.[0] || initialConfig?.address?.[0]) || "10.10.0.1/32",
      private_key: wgEndpoint?.private_key || initialConfig?.private_key || "",
      peers: loadedPeers.length > 0 ? loadedPeers : [{ publicKey: "", allowedIPs: ["10.10.0.2/32"] }],
      mtu: wgEndpoint?.mtu || initialConfig?.mtu || 1420,
    })
    isInitializedRef.current = true
  }, [initialConfig, initialEndpoint])

  // Building useEffect — WireGuard is an endpoint, not an inbound
  useEffect(() => {
    if (!isInitializedRef.current) return
    const wgPeers = wgConfig.peers
      .filter((p) => p.publicKey)
      .map((p) => {
        const peer: any = {
          public_key: p.publicKey,
          allowed_ips: p.allowedIPs,
        }
        if (p.presharedKey) peer.pre_shared_key = p.presharedKey
        if (typeof p.persistentKeepaliveInterval === "number" && p.persistentKeepaliveInterval > 0) {
          peer.persistent_keepalive_interval = p.persistentKeepaliveInterval
        }
        return peer
      })

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
          } catch (err) {
            console.warn("Failed to save client config file:", err)
          }
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            className={!isValidPort(wgConfig.listen_port) ? "border-red-500 h-9 text-sm" : "h-9 text-sm"}
          />
          {!isValidPort(wgConfig.listen_port) && (
            <p className="text-[10px] text-red-500">{t("portRange")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("interfaceAddr")}</Label>
          <Input
            value={wgConfig.local_address}
            onChange={(e) => setWgConfig({ ...wgConfig, local_address: e.target.value })}
            placeholder="10.10.0.1/32"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>MTU</Label>
          <Input
            type="number"
            value={wgConfig.mtu}
            onChange={(e) => setWgConfig({ ...wgConfig, mtu: parseInt(e.target.value) || 1420 })}
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>{t("privateKey")}</Label>
            <Button type="button" size="sm" variant="ghost" className="h-5 px-1 text-[10px]" onClick={generateWireGuardKeys}>
              <Key className="h-3 w-3 mr-1" />
              {t("generateKey")}
            </Button>
          </div>
          <Input
            value={wgConfig.private_key}
            onChange={(e) => setWgConfig({ ...wgConfig, private_key: e.target.value })}
            placeholder={t("clickToGenerate")}
            readOnly
            className="font-mono h-9 text-xs bg-muted"
          />
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base font-medium">{t("peers")}</Label>
            <p className="text-xs text-muted-foreground">{t("managePeers")}</p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              const nextIP = findNextAvailableIP()
              setWgConfig({
                ...wgConfig,
                peers: [...wgConfig.peers, { publicKey: "", allowedIPs: [`${nextIP}/32`] }],
              })
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {tc("add")}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
          {wgConfig.peers.map((peer, index) => (
            <div key={index} className="p-6 rounded-2xl bg-white dark:bg-zinc-900 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-zinc-100 dark:border-zinc-800 relative group transition-all duration-300">
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                      {index + 1}
                    </div>
                    <Label className="text-sm font-semibold tracking-tight text-zinc-700 dark:text-zinc-300">Peer {index + 1}</Label>
                  </div>
                  <div className="flex gap-1.5">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full" onClick={() => generatePeerKeys(index)} title={t("generateKey")}>
                      <Key className="h-4 w-4" />
                    </Button>
                    {peer.privateKey && (
                      <>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full" onClick={() => showPeerQrCode(index)} title={t("qrCode")}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full" onClick={() => downloadPeerConfig(index)} title={t("downloadConfig")}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {wgConfig.peers.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-full"
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
                  <Label className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold ml-1">{t("configuration")}</Label>
                  <div className="space-y-3 p-4 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/50 border border-zinc-100 dark:border-zinc-800/50">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("publicKeyLabel")}</Label>
                      <Input
                        placeholder={t("clickGenerateKey")}
                        value={peer.publicKey}
                        readOnly
                        className="font-mono h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                      />
                    </div>
                    
                    {peer.privateKey && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{t("privateKeyPeer")}</Label>
                        <Input value={peer.privateKey} readOnly className="font-mono h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20" />
                      </div>
                    )}
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("allowedIpComma")}</Label>
                      <Input
                        placeholder="10.10.0.2/32"
                        value={peer.allowedIPs.join(", ")}
                        onChange={(e) => {
                          const newPeers = [...wgConfig.peers]
                          newPeers[index].allowedIPs = e.target.value.split(",").map((s) => s.trim())
                          setWgConfig({ ...wgConfig, peers: newPeers })
                        }}
                        className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                      />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{t("presharedKeyLabel")}</Label>
                        <Input
                          placeholder={t("presharedKeyOptional")}
                          value={peer.presharedKey || ""}
                          onChange={(e) => {
                            const newPeers = [...wgConfig.peers]
                            newPeers[index].presharedKey = e.target.value
                            setWgConfig({ ...wgConfig, peers: newPeers })
                          }}
                          className="font-mono h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{t("persistentKeepalive")}</Label>
                        <Input
                          type="number"
                          min="0"
                          max="65535"
                          placeholder="25"
                          value={peer.persistentKeepaliveInterval ?? ""}
                          onChange={(e) => {
                            const newPeers = [...wgConfig.peers]
                            const value = parseInt(e.target.value, 10)
                            newPeers[index].persistentKeepaliveInterval = Number.isFinite(value) && value > 0 ? value : undefined
                            setWgConfig({ ...wgConfig, peers: newPeers })
                          }}
                          className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
