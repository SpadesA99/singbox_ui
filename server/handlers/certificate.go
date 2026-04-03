package handlers

import (
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"singbox-config-service/services"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/curve25519"
)

// GenerateCertRequest 生成证书请求
type GenerateCertRequest struct {
	Domain    string `json:"domain" binding:"required"`   // 域名或 IP
	ValidDays int    `json:"valid_days"`                  // 有效期天数，默认 365
	Instance  string `json:"instance" binding:"required"` // 实例名称（必填）
}

// GenerateSelfSignedCert 生成自签名证书
func GenerateSelfSignedCert(c *gin.Context) {
	var req GenerateCertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "Invalid request body",
		})
		return
	}

	// 获取证书目录（实例目录）
	certDir := getInstanceCertDir(req.Instance)

	// 生成证书
	certInfo, err := services.GenerateSelfSignedCert(req.Domain, req.ValidDays, certDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": err.Error(),
		})
		return
	}

	// 返回容器内的路径（sing-box 容器中的路径）
	c.JSON(http.StatusOK, gin.H{
		"cert_path":        "/etc/sing-box/cert.pem",
		"key_path":         "/etc/sing-box/key.pem",
		"host_cert_path":   certInfo.CertPath,
		"host_key_path":    certInfo.KeyPath,
		"common_name":      certInfo.CommonName,
		"valid_from":       certInfo.ValidFrom,
		"valid_to":         certInfo.ValidTo,
		"fingerprint":      certInfo.Fingerprint,
	})
}

// GetCertificateInfo 获取证书信息
func GetCertificateInfo(c *gin.Context) {
	instance := c.Query("instance")
	if instance == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "instance parameter is required",
		})
		return
	}

	certDir := getInstanceCertDir(instance)
	certPath := filepath.Join(certDir, "cert.pem")

	// 检查证书是否存在
	if !services.CertificateExists(certDir) {
		c.JSON(http.StatusNotFound, gin.H{
			"exists":  false,
			"message": "No certificate found",
		})
		return
	}

	// 获取证书信息
	certInfo, err := services.GetCertificateInfo(certPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"exists":          true,
		"cert_path":       "/etc/sing-box/cert.pem",
		"key_path":        "/etc/sing-box/key.pem",
		"host_cert_path":  certInfo.CertPath,
		"host_key_path":   certInfo.KeyPath,
		"common_name":     certInfo.CommonName,
		"valid_from":      certInfo.ValidFrom,
		"valid_to":        certInfo.ValidTo,
		"fingerprint":     certInfo.Fingerprint,
	})
}

// getInstanceCertDir 获取实例证书目录
func getInstanceCertDir(instance string) string {
	baseDir := os.Getenv("DATA_DIR")
	if baseDir == "" {
		baseDir = "./data"
	}
	return filepath.Join(baseDir, "singbox", "configs", instance)
}

// UploadCertificate 上传证书文件
func UploadCertificate(c *gin.Context) {
	instance := c.PostForm("instance")
	if instance == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "instance parameter is required",
		})
		return
	}

	// 获取证书目录
	certDir := getInstanceCertDir(instance)

	// 确保目录存在
	if err := os.MkdirAll(certDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to create certificate directory: " + err.Error(),
		})
		return
	}

	// 处理证书文件
	certFile, err := c.FormFile("cert")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "cert file is required",
		})
		return
	}

	// 处理私钥文件
	keyFile, err := c.FormFile("key")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "key file is required",
		})
		return
	}

	// 保存证书文件
	certPath := filepath.Join(certDir, "cert.pem")
	certSrc, err := certFile.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to open cert file: " + err.Error(),
		})
		return
	}
	defer certSrc.Close()

	certDst, err := os.Create(certPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to create cert file: " + err.Error(),
		})
		return
	}
	defer certDst.Close()

	if _, err := io.Copy(certDst, certSrc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to save cert file: " + err.Error(),
		})
		return
	}

	// 保存私钥文件
	keyPath := filepath.Join(certDir, "key.pem")
	keySrc, err := keyFile.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to open key file: " + err.Error(),
		})
		return
	}
	defer keySrc.Close()

	keyDst, err := os.OpenFile(keyPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to create key file: " + err.Error(),
		})
		return
	}
	defer keyDst.Close()

	if _, err := io.Copy(keyDst, keySrc); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to save key file: " + err.Error(),
		})
		return
	}

	// 获取证书信息
	certInfo, err := services.GetCertificateInfo(certPath)
	if err != nil {
		// 证书已保存，但无法解析证书信息
		c.JSON(http.StatusOK, gin.H{
			"cert_path":      "/etc/sing-box/cert.pem",
			"key_path":       "/etc/sing-box/key.pem",
			"host_cert_path": certPath,
			"host_key_path":  keyPath,
			"message":        "Certificate uploaded but could not parse info: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"cert_path":      "/etc/sing-box/cert.pem",
		"key_path":       "/etc/sing-box/key.pem",
		"host_cert_path": certPath,
		"host_key_path":  keyPath,
		"common_name":    certInfo.CommonName,
		"valid_from":     certInfo.ValidFrom,
		"valid_to":       certInfo.ValidTo,
		"fingerprint":    certInfo.Fingerprint,
	})
}

// DeriveRealityPublicKey 从 Reality 私钥派生公钥
func DeriveRealityPublicKey(c *gin.Context) {
	var req struct {
		PrivateKey string `json:"private_key" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "private_key is required",
		})
		return
	}

	privateKeyBytes, err := base64.RawURLEncoding.DecodeString(req.PrivateKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "Invalid private key encoding",
		})
		return
	}

	if len(privateKeyBytes) != 32 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "Invalid private key length",
		})
		return
	}

	// Clamp private key for x25519 (与 GenerateRealityKeypair 保持一致)
	privateKeyBytes[0] &= 248
	privateKeyBytes[31] &= 127
	privateKeyBytes[31] |= 64

	publicKey, err := curve25519.X25519(privateKeyBytes, curve25519.Basepoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to derive public key: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"public_key": base64.RawURLEncoding.EncodeToString(publicKey),
	})
}

// GenerateRealityKeypair 生成 Reality x25519 密钥对
func GenerateRealityKeypair(c *gin.Context) {
	// 生成随机私钥
	var privateKey [32]byte
	if _, err := rand.Read(privateKey[:]); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to generate private key: " + err.Error(),
		})
		return
	}

	// Clamp private key for x25519
	privateKey[0] &= 248
	privateKey[31] &= 127
	privateKey[31] |= 64

	// 计算公钥
	publicKey, err := curve25519.X25519(privateKey[:], curve25519.Basepoint)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "Internal Server Error",
			"message": "Failed to derive public key: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"private_key": base64.RawURLEncoding.EncodeToString(privateKey[:]),
		"public_key":  base64.RawURLEncoding.EncodeToString(publicKey),
	})
}

// CheckTLS13Support 检测目标域名是否支持 TLS 1.3（Reality 伪装域名要求）
func CheckTLS13Support(c *gin.Context) {
	var req struct {
		Server string `json:"server" binding:"required"`
		Port   int    `json:"port"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "server is required",
		})
		return
	}
	if req.Port == 0 {
		req.Port = 443
	}

	// 安全校验：拒绝 IP 地址（Reality 目标必须是域名）
	if ip := net.ParseIP(req.Server); ip != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "IP addresses not allowed, use a domain name",
		})
		return
	}

	// 端口范围校验
	if req.Port < 1 || req.Port > 65535 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "Bad Request",
			"message": "port must be between 1 and 65535",
		})
		return
	}

	addr := fmt.Sprintf("%s:%d", req.Server, req.Port)
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", addr, &tls.Config{
		ServerName:         req.Server,
		InsecureSkipVerify: true,
		MinVersion:         tls.VersionTLS12,
		MaxVersion:         tls.VersionTLS13,
	})
	if err != nil {
		log.Printf("TLS check failed for %s:%d: %v", req.Server, req.Port, err)
		c.JSON(http.StatusOK, gin.H{
			"supported":   false,
			"tls_version": "",
			"error":       "connection failed",
		})
		return
	}
	defer conn.Close()

	state := conn.ConnectionState()
	var versionStr string
	switch state.Version {
	case tls.VersionTLS13:
		versionStr = "TLS 1.3"
	case tls.VersionTLS12:
		versionStr = "TLS 1.2"
	case tls.VersionTLS11:
		versionStr = "TLS 1.1"
	case tls.VersionTLS10:
		versionStr = "TLS 1.0"
	default:
		versionStr = fmt.Sprintf("unknown (0x%04x)", state.Version)
	}

	c.JSON(http.StatusOK, gin.H{
		"supported":   state.Version == tls.VersionTLS13,
		"tls_version": versionStr,
	})
}
