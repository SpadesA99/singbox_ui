"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Key, QrCode, Shield, Upload } from "lucide-react"
import { isValidPort, parsePort, isValidListenAddress, generateSecureRandomString } from "@/lib/utils"
import { useTranslation } from "@/lib/i18n"
import { ProtocolFormProps, formatListen, parseListen } from "./types"

interface Hysteria2Config {
  listen: string
  listen_port: number
  up_mbps: number
  down_mbps: number
  user_name: string
  password: string
  tls_alpn: string[]
  tls_mode: "manual" | "acme"
  tls_acme_domain: string
  tls_certificate_path: string
  tls_key_path: string
  obfs_type: string
  obfs_password: string
  masquerade: string
  ignore_client_bandwidth: boolean
}

export function Hysteria2Form({
  initialConfig,
  setInbound,
  clearEndpoints,
  onError,
  onShowQrCode,
  serverIP,
  setServerIP,
  certLoading,
  certInfo,
  onGenerateCert,
  onUploadCert,
}: ProtocolFormProps) {
  const { t } = useTranslation("inbound")
  const { t: tc } = useTranslation("common")

  const [hy2Config, setHy2Config] = useState<Hysteria2Config>({
    listen: "0.0.0.0",
    listen_port: 443,
    up_mbps: 100,
    down_mbps: 100,
    user_name: "",
    password: "",
    tls_alpn: ["h3"],
    tls_mode: "manual",
    tls_acme_domain: "",
    tls_certificate_path: "/etc/sing-box/cert.pem",
    tls_key_path: "/etc/sing-box/key.pem",
    obfs_type: "",
    obfs_password: "",
    masquerade: "",
    ignore_client_bandwidth: false,
  })

  // Load from initialConfig
  useEffect(() => {
    if (!initialConfig || initialConfig.type !== "hysteria2") return
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
      obfs_type: initialConfig.obfs?.type || "",
      obfs_password: initialConfig.obfs?.password || "",
      masquerade: typeof initialConfig.masquerade === "string" ? initialConfig.masquerade : "",
      ignore_client_bandwidth: initialConfig.ignore_client_bandwidth || false,
    })
  }, [initialConfig])

  // Build and push config to store
  useEffect(() => {
    const hy2User: any = { password: hy2Config.password }
    if (hy2Config.user_name) {
      hy2User.name = hy2Config.user_name
    }
    const previewConfig: any = {
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
    if (hy2Config.obfs_type && hy2Config.obfs_password) {
      previewConfig.obfs = { type: hy2Config.obfs_type, password: hy2Config.obfs_password }
    }
    if (hy2Config.masquerade) {
      previewConfig.masquerade = hy2Config.masquerade
    }
    if (hy2Config.ignore_client_bandwidth) {
      previewConfig.ignore_client_bandwidth = true
    }
    setInbound(0, previewConfig)
    clearEndpoints()
  }, [hy2Config])

  const showHysteria2QrCode = async () => {
    onError("")
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

      onShowQrCode(hy2Url, "hysteria2")
    } catch (err) {
      onError(err instanceof Error ? err.message : t("generateQrCodeFailed"))
    }
  }

  return (
    <div className="space-y-4">
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
                  onClick={() => onGenerateCert()}
                  disabled={certLoading}
                >
                  <Shield className="h-4 w-4 mr-1" />
                  {certLoading ? t("generating") : t("generateSelfSignedCert")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUploadCert()}
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
          onChange={(e) =>
            setHy2Config({
              ...hy2Config,
              tls_alpn: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
            })
          }
          placeholder="h3, h3-29"
        />
        <p className="text-xs text-muted-foreground">{t("alpnHint")}</p>
      </div>
      {/* 混淆 (Obfuscation) */}
      <div className="space-y-2">
        <Label>{t("hy2Obfs")}</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={hy2Config.obfs_type}
          onChange={(e) => setHy2Config({ ...hy2Config, obfs_type: e.target.value })}
        >
          <option value="">{t("disabled")}</option>
          <option value="salamander">Salamander</option>
        </select>
      </div>
      {hy2Config.obfs_type && (
        <div className="space-y-2">
          <Label>{t("hy2ObfsPassword")}</Label>
          <Input
            value={hy2Config.obfs_password}
            onChange={(e) => setHy2Config({ ...hy2Config, obfs_password: e.target.value })}
            placeholder={t("hy2ObfsPasswordHint")}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label>{t("hy2Masquerade")}</Label>
        <Input
          value={hy2Config.masquerade}
          onChange={(e) => setHy2Config({ ...hy2Config, masquerade: e.target.value })}
          placeholder="https://example.com"
        />
        <p className="text-xs text-muted-foreground">{t("hy2MasqueradeHint")}</p>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="hy2-ignore-bw"
          checked={hy2Config.ignore_client_bandwidth}
          onChange={(e) => setHy2Config({ ...hy2Config, ignore_client_bandwidth: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="hy2-ignore-bw">{t("hy2IgnoreClientBandwidth")}</Label>
      </div>
      <div className="pt-2">
        <Button type="button" variant="outline" onClick={showHysteria2QrCode} disabled={!hy2Config.password}>
          <QrCode className="h-4 w-4 mr-1" />
          {t("generateQrCode")}
        </Button>
      </div>
    </div>
  )
}
