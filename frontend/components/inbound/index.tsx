"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { QRCodeSVG } from "qrcode.react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useSingboxConfigStore } from "@/lib/store/singbox-config"
import { apiClient } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import type { QrCodeType } from "./types"

// Protocol form components
import { MixedForm } from "./mixed-form"
import { VlessForm } from "./vless-form"
import { VmessForm } from "./vmess-form"
import { TrojanForm } from "./trojan-form"
import { ShadowsocksForm } from "./shadowsocks-form"
import { Hysteria2Form } from "./hysteria2-form"
import { WireguardForm } from "./wireguard-form"
import { TuicForm } from "./tuic-form"
import { NaiveForm } from "./naive-form"
import { ShadowtlsForm } from "./shadowtls-form"
import { AnytlsForm } from "./anytls-form"
import { HttpForm } from "./http-form"

interface InboundConfigProps {
  showCard?: boolean
}

export function InboundConfig({ showCard = true }: InboundConfigProps) {
  const { t } = useTranslation("inbound")
  const { config: storeConfig, setInbound, setEndpoint, clearEndpoints, currentInstance } = useSingboxConfigStore()
  const initialConfig = storeConfig.inbounds?.[0]
  const initialEndpoint = storeConfig.endpoints?.[0]

  const [protocol, setProtocol] = useState(() => {
    if (initialConfig?.type) {
      const map: Record<string, string> = {
        mixed: "socks5", socks: "socks5", vless: "vless", wireguard: "wireguard",
        http: "http", shadowsocks: "shadowsocks", hysteria2: "hysteria2",
        vmess: "vmess", trojan: "trojan", tuic: "tuic", naive: "naive",
        shadowtls: "shadowtls", anytls: "anytls",
      }
      return map[initialConfig.type] || "wireguard"
    }
    if (initialEndpoint?.type === "wireguard") return "wireguard"
    return "wireguard"
  })

  // Shared state
  const [error, setError] = useState("")
  const [showQrCode, setShowQrCode] = useState(false)
  const [qrCodeContent, setQrCodeContent] = useState("")
  const [qrCodeType, setQrCodeType] = useState<QrCodeType>("wireguard")
  const [selectedPeerIndex, setSelectedPeerIndex] = useState(0)
  const [serverIP, setServerIP] = useState("")
  const [certLoading, setCertLoading] = useState(false)
  const [certInfo, setCertInfo] = useState<{ common_name?: string; valid_to?: string } | null>(null)

  // Certificate file upload refs
  const certFileRef = useRef<HTMLInputElement>(null)
  const keyFileRef = useRef<HTMLInputElement>(null)
  const [pendingCertFile, setPendingCertFile] = useState<File | null>(null)

  // Shared callbacks
  const handleError = (msg: string) => setError(msg)

  const handleShowQrCode = (content: string, type: QrCodeType, peerIndex?: number) => {
    setQrCodeContent(content)
    setQrCodeType(type)
    if (peerIndex !== undefined) setSelectedPeerIndex(peerIndex)
    setShowQrCode(true)
  }

  const handleGenerateCert = async (domain?: string) => {
    if (!currentInstance) {
      setError(t("selectInstanceFirst"))
      return
    }

    setCertLoading(true)
    setError("")
    try {
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

  const handleUploadCert = () => {
    certFileRef.current?.click()
  }

  const handleCertFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPendingCertFile(file)
      keyFileRef.current?.click()
    }
  }

  const handleKeyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && pendingCertFile) {
      if (!currentInstance) {
        setError(t("selectInstanceFirst"))
        return
      }

      setCertLoading(true)
      setError("")
      try {
        const result = await apiClient.uploadCertificate(currentInstance, pendingCertFile, file)
        setCertInfo({
          common_name: result.common_name,
          valid_to: result.valid_to,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : t("uploadCertFailed"))
      } finally {
        setCertLoading(false)
      }

      setPendingCertFile(null)
      if (certFileRef.current) certFileRef.current.value = ""
      if (keyFileRef.current) keyFileRef.current.value = ""
    }
  }

  // Shared props for all protocol forms
  const formProps = {
    initialConfig,
    initialEndpoint,
    setInbound,
    setEndpoint,
    clearEndpoints,
    currentInstance,
    onError: handleError,
    onShowQrCode: handleShowQrCode,
    serverIP,
    setServerIP,
    certLoading,
    setCertLoading,
    certInfo,
    setCertInfo,
    onGenerateCert: handleGenerateCert,
    onUploadCert: handleUploadCert,
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

        <TabsContent value="socks5"><MixedForm {...formProps} /></TabsContent>
        <TabsContent value="vless"><VlessForm {...formProps} /></TabsContent>
        <TabsContent value="wireguard"><WireguardForm {...formProps} /></TabsContent>
        <TabsContent value="shadowsocks"><ShadowsocksForm {...formProps} /></TabsContent>
        <TabsContent value="hysteria2"><Hysteria2Form {...formProps} /></TabsContent>
        <TabsContent value="vmess"><VmessForm {...formProps} /></TabsContent>
        <TabsContent value="trojan"><TrojanForm {...formProps} /></TabsContent>
        <TabsContent value="tuic"><TuicForm {...formProps} /></TabsContent>
        <TabsContent value="naive"><NaiveForm {...formProps} /></TabsContent>
        <TabsContent value="shadowtls"><ShadowtlsForm {...formProps} /></TabsContent>
        <TabsContent value="anytls"><AnytlsForm {...formProps} /></TabsContent>
        <TabsContent value="http"><HttpForm {...formProps} /></TabsContent>
      </Tabs>

      {error && (
        <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
          {error}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={showQrCode} onOpenChange={setShowQrCode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {qrCodeType === "wireguard" && t("qrCodeTitleWireguard")}
              {qrCodeType === "shadowsocks" && t("qrCodeTitleShadowsocks")}
              {qrCodeType === "socks5" && t("qrCodeTitleMixed")}
              {qrCodeType === "vless" && t("qrCodeTitleVless")}
              {qrCodeType === "hysteria2" && t("qrCodeTitleHysteria2")}
              {qrCodeType === "vmess" && t("qrCodeTitleVmess")}
              {qrCodeType === "trojan" && t("qrCodeTitleTrojan")}
              {qrCodeType === "tuic" && t("qrCodeTitleTuic")}
            </DialogTitle>
            <DialogDescription>
              {qrCodeType === "wireguard" && t("qrCodeDescWireguard", { n: selectedPeerIndex + 1 })}
              {qrCodeType === "shadowsocks" && t("qrCodeDescShadowsocks")}
              {qrCodeType === "socks5" && t("qrCodeDescSocks5")}
              {qrCodeType === "vless" && t("qrCodeDescVless", { n: selectedPeerIndex + 1 })}
              {qrCodeType === "hysteria2" && t("qrCodeDescHysteria2")}
              {qrCodeType === "vmess" && t("qrCodeDescVmess", { n: selectedPeerIndex + 1 })}
              {qrCodeType === "trojan" && t("qrCodeDescTrojan", { n: selectedPeerIndex + 1 })}
              {qrCodeType === "tuic" && t("qrCodeDescTuic", { n: selectedPeerIndex + 1 })}
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

      {/* Hidden file inputs for certificate upload */}
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
