"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Key, QrCode, Download } from "lucide-react"
import { isValidPort, parsePort, parseErrorResponse } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, LocalPeer } from "./types"

function extractPrivateKeyFromConf(content: string): string | undefined {
  const match = content.match(/PrivateKey\s*=\s*(\S+)/i)
  return match?.[1]
}

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

interface WgFlat {
  listen_port: number
  local_address: string
  private_key: string
  peers: LocalPeer[]
  mtu: number
}

function deriveFlat(initialConfig: any, initialEndpoint: any): WgFlat {
  const wgEndpoint = initialEndpoint?.type === "wireguard" ? initialEndpoint : null
  const loadedPeers = ((wgEndpoint?.peers || initialConfig?.peers) || []).map((peer: any) => ({
    publicKey: peer.public_key || "",
    privateKey: peer.private_key,
    presharedKey: peer.pre_shared_key || "",
    allowedIPs: peer.allowed_ips || [],
    persistentKeepaliveInterval: parseKeepaliveSeconds(peer.persistent_keepalive_interval),
  }))
  return {
    listen_port: wgEndpoint?.listen_port || initialConfig?.listen_port || 5353,
    local_address: (wgEndpoint?.address?.[0] || initialConfig?.address?.[0]) || "10.10.0.1/32",
    private_key: wgEndpoint?.private_key || initialConfig?.private_key || "",
    peers: loadedPeers.length > 0 ? loadedPeers : [{ publicKey: "", allowedIPs: ["10.10.0.2/32"] }],
    mtu: wgEndpoint?.mtu || initialConfig?.mtu || 1420,
  }
}

function buildWireguardEndpoint(f: WgFlat): any {
  const wgPeers = f.peers
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

  return {
    type: "wireguard",
    tag: "wireguard-ep",
    listen_port: f.listen_port,
    private_key: f.private_key,
    address: [f.local_address],
    peers: wgPeers,
    mtu: f.mtu,
  }
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

  const flat = deriveFlat(initialConfig, initialEndpoint)

  // Peer private keys are NOT persisted into the sing-box endpoint (buildWireguardEndpoint
  // strips them — the server shouldn't hold client private keys). We keep them in local
  // state keyed by public key so the Download/QR buttons survive re-renders, and fall
  // back to reading the saved client{N}.conf file on disk when local state is empty
  // (e.g. after page reload).
  //
  // IMPORTANT: the disk filename `client{N}.conf` is assigned by 1-based peer index at
  // generation time; after a mid-list peer deletion the filename↔peer mapping drifts.
  // To avoid producing a .conf whose PrivateKey doesn't match the rendered [Peer]
  // PublicKey, we match disk files by *deriving* the public key from the stored
  // private key (via /api/wireguard/pubkey) and keying by that — never by filename.
  const [peerPrivateKeys, setPeerPrivateKeys] = useState<Record<string, string>>({})

  const rememberPeerPrivateKey = useCallback((publicKey: string, privateKey: string) => {
    if (!publicKey || !privateKey) return
    setPeerPrivateKeys((prev) =>
      prev[publicKey] === privateKey ? prev : { ...prev, [publicKey]: privateKey }
    )
  }, [])

  const resolvePeerPrivateKey = useCallback(
    (peer: LocalPeer): string | undefined => {
      if (peer.publicKey && peerPrivateKeys[peer.publicKey]) return peerPrivateKeys[peer.publicKey]
      return peer.privateKey
    },
    [peerPrivateKeys]
  )

  const derivePublicKey = useCallback(async (privateKey: string): Promise<string | undefined> => {
    try {
      const response = await fetch("/api/wireguard/pubkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateKey }),
      })
      if (!response.ok) return undefined
      const data = await response.json()
      return typeof data?.publicKey === "string" ? data.publicKey : undefined
    } catch {
      return undefined
    }
  }, [])

  // Fetch all persisted client .conf files and return a map keyed by the public key
  // *derived from* each file's PrivateKey. This avoids the stale filename↔peer-index
  // drift that occurs after mid-list peer deletions.
  const loadClientKeysByPublicKey = useCallback(async (): Promise<Record<string, string>> => {
    try {
      const response = await fetch("/api/wireguard/client-files")
      if (!response.ok) return {}
      const files: { name: string; content: string }[] = await response.json()
      if (!Array.isArray(files) || files.length === 0) return {}
      const entries = await Promise.all(
        files.map(async (f) => {
          const privateKey = extractPrivateKeyFromConf(f.content)
          if (!privateKey) return null
          const publicKey = await derivePublicKey(privateKey)
          if (!publicKey) return null
          return [publicKey, privateKey] as const
        })
      )
      const out: Record<string, string> = {}
      for (const entry of entries) {
        if (entry) out[entry[0]] = entry[1]
      }
      return out
    } catch {
      return {}
    }
  }, [derivePublicKey])

  // On mount / when peer publicKeys change, hydrate peerPrivateKeys from disk so
  // post-reload downloads still work. Only keeps entries whose derived publicKey
  // matches a peer currently in the form.
  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      const loaded = await loadClientKeysByPublicKey()
      if (cancelled || Object.keys(loaded).length === 0) return
      const currentPubs = new Set(flat.peers.map((p) => p.publicKey).filter(Boolean))
      const filtered: Record<string, string> = {}
      for (const [pub, priv] of Object.entries(loaded)) {
        if (currentPubs.has(pub)) filtered[pub] = priv
      }
      if (cancelled || Object.keys(filtered).length === 0) return
      // Merge order: freshly generated in-session keys (prev) win over disk values.
      setPeerPrivateKeys((prev) => ({ ...filtered, ...prev }))
    }
    hydrate()
    return () => {
      cancelled = true
    }
    // Only hydrate when the set of peer public keys changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat.peers.map((p) => p.publicKey).join("|")])

  const updateEndpoint = useCallback((patch: Partial<WgFlat>) => {
    const merged = { ...flat, ...patch }
    setEndpoint(0, buildWireguardEndpoint(merged))
  }, [flat, setEndpoint])

  const findNextAvailableIP = useCallback(() => {
    const usedIPs = flat.peers
      .map((peer) => {
        const allowedIP = peer.allowedIPs[0] || ""
        const match = allowedIP.match(/10\.10\.0\.(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter((ip) => ip > 0)

    const maxIP = usedIPs.length > 0 ? Math.max(...usedIPs) : 1
    return `10.10.0.${maxIP + 1}`
  }, [flat.peers])

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
      updateEndpoint({ private_key: data.privateKey })
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateKeysFailed"))
    }
  }

  const generatePeerKeys = async (peerIndex: number) => {
    onError("")
    try {
      const currentPeer = flat.peers[peerIndex]
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

      rememberPeerPrivateKey(clientKeys.publicKey, clientKeys.privateKey)

      const newPeers = [...flat.peers]
      newPeers[peerIndex] = {
        ...newPeers[peerIndex],
        publicKey: clientKeys.publicKey,
        privateKey: clientKeys.privateKey,
        allowedIPs: [clientIPWithCIDR],
      }
      updateEndpoint({ peers: newPeers })

      if (flat.private_key) {
        const serverPubKeyResponse = await fetch("/api/wireguard/pubkey", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privateKey: flat.private_key }),
        })

        if (serverPubKeyResponse.ok) {
          const serverPubKeyData = await serverPubKeyResponse.json()
          const configContent = `[Interface]
PrivateKey = ${clientKeys.privateKey}
Address = ${peerIP}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${serverPubKeyData.publicKey}
Endpoint = your-server-ip:${flat.listen_port}
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

  const resolveClientPrivateKey = useCallback(
    async (peer: LocalPeer): Promise<string | undefined> => {
      const local = resolvePeerPrivateKey(peer)
      if (local) return local
      if (!peer.publicKey) return undefined
      // Disk fallback: load all client .conf files, match by derived public key.
      const loaded = await loadClientKeysByPublicKey()
      const match = loaded[peer.publicKey]
      if (match) rememberPeerPrivateKey(peer.publicKey, match)
      return match
    },
    [loadClientKeysByPublicKey, rememberPeerPrivateKey, resolvePeerPrivateKey]
  )

  const buildPeerConfContent = async (
    peer: LocalPeer,
    clientPrivateKey: string
  ): Promise<string> => {
    const [serverPubKeyResponse, publicIPResponse] = await Promise.all([
      fetch("/api/wireguard/pubkey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privateKey: flat.private_key }),
      }),
      fetch("/api/wireguard/public-ip"),
    ])
    if (!serverPubKeyResponse.ok) throw new Error(await parseErrorResponse(serverPubKeyResponse))
    if (!publicIPResponse.ok) throw new Error(await parseErrorResponse(publicIPResponse))
    const [serverPubKeyData, publicIPData] = await Promise.all([
      serverPubKeyResponse.json(),
      publicIPResponse.json(),
    ])

    const clientIP = (peer.allowedIPs[0] || "10.10.0.2/32").split("/")[0]
    return `[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientIP}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${serverPubKeyData.publicKey}
Endpoint = ${publicIPData.ip}:${flat.listen_port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
`
  }

  const downloadPeerConfig = async (peerIndex: number) => {
    onError("")
    const peer = flat.peers[peerIndex]
    if (!flat.private_key) {
      onError(t("generateKeysFirst"))
      return
    }

    try {
      const clientPrivateKey = await resolveClientPrivateKey(peer)
      if (!clientPrivateKey) {
        onError(t("generateKeysFirst"))
        return
      }
      const configContent = await buildPeerConfContent(peer, clientPrivateKey)
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
    onError("")
    const peer = flat.peers[peerIndex]
    if (!flat.private_key) {
      onError(t("generateKeysFirst"))
      return
    }

    try {
      const clientPrivateKey = await resolveClientPrivateKey(peer)
      if (!clientPrivateKey) {
        onError(t("generateKeysFirst"))
        return
      }
      const configContent = (await buildPeerConfContent(peer, clientPrivateKey)).trimEnd()
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
            value={flat.listen_port}
            onChange={(e) => {
              const port = parsePort(e.target.value, flat.listen_port)
              updateEndpoint({ listen_port: port })
            }}
            className={!isValidPort(flat.listen_port) ? "border-red-500 h-9 text-sm" : "h-9 text-sm"}
          />
          {!isValidPort(flat.listen_port) && (
            <p className="text-[10px] text-red-500">{t("portRange")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("interfaceAddr")}</Label>
          <Input
            value={flat.local_address}
            onChange={(e) => updateEndpoint({ local_address: e.target.value })}
            placeholder="10.10.0.1/32"
            className="h-9 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label>MTU</Label>
          <Input
            type="number"
            value={flat.mtu}
            onChange={(e) => updateEndpoint({ mtu: parseInt(e.target.value) || 1420 })}
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
            value={flat.private_key}
            onChange={(e) => updateEndpoint({ private_key: e.target.value })}
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
              updateEndpoint({ peers: [...flat.peers, { publicKey: "", allowedIPs: [`${nextIP}/32`] }] })
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {tc("add")}
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-6">
          {flat.peers.map((peer, index) => {
            const resolvedPrivateKey = resolvePeerPrivateKey(peer)
            return (
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
                    {peer.publicKey && (
                      <>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full" onClick={() => showPeerQrCode(index)} title={t("qrCode")}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-zinc-400 hover:text-primary hover:bg-primary/5 rounded-full" onClick={() => downloadPeerConfig(index)} title={t("downloadConfig")}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {flat.peers.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-zinc-400 hover:text-destructive hover:bg-destructive/5 rounded-full"
                        onClick={() =>
                          updateEndpoint({ peers: flat.peers.filter((_, i) => i !== index) })
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

                    {resolvedPrivateKey && (
                      <div className="space-y-1.5">
                        <Label className="text-xs text-zinc-500">{t("privateKeyPeer")}</Label>
                        <Input value={resolvedPrivateKey} readOnly className="font-mono h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20" />
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <Label className="text-xs text-zinc-500">{t("allowedIpComma")}</Label>
                      <Input
                        placeholder="10.10.0.2/32"
                        value={peer.allowedIPs.join(", ")}
                        onChange={(e) => {
                          const newPeers = [...flat.peers]
                          newPeers[index] = { ...newPeers[index], allowedIPs: e.target.value.split(",").map((s) => s.trim()) }
                          updateEndpoint({ peers: newPeers })
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
                            const newPeers = [...flat.peers]
                            newPeers[index] = { ...newPeers[index], presharedKey: e.target.value }
                            updateEndpoint({ peers: newPeers })
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
                            const newPeers = [...flat.peers]
                            const value = parseInt(e.target.value, 10)
                            newPeers[index] = { ...newPeers[index], persistentKeepaliveInterval: Number.isFinite(value) && value > 0 ? value : undefined }
                            updateEndpoint({ peers: newPeers })
                          }}
                          className="h-9 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-sm focus-visible:ring-primary/20"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
