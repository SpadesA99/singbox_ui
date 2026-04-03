// Shared types for inbound protocol form components

// sing-box 格式的用户类型
export interface VLESSUser {
  uuid: string
  name?: string
  flow?: string
}

export interface VMESSUser {
  uuid: string
  name?: string
  alterId?: number
}

export interface TrojanUser {
  name?: string
  password: string
}

export interface TUICUser {
  name?: string
  uuid: string
  password?: string
}

export interface NaiveUser {
  username: string
  password: string
}

export interface ShadowTLSUser {
  name?: string
  password: string
}

export interface AnyTLSUser {
  name?: string
  password: string
}

// 本地 UI 使用的 WireGuard Peer 类型
export interface LocalPeer {
  publicKey: string
  privateKey?: string
  allowedIPs: string[]
}

// QR code types
export type QrCodeType = "wireguard" | "shadowsocks" | "socks5" | "vless" | "hysteria2" | "vmess" | "trojan" | "tuic"

// Props shared by all protocol form components
export interface ProtocolFormProps {
  initialConfig: any
  initialEndpoint?: any
  // Store actions
  setInbound: (index: number, inbound: any) => void
  setEndpoint: (index: number, endpoint: any) => void
  clearEndpoints: () => void
  // Shared state
  currentInstance: string | null
  // Callbacks
  onError: (msg: string) => void
  onShowQrCode: (content: string, type: QrCodeType, peerIndex?: number) => void
  // Server IP (shared for QR code generation)
  serverIP: string
  setServerIP: (ip: string) => void
  // Certificate management
  certLoading: boolean
  setCertLoading: (loading: boolean) => void
  certInfo: { common_name?: string; valid_to?: string } | null
  setCertInfo: (info: { common_name?: string; valid_to?: string } | null) => void
  onGenerateCert: (domain?: string) => void
  onUploadCert: () => void
}

// Helper: fetch public IP (used by QR code generators)
export async function getPublicIP(
  serverIP: string,
  setServerIP: (ip: string) => void
): Promise<string> {
  if (serverIP) return serverIP
  const response = await fetch("/api/wireguard/public-ip")
  if (response.ok) {
    const data = await response.json()
    setServerIP(data.ip)
    return data.ip
  }
  throw new Error("Cannot get public IP")
}

// Helper: format listen address to sing-box format
export function formatListen(listen: string): string {
  if (listen === "0.0.0.0" || listen === "") return "::"
  return listen
}

// Helper: parse listen address from sing-box format
export function parseListen(listen?: string): string {
  if (listen === "::" || !listen) return "0.0.0.0"
  return listen
}
