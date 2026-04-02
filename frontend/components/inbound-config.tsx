"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, Trash2, Key, QrCode, Shield, Upload } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  isValidPort,
  parsePort,
  isValidListenAddress,
  parseErrorResponse,
  generateSecureRandomString,
  generateSS2022Key,
} from "@/lib/utils"
import { useSingboxConfigStore } from "@/lib/store/singbox-config"
import { apiClient } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"

// sing-box 格式的 VLESS 用户
interface VLESSUser {
  uuid: string
  name?: string
  flow?: string
}

// sing-box 格式的 VMess 用户
interface VMESSUser {
  uuid: string
  name?: string
  alterId?: number
}

// sing-box 格式的 Trojan 用户
interface TrojanUser {
  name?: string
  password: string
}

// sing-box 格式的 TUIC 用户
interface TUICUser {
  name?: string
  uuid: string
  password?: string
}

// sing-box 格式的 Naive 用户
interface NaiveUser {
  username: string
  password: string
}

// sing-box 格式的 ShadowTLS 用户
interface ShadowTLSUser {
  name?: string
  password: string
}

// sing-box 格式的 AnyTLS 用户
interface AnyTLSUser {
  name?: string
  password: string
}

// 本地 UI 使用的 Peer 类型
interface LocalPeer {
  publicKey: string
  privateKey?: string
  allowedIPs: string[]
}

interface InboundConfigProps {
  showCard?: boolean
}

export function InboundConfig({ showCard = true }: InboundConfigProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")
  const { config: storeConfig, setInbound, setEndpoint, clearEndpoints, currentInstance } = useSingboxConfigStore()
  const initialConfig = storeConfig.inbounds?.[0]
  const initialEndpoint = storeConfig.endpoints?.[0]
  const [protocol, setProtocol] = useState("wireguard")
  const [error, setError] = useState("")
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCodeContent, setQrCodeContent] = useState("")
  const [qrCodeType, setQrCodeType] = useState<"wireguard" | "shadowsocks" | "socks5" | "vless" | "hysteria2" | "vmess" | "trojan" | "tuic">("wireguard")
  const [selectedPeerIndex, setSelectedPeerIndex] = useState(0)
  const [serverIP, setServerIP] = useState("")
  const [certLoading, setCertLoading] = useState(false)
  const [certInfo, setCertInfo] = useState<{ common_name?: string; valid_to?: string } | null>(null)

  const isInitializedRef = useRef(false)

  // Mixed/Socks5 配置 (sing-box 格式)
  const [mixedConfig, setMixedConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 1080,
    auth: "none" as "none" | "password",
    username: "",
    password: "",
  })

  // VLESS 配置 (sing-box 格式)
  const [vlessConfig, setVlessConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ uuid: "", name: "", flow: "" }] as VLESSUser[],
    tls_enabled: false,
    tls_mode: "manual" as "manual" | "acme" | "reality",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    tls_server_name: "",
    reality_handshake_server: "",
    reality_handshake_port: 443,
    reality_private_key: "",
    reality_public_key: "",
    reality_short_id: "",
    transport_type: "tcp" as string, // "tcp" | "ws" | "grpc" | "http" | "httpupgrade"
    transport_path: "",
    transport_service_name: "",
  })

  // WireGuard 配置 (sing-box 格式)
  const [wgConfig, setWgConfig] = useState({
    listen_port: 5353,
    local_address: "10.10.0.1/32",
    private_key: "",
    peers: [{ publicKey: "", allowedIPs: ["10.10.0.2/32"] }] as LocalPeer[],
    mtu: 1420,
  })

  // HTTP 配置 (sing-box 格式)
  const [httpConfig, setHttpConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 8080,
    auth: "none" as "none" | "password",
    username: "",
    password: "",
    tls_enabled: false,
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
  })

  // Shadowsocks 配置 (sing-box 格式)
  const [ssConfig, setSsConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 8388,
    method: "2022-blake3-chacha20-poly1305",
    password: "",
  })

  // Hysteria2 配置 (sing-box 格式)
  const [hy2Config, setHy2Config] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    up_mbps: 100,
    down_mbps: 100,
    user_name: "",
    password: "",
    tls_alpn: ["h3"] as string[],
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
  })

  // VMess 配置 (sing-box 格式)
  const [vmessConfig, setVmessConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ uuid: "", name: "", alterId: 0 }] as VMESSUser[],
    tls_enabled: false,
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    tls_server_name: "",
    transport_type: "tcp" as string,
    transport_path: "",
    transport_service_name: "",
  })

  // Trojan 配置 (sing-box 格式)
  const [trojanConfig, setTrojanConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ name: "", password: "" }] as TrojanUser[],
    tls_enabled: true,
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    tls_server_name: "",
    transport_type: "tcp" as string,
    transport_path: "",
    transport_service_name: "",
  })

  // TUIC 配置 (sing-box 格式)
  const [tuicConfig, setTuicConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ uuid: "", name: "", password: "" }] as TUICUser[],
    congestion_control: "cubic" as string,
    zero_rtt_handshake: false,
    tls_alpn: ["h3"] as string[],
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
  })

  // Naive 配置 (sing-box 格式)
  const [naiveConfig, setNaiveConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ username: "", password: "" }] as NaiveUser[],
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
  })

  // ShadowTLS 配置 (sing-box 格式)
  const [shadowtlsConfig, setShadowtlsConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    version: 3,
    password: "", // v2 使用顶层 password
    users: [{ name: "", password: "" }] as ShadowTLSUser[], // v3 使用 users
    handshake_server: "www.google.com",
    handshake_server_port: 443,
    strict_mode: true,
  })

  // AnyTLS 配置 (sing-box 格式)
  const [anytlsConfig, setAnytlsConfig] = useState({
    listen: "0.0.0.0",
    listen_port: 443,
    users: [{ name: "", password: "" }] as AnyTLSUser[],
    tls_mode: "manual" as "manual" | "acme",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
  })

  // 从 initialConfig 初始化表单 - 纯 sing-box 格式
  useEffect(() => {
    if (isInitializedRef.current) return

    const configType = initialConfig?.type
    if (!initialConfig || !configType) {
      isInitializedRef.current = true
      return
    }

    // 设置协议类型
    const protocolMap: Record<string, string> = {
      mixed: "socks5",
      socks: "socks5",
      vless: "vless",
      wireguard: "wireguard",
      http: "http",
      shadowsocks: "shadowsocks",
      hysteria2: "hysteria2",
      vmess: "vmess",
      trojan: "trojan",
      tuic: "tuic",
      naive: "naive",
      shadowtls: "shadowtls",
      anytls: "anytls",
    }
    setProtocol(protocolMap[configType] || configType)

    // 转换监听地址
    const parseListen = (listen?: string) => {
      if (listen === "::" || !listen) return "0.0.0.0"
      return listen
    }

    switch (configType) {
      case "mixed":
      case "socks":
        setMixedConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 1080,
          auth: (initialConfig.users?.length ?? 0) > 0 ? "password" : "none",
          username: (initialConfig.users?.[0] as any)?.username || "",
          password: (initialConfig.users?.[0] as any)?.password || "",
        })
        break

      case "vless":
        const vlessUsers = (initialConfig.users || []).map((u: any) => ({
          uuid: u.uuid || "",
          name: u.name || "",
          flow: u.flow || "",
        }))
        setVlessConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          users: vlessUsers.length > 0 ? vlessUsers : [{ uuid: "", name: "", flow: "" }],
          tls_enabled: initialConfig.tls?.enabled || false,
          tls_mode: initialConfig.tls?.reality?.enabled ? "reality" : (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
          tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
          tls_server_name: initialConfig.tls?.server_name || "",
          reality_handshake_server: initialConfig.tls?.reality?.handshake?.server || "",
          reality_handshake_port: initialConfig.tls?.reality?.handshake?.server_port || 443,
          reality_private_key: initialConfig.tls?.reality?.private_key || "",
          reality_public_key: "",
          reality_short_id: initialConfig.tls?.reality?.short_id?.[0] || "",
          transport_type: initialConfig.transport?.type || "tcp",
          transport_path: initialConfig.transport?.path || "",
          transport_service_name: initialConfig.transport?.service_name || "",
        })
        break

      case "wireguard":
        // WireGuard 在 sing-box 1.11.0+ 中是 endpoint，从 endpoints 加载
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
        break

      case "http":
        setHttpConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 8080,
          auth: (initialConfig.users?.length ?? 0) > 0 ? "password" : "none",
          username: (initialConfig.users?.[0] as any)?.username || "",
          password: (initialConfig.users?.[0] as any)?.password || "",
          tls_enabled: initialConfig.tls?.enabled || false,
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
        })
        break

      case "shadowsocks":
        setSsConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 8388,
          method: initialConfig.method || "2022-blake3-chacha20-poly1305",
          password: initialConfig.password || "",
        })
        break

      case "hysteria2":
        setHy2Config({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          up_mbps: initialConfig.up_mbps || 100,
          down_mbps: initialConfig.down_mbps || 100,
          user_name: (initialConfig.users?.[0] as any)?.name || "",
          password: (initialConfig.users?.[0] as any)?.password || "",
          tls_alpn: initialConfig.tls?.alpn || ["h3"],
          tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
          tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
        })
        break

      case "vmess":
        const vmessUsers = (initialConfig.users || []).map((u: any) => ({
          uuid: u.uuid || "",
          name: u.name || "",
          alterId: u.alterId || 0,
        }))
        setVmessConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          users: vmessUsers.length > 0 ? vmessUsers : [{ uuid: "", name: "", alterId: 0 }],
          tls_enabled: initialConfig.tls?.enabled || false,
          tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
          tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
          tls_server_name: initialConfig.tls?.server_name || "",
          transport_type: initialConfig.transport?.type || "tcp",
          transport_path: initialConfig.transport?.path || "",
          transport_service_name: initialConfig.transport?.service_name || "",
        })
        break

      case "trojan":
        const trojanUsers = (initialConfig.users || []).map((u: any) => ({
          name: u.name || "",
          password: u.password || "",
        }))
        setTrojanConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          users: trojanUsers.length > 0 ? trojanUsers : [{ name: "", password: "" }],
          tls_enabled: initialConfig.tls?.enabled !== false,
          tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
          tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
          tls_server_name: initialConfig.tls?.server_name || "",
          transport_type: initialConfig.transport?.type || "tcp",
          transport_path: initialConfig.transport?.path || "",
          transport_service_name: initialConfig.transport?.service_name || "",
        })
        break

      case "tuic":
        const tuicUsers = (initialConfig.users || []).map((u: any) => ({
          uuid: u.uuid || "",
          name: u.name || "",
          password: u.password || "",
        }))
        setTuicConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          users: tuicUsers.length > 0 ? tuicUsers : [{ uuid: "", name: "", password: "" }],
          congestion_control: initialConfig.congestion_control || "cubic",
          zero_rtt_handshake: initialConfig.zero_rtt_handshake || false,
          tls_alpn: initialConfig.tls?.alpn || ["h3"],
          tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
          tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
        })
        break

      case "naive":
        const naiveUsers = (initialConfig.users || []).map((u: any) => ({
          username: u.username || "",
          password: u.password || "",
        }))
        setNaiveConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          users: naiveUsers.length > 0 ? naiveUsers : [{ username: "", password: "" }],
          tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
          tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
        })
        break

      case "shadowtls":
        const shadowtlsUsers = (initialConfig.users || []).map((u: any) => ({
          name: u.name || "",
          password: u.password || "",
        }))
        setShadowtlsConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          version: initialConfig.version || 3,
          password: initialConfig.password || "", // v2 顶层密码
          users: shadowtlsUsers.length > 0 ? shadowtlsUsers : [{ name: "", password: "" }],
          handshake_server: initialConfig.handshake?.server || "www.google.com",
          handshake_server_port: initialConfig.handshake?.server_port || 443,
          strict_mode: initialConfig.strict_mode !== false,
        })
        break

      case "anytls":
        const anytlsUsers = (initialConfig.users || []).map((u: any) => ({
          name: u.name || "",
          password: u.password || "",
        }))
        setAnytlsConfig({
          listen: parseListen(initialConfig.listen),
          listen_port: initialConfig.listen_port || 443,
          users: anytlsUsers.length > 0 ? anytlsUsers : [{ name: "", password: "" }],
          tls_mode: (initialConfig.tls?.acme?.domain?.length ?? 0) > 0 ? "acme" : "manual",
          tls_acme_domain: initialConfig.tls?.acme?.domain?.[0] || "",
          tls_certificate_path: initialConfig.tls?.certificate_path || "/etc/sing-box/cert.pem",
          tls_key_path: initialConfig.tls?.key_path || "/etc/sing-box/key.pem",
        })
        break
    }

    isInitializedRef.current = true
  }, [initialConfig])

  // 实时生成预览配置（初始化完成后才同步）- sing-box 格式
  useEffect(() => {
    if (!isInitializedRef.current) return

    let previewConfig: any = {}

    // 转换监听地址为 sing-box 格式
    const formatListen = (listen: string) => {
      if (listen === "0.0.0.0" || listen === "") return "::"
      return listen
    }

    switch (protocol) {
      case "socks5":
        // sing-box 使用 mixed 类型代替 socks
        previewConfig = {
          type: "mixed",
          tag: "mixed-in",
          listen: formatListen(mixedConfig.listen),
          listen_port: mixedConfig.listen_port,
        }
        if (mixedConfig.auth === "password" && mixedConfig.username && mixedConfig.password) {
          previewConfig.users = [
            {
              username: mixedConfig.username,
              password: mixedConfig.password,
            },
          ]
        }
        break

      case "vless":
        const vlessUsers = vlessConfig.users
          .filter((u) => u.uuid)
          .map((u) => {
            const user: any = { uuid: u.uuid }
            if (u.name) user.name = u.name
            if (u.flow) user.flow = u.flow
            return user
          })

        previewConfig = {
          type: "vless",
          tag: "vless-in",
          listen: formatListen(vlessConfig.listen),
          listen_port: vlessConfig.listen_port,
          users: vlessUsers,
        }
        // 添加 TLS 配置
        if (vlessConfig.tls_enabled) {
          if (vlessConfig.tls_mode === "reality") {
            previewConfig.tls = {
              enabled: true,
              server_name: vlessConfig.tls_server_name || vlessConfig.reality_handshake_server,
              reality: {
                enabled: true,
                handshake: {
                  server: vlessConfig.reality_handshake_server,
                  server_port: vlessConfig.reality_handshake_port,
                },
                private_key: vlessConfig.reality_private_key,
                short_id: vlessConfig.reality_short_id ? [vlessConfig.reality_short_id] : [""],
                max_time_difference: "1m",
              },
            }
          } else if (vlessConfig.tls_mode === "acme" && vlessConfig.tls_acme_domain) {
            previewConfig.tls = {
              enabled: true,
              acme: {
                domain: [vlessConfig.tls_acme_domain],
                data_directory: "/var/lib/sing-box/acme",
              },
            }
          } else {
            previewConfig.tls = {
              enabled: true,
              certificate_path: vlessConfig.tls_certificate_path,
              key_path: vlessConfig.tls_key_path,
            }
          }
          if (vlessConfig.tls_server_name && vlessConfig.tls_mode !== "reality") {
            previewConfig.tls.server_name = vlessConfig.tls_server_name
          }
        }
        // 添加 Transport 配置
        if (vlessConfig.transport_type && vlessConfig.transport_type !== "tcp") {
          previewConfig.transport = {
            type: vlessConfig.transport_type,
          }
          if (vlessConfig.transport_path) {
            previewConfig.transport.path = vlessConfig.transport_path
          }
          if (vlessConfig.transport_type === "grpc" && vlessConfig.transport_service_name) {
            previewConfig.transport.service_name = vlessConfig.transport_service_name
          }
        }
        break

      case "wireguard":
        // WireGuard 在 sing-box 1.11.0+ 中是 endpoint，不是 inbound
        const wgPeers = wgConfig.peers
          .filter((p) => p.publicKey)
          .map((p) => ({
            public_key: p.publicKey,
            allowed_ips: p.allowedIPs,
          }))

        // 设置 endpoint 而不是 inbound
        setEndpoint(0, {
          type: "wireguard",
          tag: "wireguard-ep",
          listen_port: wgConfig.listen_port,
          private_key: wgConfig.private_key,
          address: [wgConfig.local_address],
          peers: wgPeers,
          mtu: wgConfig.mtu,
        })
        // 不设置 inbound，直接返回
        return

      case "http":
        previewConfig = {
          type: "http",
          tag: "http-in",
          listen: formatListen(httpConfig.listen),
          listen_port: httpConfig.listen_port,
        }
        // 添加用户认证
        if (httpConfig.auth === "password" && httpConfig.username && httpConfig.password) {
          previewConfig.users = [
            {
              username: httpConfig.username,
              password: httpConfig.password,
            },
          ]
        }
        // 添加 TLS 配置
        if (httpConfig.tls_enabled) {
          previewConfig.tls = {
            enabled: true,
            certificate_path: httpConfig.tls_certificate_path,
            key_path: httpConfig.tls_key_path,
          }
        }
        break

      case "shadowsocks":
        previewConfig = {
          type: "shadowsocks",
          tag: "ss-in",
          listen: formatListen(ssConfig.listen),
          listen_port: ssConfig.listen_port,
          method: ssConfig.method,
          password: ssConfig.password,
        }
        break

      case "hysteria2":
        const hy2User: any = { password: hy2Config.password }
        if (hy2Config.user_name) {
          hy2User.name = hy2Config.user_name
        }
        previewConfig = {
          type: "hysteria2",
          tag: "hy2-in",
          listen: formatListen(hy2Config.listen),
          listen_port: hy2Config.listen_port,
          up_mbps: hy2Config.up_mbps,
          down_mbps: hy2Config.down_mbps,
          users: [hy2User],
          tls: hy2Config.tls_mode === "acme" && hy2Config.tls_acme_domain ? {
            enabled: true,
            alpn: hy2Config.tls_alpn,
            acme: {
              domain: [hy2Config.tls_acme_domain],
              data_directory: "/var/lib/sing-box/acme",
            },
          } : {
            enabled: true,
            alpn: hy2Config.tls_alpn,
            certificate_path: hy2Config.tls_certificate_path,
            key_path: hy2Config.tls_key_path,
          },
        }
        break

      case "vmess":
        const vmessUsers = vmessConfig.users
          .filter((u) => u.uuid)
          .map((u) => {
            const user: any = { uuid: u.uuid }
            if (u.name) user.name = u.name
            if (u.alterId !== undefined) user.alterId = u.alterId
            return user
          })

        previewConfig = {
          type: "vmess",
          tag: "vmess-in",
          listen: formatListen(vmessConfig.listen),
          listen_port: vmessConfig.listen_port,
          users: vmessUsers,
        }
        if (vmessConfig.tls_enabled) {
          if (vmessConfig.tls_mode === "acme" && vmessConfig.tls_acme_domain) {
            previewConfig.tls = {
              enabled: true,
              acme: {
                domain: [vmessConfig.tls_acme_domain],
                data_directory: "/var/lib/sing-box/acme",
              },
            }
          } else {
            previewConfig.tls = {
              enabled: true,
              certificate_path: vmessConfig.tls_certificate_path,
              key_path: vmessConfig.tls_key_path,
            }
          }
          if (vmessConfig.tls_server_name) {
            previewConfig.tls.server_name = vmessConfig.tls_server_name
          }
        }
        if (vmessConfig.transport_type && vmessConfig.transport_type !== "tcp") {
          previewConfig.transport = { type: vmessConfig.transport_type }
          if (vmessConfig.transport_type === "ws" && vmessConfig.transport_path) {
            previewConfig.transport.path = vmessConfig.transport_path
          }
          if (vmessConfig.transport_type === "grpc" && vmessConfig.transport_service_name) {
            previewConfig.transport.service_name = vmessConfig.transport_service_name
          }
          if (vmessConfig.transport_type === "http" && vmessConfig.transport_path) {
            previewConfig.transport.path = vmessConfig.transport_path
          }
        }
        break

      case "trojan":
        const trojanUsersPreview = trojanConfig.users
          .filter((u) => u.password)
          .map((u) => {
            const user: any = { password: u.password }
            if (u.name) user.name = u.name
            return user
          })

        previewConfig = {
          type: "trojan",
          tag: "trojan-in",
          listen: formatListen(trojanConfig.listen),
          listen_port: trojanConfig.listen_port,
          users: trojanUsersPreview,
        }
        if (trojanConfig.tls_enabled) {
          if (trojanConfig.tls_mode === "acme" && trojanConfig.tls_acme_domain) {
            previewConfig.tls = {
              enabled: true,
              acme: {
                domain: [trojanConfig.tls_acme_domain],
                data_directory: "/var/lib/sing-box/acme",
              },
            }
          } else {
            previewConfig.tls = {
              enabled: true,
              certificate_path: trojanConfig.tls_certificate_path,
              key_path: trojanConfig.tls_key_path,
            }
          }
          if (trojanConfig.tls_server_name) {
            previewConfig.tls.server_name = trojanConfig.tls_server_name
          }
        }
        if (trojanConfig.transport_type && trojanConfig.transport_type !== "tcp") {
          previewConfig.transport = { type: trojanConfig.transport_type }
          if (trojanConfig.transport_type === "ws" && trojanConfig.transport_path) {
            previewConfig.transport.path = trojanConfig.transport_path
          }
          if (trojanConfig.transport_type === "grpc" && trojanConfig.transport_service_name) {
            previewConfig.transport.service_name = trojanConfig.transport_service_name
          }
        }
        break

      case "tuic":
        const tuicUsersPreview = tuicConfig.users
          .filter((u) => u.uuid)
          .map((u) => {
            const user: any = { uuid: u.uuid }
            if (u.name) user.name = u.name
            if (u.password) user.password = u.password
            return user
          })

        previewConfig = {
          type: "tuic",
          tag: "tuic-in",
          listen: formatListen(tuicConfig.listen),
          listen_port: tuicConfig.listen_port,
          users: tuicUsersPreview,
          congestion_control: tuicConfig.congestion_control,
          zero_rtt_handshake: tuicConfig.zero_rtt_handshake,
          tls: tuicConfig.tls_mode === "acme" && tuicConfig.tls_acme_domain ? {
            enabled: true,
            alpn: tuicConfig.tls_alpn,
            acme: {
              domain: [tuicConfig.tls_acme_domain],
              data_directory: "/var/lib/sing-box/acme",
            },
          } : {
            enabled: true,
            alpn: tuicConfig.tls_alpn,
            certificate_path: tuicConfig.tls_certificate_path,
            key_path: tuicConfig.tls_key_path,
          },
        }
        break

      case "naive":
        const naiveUsersPreview = naiveConfig.users
          .filter((u) => u.username && u.password)
          .map((u) => ({
            username: u.username,
            password: u.password,
          }))

        previewConfig = {
          type: "naive",
          tag: "naive-in",
          listen: formatListen(naiveConfig.listen),
          listen_port: naiveConfig.listen_port,
          users: naiveUsersPreview,
          tls: naiveConfig.tls_mode === "acme" && naiveConfig.tls_acme_domain ? {
            enabled: true,
            acme: {
              domain: [naiveConfig.tls_acme_domain],
              data_directory: "/var/lib/sing-box/acme",
            },
          } : {
            enabled: true,
            certificate_path: naiveConfig.tls_certificate_path,
            key_path: naiveConfig.tls_key_path,
          },
        }
        break

      case "shadowtls":
        previewConfig = {
          type: "shadowtls",
          tag: "shadowtls-in",
          listen: formatListen(shadowtlsConfig.listen),
          listen_port: shadowtlsConfig.listen_port,
          version: shadowtlsConfig.version,
          handshake: {
            server: shadowtlsConfig.handshake_server,
            server_port: shadowtlsConfig.handshake_server_port,
          },
        }
        // v2: 使用顶层 password
        if (shadowtlsConfig.version === 2 && shadowtlsConfig.password) {
          previewConfig.password = shadowtlsConfig.password
        }
        // v3: 使用 users 数组和 strict_mode
        if (shadowtlsConfig.version >= 3) {
          const shadowtlsUsersPreview = shadowtlsConfig.users
            .filter((u) => u.password)
            .map((u) => {
              const user: any = { password: u.password }
              if (u.name) user.name = u.name
              return user
            })
          previewConfig.users = shadowtlsUsersPreview
          previewConfig.strict_mode = shadowtlsConfig.strict_mode
        }
        break

      case "anytls":
        const anytlsUsersPreview = anytlsConfig.users
          .filter((u) => u.password)
          .map((u) => {
            const user: any = { password: u.password }
            if (u.name) user.name = u.name
            return user
          })

        previewConfig = {
          type: "anytls",
          tag: "anytls-in",
          listen: formatListen(anytlsConfig.listen),
          listen_port: anytlsConfig.listen_port,
          users: anytlsUsersPreview,
          tls: anytlsConfig.tls_mode === "acme" && anytlsConfig.tls_acme_domain ? {
            enabled: true,
            acme: {
              domain: [anytlsConfig.tls_acme_domain],
              data_directory: "/var/lib/sing-box/acme",
            },
          } : {
            enabled: true,
            certificate_path: anytlsConfig.tls_certificate_path,
            key_path: anytlsConfig.tls_key_path,
          },
        }
        break
    }

    // 非 WireGuard 协议时清除 endpoints
    clearEndpoints()
    setInbound(0, previewConfig)
  }, [protocol, mixedConfig, vlessConfig, wgConfig, httpConfig, ssConfig, hy2Config, vmessConfig, trojanConfig, tuicConfig, naiveConfig, shadowtlsConfig, anytlsConfig, setInbound, setEndpoint, clearEndpoints])

  const generateWireGuardKeys = async () => {
    setError("")
    try {
      const response = await fetch("/api/wireguard/keygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: "10.10.0.1" })
      })

      if (!response.ok) {
        const errorMsg = await parseErrorResponse(response)
        throw new Error(errorMsg)
      }

      const data = await response.json()
      setWgConfig({ ...wgConfig, private_key: data.privateKey })
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateKeysFailed"))
    }
  }

  const findNextAvailableIP = () => {
    const usedIPs = wgConfig.peers
      .map(peer => {
        const allowedIP = peer.allowedIPs[0] || ""
        const match = allowedIP.match(/10\.10\.0\.(\d+)/)
        return match ? parseInt(match[1], 10) : 0
      })
      .filter(ip => ip > 0)

    const maxIP = usedIPs.length > 0 ? Math.max(...usedIPs) : 1
    return `10.10.0.${maxIP + 1}`
  }

  const generateMixedCredentials = () => {
    setMixedConfig({
      ...mixedConfig,
      username: generateSecureRandomString(8),
      password: generateSecureRandomString(16),
    })
  }

  const showMixedQrCode = async () => {
    setError("")
    try {
      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      let url: string
      if (mixedConfig.auth === "password" && mixedConfig.username && mixedConfig.password) {
        url = `socks5://${mixedConfig.username}:${mixedConfig.password}@${ip}:${mixedConfig.listen_port}#Mixed`
      } else {
        url = `socks5://${ip}:${mixedConfig.listen_port}#Mixed`
      }

      setQrCodeContent(url)
      setQrCodeType("socks5")
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const showVlessQrCode = async (userIndex: number) => {
    setError("")
    try {
      const user = vlessConfig.users[userIndex]
      if (!user || !user.uuid) {
        throw new Error(t("setUuidFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      const params = new URLSearchParams()
      params.set("encryption", "none")
      params.set("type", vlessConfig.transport_type === "tcp" ? "tcp" : vlessConfig.transport_type)
      if (user.flow && vlessConfig.transport_type === "tcp") params.set("flow", user.flow)
      if (vlessConfig.transport_type === "ws" && vlessConfig.transport_path) params.set("path", vlessConfig.transport_path)
      if (vlessConfig.transport_type === "grpc" && vlessConfig.transport_service_name) params.set("serviceName", vlessConfig.transport_service_name)
      if (vlessConfig.transport_type === "http" && vlessConfig.transport_path) params.set("path", vlessConfig.transport_path)
      if (vlessConfig.transport_type === "httpupgrade" && vlessConfig.transport_path) params.set("path", vlessConfig.transport_path)

      if (vlessConfig.tls_enabled) {
        if (vlessConfig.tls_mode === "reality") {
          params.set("security", "reality")
          if (vlessConfig.tls_server_name) params.set("sni", vlessConfig.tls_server_name)
          if (vlessConfig.reality_short_id) params.set("sid", vlessConfig.reality_short_id)
          if (vlessConfig.reality_public_key) params.set("pbk", vlessConfig.reality_public_key)
          params.set("fp", "chrome")
        } else {
          params.set("security", "tls")
          if (vlessConfig.tls_server_name) params.set("sni", vlessConfig.tls_server_name)
        }
      }

      const name = user.name || `VLESS-${userIndex + 1}`
      const vlessUrl = `vless://${user.uuid}@${ip}:${vlessConfig.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

      setQrCodeContent(vlessUrl)
      setQrCodeType("vless")
      setSelectedPeerIndex(userIndex)
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const showShadowsocksQrCode = async () => {
    setError("")
    try {
      if (!ssConfig.password) {
        throw new Error(t("setPasswordKeyFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      const userInfo = `${ssConfig.method}:${ssConfig.password}`
      const base64UserInfo = btoa(userInfo)
      const ssUrl = `ss://${base64UserInfo}@${ip}:${ssConfig.listen_port}#Shadowsocks`

      setQrCodeContent(ssUrl)
      setQrCodeType("shadowsocks")
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const showHysteria2QrCode = async () => {
    setError("")
    try {
      if (!hy2Config.password) {
        throw new Error(t("setPasswordFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      // Hysteria2 URL format: hysteria2://password@host:port/?insecure=1#name
      const params = new URLSearchParams()
      params.set("insecure", "1") // 自签名证书需要
      if (hy2Config.up_mbps) params.set("upmbps", String(hy2Config.up_mbps))
      if (hy2Config.down_mbps) params.set("downmbps", String(hy2Config.down_mbps))

      const name = hy2Config.user_name || "Hysteria2"
      const hy2Url = `hysteria2://${hy2Config.password}@${ip}:${hy2Config.listen_port}/?${params.toString()}#${encodeURIComponent(name)}`

      setQrCodeContent(hy2Url)
      setQrCodeType("hysteria2")
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const showVmessQrCode = async (userIndex: number) => {
    setError("")
    try {
      const user = vmessConfig.users[userIndex]
      if (!user || !user.uuid) {
        throw new Error(t("setUuidFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      // VMess URL format (v2rayN standard)
      const vmessObj = {
        v: "2",
        ps: user.name || `VMess-${userIndex + 1}`,
        add: ip,
        port: String(vmessConfig.listen_port),
        id: user.uuid,
        aid: String(user.alterId || 0),
        scy: "auto",
        net: vmessConfig.transport_type === "tcp" ? "tcp" : vmessConfig.transport_type,
        type: "none",
        host: "",
        path: vmessConfig.transport_path || "",
        tls: vmessConfig.tls_enabled ? "tls" : "",
        sni: vmessConfig.tls_server_name || "",
      }

      if (vmessConfig.transport_type === "grpc") {
        vmessObj.path = vmessConfig.transport_service_name || ""
      }

      const vmessUrl = `vmess://${btoa(JSON.stringify(vmessObj))}`

      setQrCodeContent(vmessUrl)
      setQrCodeType("vmess")
      setSelectedPeerIndex(userIndex)
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const showTrojanQrCode = async (userIndex: number) => {
    setError("")
    try {
      const user = trojanConfig.users[userIndex]
      if (!user || !user.password) {
        throw new Error(t("setUserPasswordFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      // Trojan URL format: trojan://password@host:port?params#name
      const params = new URLSearchParams()
      if (trojanConfig.tls_server_name) params.set("sni", trojanConfig.tls_server_name)
      params.set("allowInsecure", "1")

      if (trojanConfig.transport_type !== "tcp") {
        params.set("type", trojanConfig.transport_type)
        if (trojanConfig.transport_path) params.set("path", trojanConfig.transport_path)
        if (trojanConfig.transport_type === "grpc" && trojanConfig.transport_service_name) {
          params.set("serviceName", trojanConfig.transport_service_name)
        }
      }

      const name = user.name || `Trojan-${userIndex + 1}`
      const trojanUrl = `trojan://${encodeURIComponent(user.password)}@${ip}:${trojanConfig.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

      setQrCodeContent(trojanUrl)
      setQrCodeType("trojan")
      setSelectedPeerIndex(userIndex)
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const showTuicQrCode = async (userIndex: number) => {
    setError("")
    try {
      const user = tuicConfig.users[userIndex]
      if (!user || !user.uuid) {
        throw new Error(t("setUuidFirst"))
      }

      let ip = serverIP
      if (!ip) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          ip = data.ip
          setServerIP(ip)
        } else {
          throw new Error(t("cannotGetPublicIp"))
        }
      }

      // TUIC URL format: tuic://uuid:password@host:port?params#name
      const params = new URLSearchParams()
      params.set("congestion_control", tuicConfig.congestion_control)
      params.set("udp_relay_mode", "native")
      params.set("alpn", "h3")
      params.set("allow_insecure", "1")

      const name = user.name || `TUIC-${userIndex + 1}`
      const password = user.password || ""
      const tuicUrl = `tuic://${user.uuid}:${encodeURIComponent(password)}@${ip}:${tuicConfig.listen_port}?${params.toString()}#${encodeURIComponent(name)}`

      setQrCodeContent(tuicUrl)
      setQrCodeType("tuic")
      setSelectedPeerIndex(userIndex)
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const generatePeerKeys = async (peerIndex: number) => {
    setError("")
    try {
      const currentPeer = wgConfig.peers[peerIndex]
      let peerIP: string

      if (currentPeer.allowedIPs && currentPeer.allowedIPs.length > 0) {
        peerIP = currentPeer.allowedIPs[0].split('/')[0]
      } else {
        peerIP = findNextAvailableIP()
      }

      const response = await fetch("/api/wireguard/keygen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: peerIP })
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
      setError(err instanceof Error ? err.message : t("generateKeysFailed"))
    }
  }

  const downloadPeerConfig = async (peerIndex: number) => {
    const peer = wgConfig.peers[peerIndex]
    if (!peer.privateKey || !wgConfig.private_key) {
      setError(t("generateKeysFirst"))
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
      const clientIP = (peer.allowedIPs[0] || "10.10.0.2/32").split('/')[0]
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
      setError(err instanceof Error ? err.message : t("downloadConfigFailed"))
    }
  }

  const showPeerQrCode = async (peerIndex: number) => {
    const peer = wgConfig.peers[peerIndex]
    if (!peer.privateKey || !wgConfig.private_key) {
      setError(t("generateKeysFirst"))
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
      const clientIP = (peer.allowedIPs[0] || "10.10.0.2/32").split('/')[0]
      const configContent = `[Interface]
PrivateKey = ${peer.privateKey}
Address = ${clientIP}/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = ${serverPubKeyData.publicKey}
Endpoint = ${publicIPData.ip}:${wgConfig.listen_port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`

      setQrCodeContent(configContent)
      setQrCodeType("wireguard")
      setSelectedPeerIndex(peerIndex)
      setShowQrCode(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  const generateSelfSignedCert = async (domain?: string) => {
    // 使用全局 store 中的 currentInstance
    if (!currentInstance) {
      setError(t("selectInstanceFirst"))
      return
    }

    setCertLoading(true)
    setError("")
    try {
      // 如果没有提供域名，尝试获取服务器IP
      let certDomain = domain
      if (!certDomain) {
        const response = await fetch("/api/wireguard/public-ip")
        if (response.ok) {
          const data = await response.json()
          certDomain = data.ip
        } else {
          certDomain = "localhost"
        }
      }

      const result = await apiClient.generateSelfSignedCert(currentInstance, certDomain || "localhost", 365)
      setCertInfo({
        common_name: result.common_name,
        valid_to: result.valid_to,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t("generateCertFailed"))
    } finally {
      setCertLoading(false)
    }
  }

  // 上传证书文件
  const handleUploadCertificate = async (certFile: File, keyFile: File) => {
    if (!currentInstance) {
      setError(t("selectInstanceFirst"))
      return
    }

    setCertLoading(true)
    setError("")
    try {
      const result = await apiClient.uploadCertificate(currentInstance, certFile, keyFile)
      setCertInfo({
        common_name: result.common_name,
        valid_to: result.valid_to,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : t("uploadCertFailed"))
    } finally {
      setCertLoading(false)
    }
  }

  // 证书文件选择器引用
  const certFileRef = useRef<HTMLInputElement>(null)
  const keyFileRef = useRef<HTMLInputElement>(null)
  const [pendingCertFile, setPendingCertFile] = useState<File | null>(null)

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingCertFile(file)
      // 触发私钥文件选择
      keyFileRef.current?.click()
    }
  }

  const handleKeyFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && pendingCertFile) {
      handleUploadCertificate(pendingCertFile, file)
      setPendingCertFile(null)
      // 清除文件输入
      if (certFileRef.current) certFileRef.current.value = ""
      if (keyFileRef.current) keyFileRef.current.value = ""
    }
  }

  const content = (
    <div className="space-y-4">
      <Tabs value={protocol} onValueChange={setProtocol} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="wireguard">WireGuard</TabsTrigger>
          <TabsTrigger value="socks5">Mixed</TabsTrigger>
          <TabsTrigger value="vless">VLESS</TabsTrigger>
          <TabsTrigger value="vmess">VMess</TabsTrigger>
          <TabsTrigger value="trojan">Trojan</TabsTrigger>
          <TabsTrigger value="shadowsocks">Shadowsocks</TabsTrigger>
        </TabsList>
        <TabsList className="grid w-full grid-cols-6 mt-1">
          <TabsTrigger value="hysteria2">Hysteria2</TabsTrigger>
          <TabsTrigger value="tuic">TUIC</TabsTrigger>
          <TabsTrigger value="naive">Naive</TabsTrigger>
          <TabsTrigger value="shadowtls">ShadowTLS</TabsTrigger>
          <TabsTrigger value="anytls">AnyTLS</TabsTrigger>
          <TabsTrigger value="http">HTTP</TabsTrigger>
        </TabsList>

        {/* Mixed/Socks5 配置 */}
        <TabsContent value="socks5" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={mixedConfig.listen}
                onChange={(e) => setMixedConfig({ ...mixedConfig, listen: e.target.value })}
                className={!isValidListenAddress(mixedConfig.listen) ? "border-red-500" : ""}
              />
              {!isValidListenAddress(mixedConfig.listen) && (
                <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={mixedConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, mixedConfig.listen_port)
                  setMixedConfig({ ...mixedConfig, listen_port: port })
                }}
                className={!isValidPort(mixedConfig.listen_port) ? "border-red-500" : ""}
              />
              {!isValidPort(mixedConfig.listen_port) && (
                <p className="text-xs text-red-500">{t("portRange")}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("authMode")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={mixedConfig.auth}
              onChange={(e) => setMixedConfig({ ...mixedConfig, auth: e.target.value as "none" | "password" })}
            >
              <option value="none">{t("noAuth")}</option>
              <option value="password">{t("passwordAuth")}</option>
            </select>
          </div>
          {mixedConfig.auth === "password" && (
            <>
              <div className="space-y-2">
                <Label>{tc("username")}</Label>
                <Input
                  value={mixedConfig.username}
                  onChange={(e) => setMixedConfig({ ...mixedConfig, username: e.target.value })}
                  placeholder={t("enterUsername")}
                />
              </div>
              <div className="space-y-2">
                <Label>{tc("password")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={mixedConfig.password}
                    onChange={(e) => setMixedConfig({ ...mixedConfig, password: e.target.value })}
                    placeholder={t("enterPassword")}
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" onClick={generateMixedCredentials}>
                    <Key className="h-4 w-4 mr-1" />
                    {tc("generate")}
                  </Button>
                </div>
              </div>
            </>
          )}
          <div className="pt-2">
            <Button type="button" variant="outline" onClick={showMixedQrCode}>
              <QrCode className="h-4 w-4 mr-1" />
              {t("generateQrCode")}
            </Button>
          </div>
        </TabsContent>

        {/* VLESS 配置 */}
        <TabsContent value="vless" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={vlessConfig.listen}
                onChange={(e) => setVlessConfig({ ...vlessConfig, listen: e.target.value })}
                className={!isValidListenAddress(vlessConfig.listen) ? "border-red-500" : ""}
              />
              {!isValidListenAddress(vlessConfig.listen) && (
                <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={vlessConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, vlessConfig.listen_port)
                  setVlessConfig({ ...vlessConfig, listen_port: port })
                }}
                className={!isValidPort(vlessConfig.listen_port) ? "border-red-500" : ""}
              />
              {!isValidPort(vlessConfig.listen_port) && (
                <p className="text-xs text-red-500">{t("portRange")}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("users")}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setVlessConfig({
                    ...vlessConfig,
                    users: [...vlessConfig.users, { uuid: "", name: "", flow: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {tc("add")}
              </Button>
            </div>

            {vlessConfig.users.map((user, index) => (
              <Card key={index} className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => showVlessQrCode(index)}
                        disabled={!user.uuid}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      {vlessConfig.users.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setVlessConfig({
                              ...vlessConfig,
                              users: vlessConfig.users.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="UUID"
                      value={user.uuid}
                      onChange={(e) => {
                        const newUsers = [...vlessConfig.users]
                        newUsers[index].uuid = e.target.value
                        setVlessConfig({ ...vlessConfig, users: newUsers })
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newUsers = [...vlessConfig.users]
                        newUsers[index].uuid = crypto.randomUUID()
                        setVlessConfig({ ...vlessConfig, users: newUsers })
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder={t("nameOptional")}
                    value={user.name || ""}
                    onChange={(e) => {
                      const newUsers = [...vlessConfig.users]
                      newUsers[index].name = e.target.value
                      setVlessConfig({ ...vlessConfig, users: newUsers })
                    }}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs">{t("flowControl")}</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                      value={user.flow || ""}
                      onChange={(e) => {
                        const newUsers = [...vlessConfig.users]
                        newUsers[index].flow = e.target.value
                        setVlessConfig({ ...vlessConfig, users: newUsers })
                        // 如果选择了 xtls-rprx-vision，自动启用 TLS
                        if (e.target.value === "xtls-rprx-vision" && !vlessConfig.tls_enabled) {
                          setVlessConfig({ ...vlessConfig, users: newUsers, tls_enabled: true })
                        }
                      }}
                    >
                      <option value="">{t("noneDefault")}</option>
                      <option value="xtls-rprx-vision" disabled={vlessConfig.transport_type !== "tcp"}>{t("xtlsRecommended")}</option>
                    </select>
                    {user.flow === "xtls-rprx-vision" && !vlessConfig.tls_enabled && (
                      <p className="text-xs text-amber-600">{t("xtlsRequiresTls")}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* TLS 配置 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vless-tls-enabled"
                checked={vlessConfig.tls_enabled}
                onChange={(e) => setVlessConfig({ ...vlessConfig, tls_enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="vless-tls-enabled">{t("enableTls")}</Label>
            </div>
            {vlessConfig.tls_enabled && (
              <div className="space-y-2 pl-6">
                <div className="flex gap-2 items-center">
                  <select
                    value={vlessConfig.tls_mode}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, tls_mode: e.target.value as "manual" | "acme" | "reality" })}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="manual">{t("manualConfig")}</option>
                    <option value="acme">{t("acmeAuto")}</option>
                    <option value="reality">Reality</option>
                  </select>
                  {vlessConfig.tls_mode === "manual" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generateSelfSignedCert(vlessConfig.tls_server_name || undefined)}
                        disabled={certLoading}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        {certLoading ? t("generating") : t("generateSelfSignedCert")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => certFileRef.current?.click()}
                        disabled={certLoading}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        {t("uploadCert")}
                      </Button>
                    </>
                  )}
                  {certInfo && vlessConfig.tls_mode === "manual" && (
                    <span className="text-xs text-muted-foreground self-center">
                      {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                    </span>
                  )}
                </div>
                {vlessConfig.tls_mode === "reality" ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{t("realityHandshakeServer")}</Label>
                        <Input
                          value={vlessConfig.reality_handshake_server}
                          onChange={(e) => {
                            const server = e.target.value
                            const updates: any = { reality_handshake_server: server }
                            // 自动同步 server_name（如果用户没有手动修改过）
                            if (!vlessConfig.tls_server_name || vlessConfig.tls_server_name === vlessConfig.reality_handshake_server) {
                              updates.tls_server_name = server
                            }
                            setVlessConfig({ ...vlessConfig, ...updates })
                          }}
                          placeholder="www.example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{t("realityHandshakePort")}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="65535"
                          value={vlessConfig.reality_handshake_port}
                          onChange={(e) => {
                            const port = parsePort(e.target.value, vlessConfig.reality_handshake_port)
                            setVlessConfig({ ...vlessConfig, reality_handshake_port: port })
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>SNI ({t("serverNameOptional")})</Label>
                      <Input
                        value={vlessConfig.tls_server_name}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, tls_server_name: e.target.value })}
                        placeholder={vlessConfig.reality_handshake_server || "example.com"}
                      />
                      <p className="text-xs text-muted-foreground">
                        {vlessConfig.reality_handshake_server
                          ? `默认使用握手服务器: ${vlessConfig.reality_handshake_server}`
                          : ""}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{t("realityPrivateKey")}</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const response = await apiClient.generateRealityKeypair()
                              if (response.private_key) {
                                setVlessConfig((prev) => ({
                                  ...prev,
                                  reality_private_key: response.private_key,
                                  reality_public_key: response.public_key || "",
                                }))
                                if (response.public_key) {
                                  try {
                                    await navigator.clipboard.writeText(response.public_key)
                                  } catch {
                                    // clipboard may fail in non-HTTPS contexts
                                  }
                                }
                              }
                            } catch {
                              setError(t("generateKeysFailed"))
                            }
                          }}
                        >
                          <Key className="h-4 w-4 mr-1" />
                          {t("generateKeys")}
                        </Button>
                      </div>
                      <Input
                        value={vlessConfig.reality_private_key}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, reality_private_key: e.target.value })}
                        placeholder="Private Key"
                      />
                      {vlessConfig.reality_public_key && (
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground shrink-0">{t("publicKey")}:</Label>
                          <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{vlessConfig.reality_public_key}</code>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(vlessConfig.reality_public_key)
                                setError(t("keyCopied"))
                                setTimeout(() => setError(""), 3000)
                              } catch {
                                // fallback: select text
                              }
                            }}
                          >
                            {t("copyPublicKey")}
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>{t("realityShortId")}</Label>
                      <Input
                        value={vlessConfig.reality_short_id}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, reality_short_id: e.target.value })}
                        placeholder="0123456789abcdef"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("realityShortIdHint")}
                      </p>
                    </div>
                  </div>
                ) : vlessConfig.tls_mode === "acme" ? (
                  <div className="space-y-2">
                    <Label>{t("acmeDomain")}</Label>
                    <Input
                      value={vlessConfig.tls_acme_domain}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, tls_acme_domain: e.target.value })}
                      placeholder="example.com"
                    />
                    <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{t("serverNameOptional")}</Label>
                      <Input
                        value={vlessConfig.tls_server_name}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, tls_server_name: e.target.value })}
                        placeholder="example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("certPath")}</Label>
                      <Input
                        value={vlessConfig.tls_certificate_path}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, tls_certificate_path: e.target.value })}
                        placeholder="/etc/sing-box/cert.pem"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("keyPath")}</Label>
                      <Input
                        value={vlessConfig.tls_key_path}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, tls_key_path: e.target.value })}
                        placeholder="/etc/sing-box/key.pem"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Transport 配置 */}
          <div className="space-y-2 border-t pt-4">
            <Label>{t("transportProtocol")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={vlessConfig.transport_type}
              onChange={(e) => {
                const newTransport = e.target.value
                const updates: any = { transport_type: newTransport }
                // xtls-rprx-vision 仅支持 TCP 传输
                if (newTransport !== "tcp") {
                  updates.users = vlessConfig.users.map((u) =>
                    u.flow ? { ...u, flow: "" } : u
                  )
                }
                setVlessConfig({ ...vlessConfig, ...updates })
              }}
            >
              <option value="tcp">{t("tcpDefault")}</option>
              <option value="ws">WebSocket</option>
              <option value="grpc">gRPC</option>
              <option value="http">HTTP/2</option>
              <option value="httpupgrade">HTTP Upgrade</option>
            </select>
            {vlessConfig.transport_type !== "tcp" && (
              <div className="space-y-2 pt-2">
                {vlessConfig.transport_type === "grpc" ? (
                  <div className="space-y-2">
                    <Label>Service Name</Label>
                    <Input
                      value={vlessConfig.transport_service_name}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, transport_service_name: e.target.value })}
                      placeholder="grpc-service"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Path</Label>
                    <Input
                      value={vlessConfig.transport_path}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, transport_path: e.target.value })}
                      placeholder="/ws-path"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* WireGuard 配置 */}
        <TabsContent value="wireguard" className="space-y-4">
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
        </TabsContent>

        {/* Shadowsocks 配置 */}
        <TabsContent value="shadowsocks" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={ssConfig.listen}
                onChange={(e) => setSsConfig({ ...ssConfig, listen: e.target.value })}
                className={!isValidListenAddress(ssConfig.listen) ? "border-red-500" : ""}
              />
              {!isValidListenAddress(ssConfig.listen) && (
                <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={ssConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, ssConfig.listen_port)
                  setSsConfig({ ...ssConfig, listen_port: port })
                }}
                className={!isValidPort(ssConfig.listen_port) ? "border-red-500" : ""}
              />
              {!isValidPort(ssConfig.listen_port) && (
                <p className="text-xs text-red-500">{t("portRange")}</p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("encryption")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={ssConfig.method}
              onChange={(e) => setSsConfig({ ...ssConfig, method: e.target.value })}
            >
              <option value="none">{t("noEncryption")}</option>
              <option value="aes-128-gcm">aes-128-gcm</option>
              <option value="aes-192-gcm">aes-192-gcm</option>
              <option value="aes-256-gcm">aes-256-gcm</option>
              <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</option>
              <option value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</option>
              <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</option>
              <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</option>
              <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>{tc("password")} {ssConfig.method.startsWith("2022-") && t("ssPasswordLabel")}</Label>
            <div className="flex gap-2">
              <Input
                value={ssConfig.password}
                onChange={(e) => setSsConfig({ ...ssConfig, password: e.target.value })}
                placeholder={ssConfig.method.startsWith("2022-") ? t("clickGenerateBase64") : t("enterPassword")}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setSsConfig({ ...ssConfig, password: generateSS2022Key(ssConfig.method) })}
              >
                <Key className="h-4 w-4 mr-1" />
                {tc("generate")}
              </Button>
            </div>
            {ssConfig.method.startsWith("2022-") && (
              <p className="text-xs text-muted-foreground">
                {t("ss2022Hint")}
              </p>
            )}
          </div>
          <div className="pt-2">
            <Button type="button" variant="outline" onClick={showShadowsocksQrCode} disabled={!ssConfig.password}>
              <QrCode className="h-4 w-4 mr-1" />
              {t("generateQrCode")}
            </Button>
          </div>
        </TabsContent>

        {/* Hysteria2 配置 */}
        <TabsContent value="hysteria2" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={hy2Config.listen}
                onChange={(e) => setHy2Config({ ...hy2Config, listen: e.target.value })}
                className={!isValidListenAddress(hy2Config.listen) ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={hy2Config.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, hy2Config.listen_port)
                  setHy2Config({ ...hy2Config, listen_port: port })
                }}
                className={!isValidPort(hy2Config.listen_port) ? "border-red-500" : ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("upBandwidth")}</Label>
              <Input
                type="number"
                value={hy2Config.up_mbps}
                onChange={(e) => setHy2Config({ ...hy2Config, up_mbps: parseInt(e.target.value) || 100 })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("downBandwidth")}</Label>
              <Input
                type="number"
                value={hy2Config.down_mbps}
                onChange={(e) => setHy2Config({ ...hy2Config, down_mbps: parseInt(e.target.value) || 100 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("usernameOptional")}</Label>
            <Input
              value={hy2Config.user_name}
              onChange={(e) => setHy2Config({ ...hy2Config, user_name: e.target.value })}
              placeholder={t("identifyUser")}
            />
          </div>
          <div className="space-y-2">
            <Label>{tc("password")}</Label>
            <div className="flex gap-2">
              <Input
                value={hy2Config.password}
                onChange={(e) => setHy2Config({ ...hy2Config, password: e.target.value })}
                placeholder={t("enterPassword")}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setHy2Config({ ...hy2Config, password: generateSecureRandomString(16) })}
              >
                <Key className="h-4 w-4 mr-1" />
                生成
              </Button>
            </div>
          </div>
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>{t("tlsCertConfig")}</Label>
              <div className="flex gap-2 items-center">
                <select
                  value={hy2Config.tls_mode}
                  onChange={(e) => setHy2Config({ ...hy2Config, tls_mode: e.target.value as "manual" | "acme" })}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="manual">{t("manualConfig")}</option>
                  <option value="acme">{t("acmeAuto")}</option>
                </select>
                {hy2Config.tls_mode === "manual" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => generateSelfSignedCert()}
                      disabled={certLoading}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {certLoading ? t("generating") : t("generateSelfSignedCert")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => certFileRef.current?.click()}
                      disabled={certLoading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {t("uploadCert")}
                    </Button>
                  </>
                )}
                {certInfo && hy2Config.tls_mode === "manual" && (
                  <span className="text-xs text-muted-foreground">
                    {t("certGeneratedShort", { name: certInfo.common_name ?? "" })}
                  </span>
                )}
              </div>
            </div>
          </div>
          {hy2Config.tls_mode === "acme" ? (
            <div className="space-y-2">
              <Label>{t("acmeDomain")}</Label>
              <Input
                value={hy2Config.tls_acme_domain}
                onChange={(e) => setHy2Config({ ...hy2Config, tls_acme_domain: e.target.value })}
                placeholder="example.com"
              />
              <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>{t("tlsCertPath")}</Label>
                <Input
                  value={hy2Config.tls_certificate_path}
                  onChange={(e) => setHy2Config({ ...hy2Config, tls_certificate_path: e.target.value })}
                  placeholder="/etc/sing-box/cert.pem"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("tlsKeyPath")}</Label>
                <Input
                  value={hy2Config.tls_key_path}
                  onChange={(e) => setHy2Config({ ...hy2Config, tls_key_path: e.target.value })}
                  placeholder="/etc/sing-box/key.pem"
                />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>{t("alpnProtocol")}</Label>
            <Input
              value={hy2Config.tls_alpn.join(", ")}
              onChange={(e) => setHy2Config({ ...hy2Config, tls_alpn: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              placeholder="h3, h3-29"
            />
            <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
          </div>
          <div className="pt-2">
            <Button type="button" variant="outline" onClick={showHysteria2QrCode} disabled={!hy2Config.password}>
              <QrCode className="h-4 w-4 mr-1" />
              {t("generateQrCode")}
            </Button>
          </div>
        </TabsContent>

        {/* VMess 配置 */}
        <TabsContent value="vmess" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={vmessConfig.listen}
                onChange={(e) => setVmessConfig({ ...vmessConfig, listen: e.target.value })}
                className={!isValidListenAddress(vmessConfig.listen) ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={vmessConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, vmessConfig.listen_port)
                  setVmessConfig({ ...vmessConfig, listen_port: port })
                }}
                className={!isValidPort(vmessConfig.listen_port) ? "border-red-500" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("users")}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setVmessConfig({
                    ...vmessConfig,
                    users: [...vmessConfig.users, { uuid: "", name: "", alterId: 0 }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {tc("add")}
              </Button>
            </div>

            {vmessConfig.users.map((user, index) => (
              <Card key={index} className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => showVmessQrCode(index)}
                        disabled={!user.uuid}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      {vmessConfig.users.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setVmessConfig({
                              ...vmessConfig,
                              users: vmessConfig.users.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="UUID"
                      value={user.uuid}
                      onChange={(e) => {
                        const newUsers = [...vmessConfig.users]
                        newUsers[index].uuid = e.target.value
                        setVmessConfig({ ...vmessConfig, users: newUsers })
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newUsers = [...vmessConfig.users]
                        newUsers[index].uuid = crypto.randomUUID()
                        setVmessConfig({ ...vmessConfig, users: newUsers })
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder={t("nameOptional")}
                    value={user.name || ""}
                    onChange={(e) => {
                      const newUsers = [...vmessConfig.users]
                      newUsers[index].name = e.target.value
                      setVmessConfig({ ...vmessConfig, users: newUsers })
                    }}
                  />
                  <div className="space-y-1">
                    <Label className="text-xs">{t("alterIdHint")}</Label>
                    <Input
                      type="number"
                      min="0"
                      value={user.alterId || 0}
                      onChange={(e) => {
                        const newUsers = [...vmessConfig.users]
                        newUsers[index].alterId = parseInt(e.target.value) || 0
                        setVmessConfig({ ...vmessConfig, users: newUsers })
                      }}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* TLS 配置 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vmess-tls-enabled"
                checked={vmessConfig.tls_enabled}
                onChange={(e) => setVmessConfig({ ...vmessConfig, tls_enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="vmess-tls-enabled">{t("enableTls")}</Label>
            </div>
            {vmessConfig.tls_enabled && (
              <div className="space-y-2 pl-6">
                <div className="flex gap-2 items-center">
                  <select
                    value={vmessConfig.tls_mode}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, tls_mode: e.target.value as "manual" | "acme" })}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="manual">{t("manualConfig")}</option>
                    <option value="acme">{t("acmeAuto")}</option>
                  </select>
                  {vmessConfig.tls_mode === "manual" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generateSelfSignedCert(vmessConfig.tls_server_name || undefined)}
                        disabled={certLoading}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        {certLoading ? t("generating") : t("generateSelfSignedCert")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => certFileRef.current?.click()}
                        disabled={certLoading}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        {t("uploadCert")}
                      </Button>
                    </>
                  )}
                </div>
                {vmessConfig.tls_mode === "acme" ? (
                  <div className="space-y-2">
                    <Label>{t("acmeDomain")}</Label>
                    <Input
                      value={vmessConfig.tls_acme_domain}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, tls_acme_domain: e.target.value })}
                      placeholder="example.com"
                    />
                    <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{t("certPath")}</Label>
                      <Input
                        value={vmessConfig.tls_certificate_path}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, tls_certificate_path: e.target.value })}
                        placeholder="/etc/sing-box/cert.pem"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("keyPath")}</Label>
                      <Input
                        value={vmessConfig.tls_key_path}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, tls_key_path: e.target.value })}
                        placeholder="/etc/sing-box/key.pem"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Transport 配置 */}
          <div className="space-y-2 border-t pt-4">
            <Label>{t("transportProtocol")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={vmessConfig.transport_type}
              onChange={(e) => setVmessConfig({ ...vmessConfig, transport_type: e.target.value })}
            >
              <option value="tcp">{t("tcpDefault")}</option>
              <option value="ws">WebSocket</option>
              <option value="grpc">gRPC</option>
              <option value="http">HTTP/2</option>
              <option value="httpupgrade">HTTP Upgrade</option>
            </select>
            {vmessConfig.transport_type !== "tcp" && (
              <div className="space-y-2 pt-2">
                {vmessConfig.transport_type === "grpc" ? (
                  <div className="space-y-2">
                    <Label>Service Name</Label>
                    <Input
                      value={vmessConfig.transport_service_name}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, transport_service_name: e.target.value })}
                      placeholder="grpc-service"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Path</Label>
                    <Input
                      value={vmessConfig.transport_path}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, transport_path: e.target.value })}
                      placeholder="/ws-path"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Trojan 配置 */}
        <TabsContent value="trojan" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={trojanConfig.listen}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, listen: e.target.value })}
                className={!isValidListenAddress(trojanConfig.listen) ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={trojanConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, trojanConfig.listen_port)
                  setTrojanConfig({ ...trojanConfig, listen_port: port })
                }}
                className={!isValidPort(trojanConfig.listen_port) ? "border-red-500" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("users")}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setTrojanConfig({
                    ...trojanConfig,
                    users: [...trojanConfig.users, { name: "", password: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {tc("add")}
              </Button>
            </div>

            {trojanConfig.users.map((user, index) => (
              <Card key={index} className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => showTrojanQrCode(index)}
                        disabled={!user.password}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      {trojanConfig.users.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setTrojanConfig({
                              ...trojanConfig,
                              users: trojanConfig.users.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <Input
                    placeholder={t("nameOptional")}
                    value={user.name || ""}
                    onChange={(e) => {
                      const newUsers = [...trojanConfig.users]
                      newUsers[index].name = e.target.value
                      setTrojanConfig({ ...trojanConfig, users: newUsers })
                    }}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder={tc("password")}
                      value={user.password}
                      onChange={(e) => {
                        const newUsers = [...trojanConfig.users]
                        newUsers[index].password = e.target.value
                        setTrojanConfig({ ...trojanConfig, users: newUsers })
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newUsers = [...trojanConfig.users]
                        newUsers[index].password = generateSecureRandomString(16)
                        setTrojanConfig({ ...trojanConfig, users: newUsers })
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* TLS 配置 (Trojan 必须启用 TLS) */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="trojan-tls-enabled"
                checked={trojanConfig.tls_enabled}
                onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="trojan-tls-enabled">{t("enableTls")}</Label>
              <span className="text-xs text-amber-600">{t("trojanRequiresTls")}</span>
            </div>
            {trojanConfig.tls_enabled && (
              <div className="space-y-2 pl-6">
                <div className="flex gap-2 items-center">
                  <select
                    value={trojanConfig.tls_mode}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_mode: e.target.value as "manual" | "acme" })}
                    className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="manual">{t("manualConfig")}</option>
                    <option value="acme">{t("acmeAuto")}</option>
                  </select>
                  {trojanConfig.tls_mode === "manual" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => generateSelfSignedCert(trojanConfig.tls_server_name || undefined)}
                        disabled={certLoading}
                      >
                        <Shield className="h-4 w-4 mr-1" />
                        {certLoading ? t("generating") : t("generateSelfSignedCert")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => certFileRef.current?.click()}
                        disabled={certLoading}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        {t("uploadCert")}
                      </Button>
                    </>
                  )}
                </div>
                {trojanConfig.tls_mode === "acme" ? (
                  <div className="space-y-2">
                    <Label>{t("acmeDomain")}</Label>
                    <Input
                      value={trojanConfig.tls_acme_domain}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_acme_domain: e.target.value })}
                      placeholder="example.com"
                    />
                    <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label>{t("certPath")}</Label>
                      <Input
                        value={trojanConfig.tls_certificate_path}
                        onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_certificate_path: e.target.value })}
                        placeholder="/etc/sing-box/cert.pem"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("keyPath")}</Label>
                      <Input
                        value={trojanConfig.tls_key_path}
                        onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_key_path: e.target.value })}
                        placeholder="/etc/sing-box/key.pem"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Transport 配置 */}
          <div className="space-y-2 border-t pt-4">
            <Label>{t("transportProtocol")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={trojanConfig.transport_type}
              onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_type: e.target.value })}
            >
              <option value="tcp">{t("tcpDefault")}</option>
              <option value="ws">WebSocket</option>
              <option value="grpc">gRPC</option>
            </select>
            {trojanConfig.transport_type !== "tcp" && (
              <div className="space-y-2 pt-2">
                {trojanConfig.transport_type === "grpc" ? (
                  <div className="space-y-2">
                    <Label>Service Name</Label>
                    <Input
                      value={trojanConfig.transport_service_name}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_service_name: e.target.value })}
                      placeholder="grpc-service"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Path</Label>
                    <Input
                      value={trojanConfig.transport_path}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_path: e.target.value })}
                      placeholder="/ws-path"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TUIC 配置 */}
        <TabsContent value="tuic" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={tuicConfig.listen}
                onChange={(e) => setTuicConfig({ ...tuicConfig, listen: e.target.value })}
                className={!isValidListenAddress(tuicConfig.listen) ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={tuicConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, tuicConfig.listen_port)
                  setTuicConfig({ ...tuicConfig, listen_port: port })
                }}
                className={!isValidPort(tuicConfig.listen_port) ? "border-red-500" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("congestionAlgorithm")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={tuicConfig.congestion_control}
              onChange={(e) => setTuicConfig({ ...tuicConfig, congestion_control: e.target.value })}
            >
              <option value="cubic">{t("cubicDefault")}</option>
              <option value="new_reno">New Reno</option>
              <option value="bbr">BBR</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("users")}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setTuicConfig({
                    ...tuicConfig,
                    users: [...tuicConfig.users, { uuid: "", name: "", password: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {tc("add")}
              </Button>
            </div>

            {tuicConfig.users.map((user, index) => (
              <Card key={index} className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => showTuicQrCode(index)}
                        disabled={!user.uuid}
                      >
                        <QrCode className="h-4 w-4" />
                      </Button>
                      {tuicConfig.users.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setTuicConfig({
                              ...tuicConfig,
                              users: tuicConfig.users.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="UUID"
                      value={user.uuid}
                      onChange={(e) => {
                        const newUsers = [...tuicConfig.users]
                        newUsers[index].uuid = e.target.value
                        setTuicConfig({ ...tuicConfig, users: newUsers })
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newUsers = [...tuicConfig.users]
                        newUsers[index].uuid = crypto.randomUUID()
                        setTuicConfig({ ...tuicConfig, users: newUsers })
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder={t("nameOptional")}
                    value={user.name || ""}
                    onChange={(e) => {
                      const newUsers = [...tuicConfig.users]
                      newUsers[index].name = e.target.value
                      setTuicConfig({ ...tuicConfig, users: newUsers })
                    }}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder={t("passwordOptional")}
                      value={user.password || ""}
                      onChange={(e) => {
                        const newUsers = [...tuicConfig.users]
                        newUsers[index].password = e.target.value
                        setTuicConfig({ ...tuicConfig, users: newUsers })
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newUsers = [...tuicConfig.users]
                        newUsers[index].password = generateSecureRandomString(16)
                        setTuicConfig({ ...tuicConfig, users: newUsers })
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* TLS 配置 (TUIC 必须启用 TLS) */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>{t("tuicTlsLabel")}</Label>
              <div className="flex gap-2 items-center">
                <select
                  value={tuicConfig.tls_mode}
                  onChange={(e) => setTuicConfig({ ...tuicConfig, tls_mode: e.target.value as "manual" | "acme" })}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="manual">{t("manualConfig")}</option>
                  <option value="acme">{t("acmeAuto")}</option>
                </select>
                {tuicConfig.tls_mode === "manual" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => generateSelfSignedCert()}
                    disabled={certLoading}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    {certLoading ? t("generating") : t("generateSelfSignedCert")}
                  </Button>
                )}
              </div>
            </div>
            {tuicConfig.tls_mode === "acme" ? (
              <div className="space-y-2">
                <Label>{t("acmeDomain")}</Label>
                <Input
                  value={tuicConfig.tls_acme_domain}
                  onChange={(e) => setTuicConfig({ ...tuicConfig, tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={tuicConfig.tls_certificate_path}
                    onChange={(e) => setTuicConfig({ ...tuicConfig, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={tuicConfig.tls_key_path}
                    onChange={(e) => setTuicConfig({ ...tuicConfig, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>{t("alpnProtocol")}</Label>
              <Input
                value={tuicConfig.tls_alpn.join(", ")}
                onChange={(e) => setTuicConfig({ ...tuicConfig, tls_alpn: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                placeholder="h3, h3-29"
              />
              <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
            </div>
          </div>
        </TabsContent>

        {/* Naive 配置 */}
        <TabsContent value="naive" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={naiveConfig.listen}
                onChange={(e) => setNaiveConfig({ ...naiveConfig, listen: e.target.value })}
                className={!isValidListenAddress(naiveConfig.listen) ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={naiveConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, naiveConfig.listen_port)
                  setNaiveConfig({ ...naiveConfig, listen_port: port })
                }}
                className={!isValidPort(naiveConfig.listen_port) ? "border-red-500" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("users")}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setNaiveConfig({
                    ...naiveConfig,
                    users: [...naiveConfig.users, { username: "", password: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {tc("add")}
              </Button>
            </div>

            {naiveConfig.users.map((user, index) => (
              <Card key={index} className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                    {naiveConfig.users.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setNaiveConfig({
                            ...naiveConfig,
                            users: naiveConfig.users.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder={tc("username")}
                    value={user.username}
                    onChange={(e) => {
                      const newUsers = [...naiveConfig.users]
                      newUsers[index].username = e.target.value
                      setNaiveConfig({ ...naiveConfig, users: newUsers })
                    }}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder={tc("password")}
                      value={user.password}
                      onChange={(e) => {
                        const newUsers = [...naiveConfig.users]
                        newUsers[index].password = e.target.value
                        setNaiveConfig({ ...naiveConfig, users: newUsers })
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newUsers = [...naiveConfig.users]
                        newUsers[index].password = generateSecureRandomString(16)
                        setNaiveConfig({ ...naiveConfig, users: newUsers })
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* TLS 配置 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>{t("tlsCertConfig")}</Label>
              <div className="flex gap-2 items-center">
                <select
                  value={naiveConfig.tls_mode}
                  onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_mode: e.target.value as "manual" | "acme" })}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="manual">{t("manualConfig")}</option>
                  <option value="acme">{t("acmeAuto")}</option>
                </select>
                {naiveConfig.tls_mode === "manual" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => generateSelfSignedCert()}
                      disabled={certLoading}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {certLoading ? t("generating") : t("generateSelfSignedCert")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => certFileRef.current?.click()}
                      disabled={certLoading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {t("uploadCert")}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {naiveConfig.tls_mode === "acme" ? (
              <div className="space-y-2">
                <Label>{t("acmeDomain")}</Label>
                <Input
                  value={naiveConfig.tls_acme_domain}
                  onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={naiveConfig.tls_certificate_path}
                    onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={naiveConfig.tls_key_path}
                    onChange={(e) => setNaiveConfig({ ...naiveConfig, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* ShadowTLS 配置 */}
        <TabsContent value="shadowtls" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={shadowtlsConfig.listen}
                onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, listen: e.target.value })}
                className={!isValidListenAddress(shadowtlsConfig.listen) ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={shadowtlsConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, shadowtlsConfig.listen_port)
                  setShadowtlsConfig({ ...shadowtlsConfig, listen_port: port })
                }}
                className={!isValidPort(shadowtlsConfig.listen_port) ? "border-red-500" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("protocolVersion")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={shadowtlsConfig.version}
              onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, version: parseInt(e.target.value) })}
            >
              <option value="1">v1</option>
              <option value="2">v2</option>
              <option value="3">{t("v3Recommended")}</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("handshakeServer")}</Label>
              <Input
                value={shadowtlsConfig.handshake_server}
                onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, handshake_server: e.target.value })}
                placeholder="www.google.com"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("handshakePort")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={shadowtlsConfig.handshake_server_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, shadowtlsConfig.handshake_server_port)
                  setShadowtlsConfig({ ...shadowtlsConfig, handshake_server_port: port })
                }}
              />
            </div>
          </div>

          {shadowtlsConfig.version === 2 && (
            <div className="space-y-2">
              <Label>{t("passwordV2")}</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={shadowtlsConfig.password}
                  onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, password: e.target.value })}
                  placeholder={t("shadowtlsV2Password")}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShadowtlsConfig({ ...shadowtlsConfig, password: generateSecureRandomString(16) })}
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {shadowtlsConfig.version >= 3 && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="shadowtls-strict-mode"
                checked={shadowtlsConfig.strict_mode}
                onChange={(e) => setShadowtlsConfig({ ...shadowtlsConfig, strict_mode: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="shadowtls-strict-mode">{t("strictMode")}</Label>
            </div>
          )}

          {shadowtlsConfig.version >= 3 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t("usersV3")}</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setShadowtlsConfig({
                      ...shadowtlsConfig,
                      users: [...shadowtlsConfig.users, { name: "", password: "" }],
                    })
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>

              {shadowtlsConfig.users.map((user, index) => (
                <Card key={index} className="p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                      {shadowtlsConfig.users.length > 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setShadowtlsConfig({
                              ...shadowtlsConfig,
                              users: shadowtlsConfig.users.filter((_, i) => i !== index),
                            })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      placeholder={t("nameOptional")}
                      value={user.name || ""}
                      onChange={(e) => {
                        const newUsers = [...shadowtlsConfig.users]
                        newUsers[index].name = e.target.value
                        setShadowtlsConfig({ ...shadowtlsConfig, users: newUsers })
                      }}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder={tc("password")}
                        value={user.password}
                        onChange={(e) => {
                          const newUsers = [...shadowtlsConfig.users]
                          newUsers[index].password = e.target.value
                          setShadowtlsConfig({ ...shadowtlsConfig, users: newUsers })
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newUsers = [...shadowtlsConfig.users]
                          newUsers[index].password = generateSecureRandomString(16)
                          setShadowtlsConfig({ ...shadowtlsConfig, users: newUsers })
                        }}
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* AnyTLS 配置 */}
        <TabsContent value="anytls" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={anytlsConfig.listen}
                onChange={(e) => setAnytlsConfig({ ...anytlsConfig, listen: e.target.value })}
                className={!isValidListenAddress(anytlsConfig.listen) ? "border-red-500" : ""}
              />
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={anytlsConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, anytlsConfig.listen_port)
                  setAnytlsConfig({ ...anytlsConfig, listen_port: port })
                }}
                className={!isValidPort(anytlsConfig.listen_port) ? "border-red-500" : ""}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("users")}</Label>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setAnytlsConfig({
                    ...anytlsConfig,
                    users: [...anytlsConfig.users, { name: "", password: "" }],
                  })
                }
              >
                <Plus className="h-4 w-4 mr-1" />
                {tc("add")}
              </Button>
            </div>

            {anytlsConfig.users.map((user, index) => (
              <Card key={index} className="p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-sm">{t("userIndex", { n: index + 1 })}</Label>
                    {anytlsConfig.users.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setAnytlsConfig({
                            ...anytlsConfig,
                            users: anytlsConfig.users.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <Input
                    placeholder={t("nameOptional")}
                    value={user.name || ""}
                    onChange={(e) => {
                      const newUsers = [...anytlsConfig.users]
                      newUsers[index].name = e.target.value
                      setAnytlsConfig({ ...anytlsConfig, users: newUsers })
                    }}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder={tc("password")}
                      value={user.password}
                      onChange={(e) => {
                        const newUsers = [...anytlsConfig.users]
                        newUsers[index].password = e.target.value
                        setAnytlsConfig({ ...anytlsConfig, users: newUsers })
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newUsers = [...anytlsConfig.users]
                        newUsers[index].password = generateSecureRandomString(16)
                        setAnytlsConfig({ ...anytlsConfig, users: newUsers })
                      }}
                    >
                      <Key className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* TLS 配置 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>{t("tlsCertConfig")}</Label>
              <div className="flex gap-2 items-center">
                <select
                  value={anytlsConfig.tls_mode}
                  onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_mode: e.target.value as "manual" | "acme" })}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="manual">{t("manualConfig")}</option>
                  <option value="acme">{t("acmeAuto")}</option>
                </select>
                {anytlsConfig.tls_mode === "manual" && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => generateSelfSignedCert()}
                      disabled={certLoading}
                    >
                      <Shield className="h-4 w-4 mr-1" />
                      {certLoading ? t("generating") : t("generateSelfSignedCert")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => certFileRef.current?.click()}
                      disabled={certLoading}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      {t("uploadCert")}
                    </Button>
                  </>
                )}
              </div>
            </div>
            {anytlsConfig.tls_mode === "acme" ? (
              <div className="space-y-2">
                <Label>{t("acmeDomain")}</Label>
                <Input
                  value={anytlsConfig.tls_acme_domain}
                  onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_acme_domain: e.target.value })}
                  placeholder="example.com"
                />
                <p className="text-xs text-muted-foreground">{t("acmeHint")}</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={anytlsConfig.tls_certificate_path}
                    onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={anytlsConfig.tls_key_path}
                    onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {/* HTTP 配置 */}
        <TabsContent value="http" className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("listenAddr")}</Label>
              <Input
                value={httpConfig.listen}
                onChange={(e) => setHttpConfig({ ...httpConfig, listen: e.target.value })}
                className={!isValidListenAddress(httpConfig.listen) ? "border-red-500" : ""}
              />
              {!isValidListenAddress(httpConfig.listen) && (
                <p className="text-xs text-red-500">{t("invalidIpAddr")}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{tc("port")}</Label>
              <Input
                type="number"
                min="1"
                max="65535"
                value={httpConfig.listen_port}
                onChange={(e) => {
                  const port = parsePort(e.target.value, httpConfig.listen_port)
                  setHttpConfig({ ...httpConfig, listen_port: port })
                }}
                className={!isValidPort(httpConfig.listen_port) ? "border-red-500" : ""}
              />
              {!isValidPort(httpConfig.listen_port) && (
                <p className="text-xs text-red-500">{t("portRange")}</p>
              )}
            </div>
          </div>

          {/* 认证配置 */}
          <div className="space-y-2">
            <Label>{t("authMode")}</Label>
            <select
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent"
              value={httpConfig.auth}
              onChange={(e) => setHttpConfig({ ...httpConfig, auth: e.target.value as "none" | "password" })}
            >
              <option value="none">{t("noAuth")}</option>
              <option value="password">{t("passwordAuth")}</option>
            </select>
          </div>
          {httpConfig.auth === "password" && (
            <>
              <div className="space-y-2">
                <Label>{tc("username")}</Label>
                <Input
                  value={httpConfig.username}
                  onChange={(e) => setHttpConfig({ ...httpConfig, username: e.target.value })}
                  placeholder={t("enterUsername")}
                />
              </div>
              <div className="space-y-2">
                <Label>{tc("password")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={httpConfig.password}
                    onChange={(e) => setHttpConfig({ ...httpConfig, password: e.target.value })}
                    placeholder={t("enterPassword")}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setHttpConfig({
                        ...httpConfig,
                        username: generateSecureRandomString(8),
                        password: generateSecureRandomString(16),
                      })
                    }
                  >
                    <Key className="h-4 w-4 mr-1" />
                    {tc("generate")}
                  </Button>
                </div>
              </div>
            </>
          )}

          {/* TLS 配置 */}
          <div className="space-y-2 border-t pt-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="http-tls-enabled"
                checked={httpConfig.tls_enabled}
                onChange={(e) => setHttpConfig({ ...httpConfig, tls_enabled: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="http-tls-enabled">{t("enableTlsHttps")}</Label>
            </div>
            {httpConfig.tls_enabled && (
              <div className="space-y-2 pl-6">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => generateSelfSignedCert()}
                    disabled={certLoading}
                  >
                    <Shield className="h-4 w-4 mr-1" />
                    {certLoading ? t("generating") : t("generateSelfSignedCert")}
                  </Button>
                  {certInfo && (
                    <span className="text-xs text-muted-foreground self-center">
                      {t("certGenerated", { name: certInfo.common_name ?? "", validTo: certInfo.valid_to ?? "" })}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>{t("certPath")}</Label>
                  <Input
                    value={httpConfig.tls_certificate_path}
                    onChange={(e) => setHttpConfig({ ...httpConfig, tls_certificate_path: e.target.value })}
                    placeholder="/etc/sing-box/cert.pem"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("keyPath")}</Label>
                  <Input
                    value={httpConfig.tls_key_path}
                    onChange={(e) => setHttpConfig({ ...httpConfig, tls_key_path: e.target.value })}
                    placeholder="/etc/sing-box/key.pem"
                  />
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {error && (
        <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      {/* 二维码对话框 */}
      <Dialog open={showQrCode} onOpenChange={setShowQrCode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {qrCodeType === "wireguard" && t("qrCodeTitleWireguard")}
              {qrCodeType === "shadowsocks" && t("qrCodeTitleShadowsocks")}
              {qrCodeType === "socks5" && t("qrCodeTitleMixed")}
              {qrCodeType === "vless" && t("qrCodeTitleVless")}
              {qrCodeType === "hysteria2" && t("qrCodeTitleHysteria2")}
            </DialogTitle>
            <DialogDescription>
              {qrCodeType === "wireguard" && t("qrCodeDescWireguard", { n: selectedPeerIndex + 1 })}
              {qrCodeType === "shadowsocks" && t("qrCodeDescShadowsocks")}
              {qrCodeType === "socks5" && t("qrCodeDescSocks5")}
              {qrCodeType === "vless" && t("qrCodeDescVless", { n: selectedPeerIndex + 1 })}
              {qrCodeType === "hysteria2" && t("qrCodeDescHysteria2")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-lg">
              <QRCodeSVG value={qrCodeContent} size={256} level="M" />
            </div>
            {qrCodeType !== "wireguard" && (
              <div className="w-full">
                <Label className="text-xs text-muted-foreground">{t("shareLink")}</Label>
                <Input
                  value={qrCodeContent}
                  readOnly
                  className="text-xs font-mono"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 隐藏的文件输入元素用于上传证书 */}
      <input
        type="file"
        ref={certFileRef}
        onChange={handleCertFileChange}
        accept=".pem,.crt,.cer"
        style={{ display: "none" }}
      />
      <input
        type="file"
        ref={keyFileRef}
        onChange={handleKeyFileChange}
        accept=".pem,.key"
        style={{ display: "none" }}
      />
    </div>
  )

  if (showCard) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("cardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    )
  }

  return content
}
