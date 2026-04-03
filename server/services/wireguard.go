package services

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/curve25519"
)

// WireGuardKeyPair WireGuard 密钥对
type WireGuardKeyPair struct {
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
}

// KeyCacheEntry 密钥缓存条目
type KeyCacheEntry struct {
	IP         string `json:"ip"`
	PublicKey  string `json:"publicKey"`
	PrivateKey string `json:"privateKey"`
}

// KeyCacheResponse 密钥缓存响应（包含IP和密钥对）
type KeyCacheResponse struct {
	IP         string `json:"ip"`
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
}

func getKeysCacheFilePath() string {
	return filepath.Join(singboxDir, "wireguard_keys_cache.txt")
}

// GenerateWireGuardKeysWithCache 生成带缓存的 WireGuard 密钥对
// ip: 必须指定的完整IP地址，如 "10.10.0.5"
func GenerateWireGuardKeysWithCache(ip string) (*KeyCacheResponse, error) {
	// IP 是必须的
	if ip == "" {
		return nil, fmt.Errorf("IP address is required")
	}

	// 读取现有缓存
	cache, err := loadKeysCache()
	if err != nil {
		return nil, fmt.Errorf("failed to load keys cache: %w", err)
	}

	// 检查IP是否已存在，如果存在则直接返回缓存的密钥
	for _, entry := range cache {
		if entry.IP == ip {
			return &KeyCacheResponse{
				IP:         entry.IP,
				PrivateKey: entry.PrivateKey,
				PublicKey:  entry.PublicKey,
			}, nil
		}
	}

	targetIP := ip

	// 生成新的密钥对
	privateKey, err := generatePrivateKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate private key: %w", err)
	}

	publicKey, err := generatePublicKey(privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to generate public key: %w", err)
	}

	// 创建新的缓存条目
	entry := KeyCacheEntry{
		IP:         targetIP,
		PublicKey:  publicKey,
		PrivateKey: privateKey,
	}

	// 添加到缓存
	cache = append(cache, entry)

	// 保存缓存
	if err := saveKeysCache(cache); err != nil {
		return nil, fmt.Errorf("failed to save keys cache: %w", err)
	}

	return &KeyCacheResponse{
		IP:         targetIP,
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}, nil
}

// loadKeysCache 加载密钥缓存
func loadKeysCache() ([]KeyCacheEntry, error) {
	keysCacheFile := getKeysCacheFilePath()
	// 确保数据目录存在
	dataDir := filepath.Dir(keysCacheFile)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, err
	}

	// 如果文件不存在，返回空缓存
	if _, err := os.Stat(keysCacheFile); os.IsNotExist(err) {
		return []KeyCacheEntry{}, nil
	}

	// 读取文件
	data, err := os.ReadFile(keysCacheFile)
	if err != nil {
		return nil, err
	}

	// 解析每一行: IP 公钥 私钥
	var cache []KeyCacheEntry
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		parts := strings.Fields(line)
		if len(parts) != 3 {
			continue
		}

		cache = append(cache, KeyCacheEntry{
			IP:         parts[0],
			PublicKey:  parts[1],
			PrivateKey: parts[2],
		})
	}

	return cache, nil
}

// saveKeysCache 保存密钥缓存
func saveKeysCache(cache []KeyCacheEntry) error {
	keysCacheFile := getKeysCacheFilePath()
	// 确保数据目录存在
	dataDir := filepath.Dir(keysCacheFile)
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	// 构建文件内容
	var lines []string
	for _, entry := range cache {
		line := fmt.Sprintf("%s %s %s", entry.IP, entry.PublicKey, entry.PrivateKey)
		lines = append(lines, line)
	}

	// 写入文件
	content := strings.Join(lines, "\n") + "\n"
	return os.WriteFile(keysCacheFile, []byte(content), 0644)
}

// GetKeysCache 获取密钥缓存列表
func GetKeysCache() ([]KeyCacheEntry, error) {
	return loadKeysCache()
}

// generatePrivateKey 生成 WireGuard 私钥
func generatePrivateKey() (string, error) {
	var privateKey [32]byte
	_, err := rand.Read(privateKey[:])
	if err != nil {
		return "", err
	}

	// WireGuard 要求对私钥进行特定的位操作
	// 这些操作确保密钥符合 Curve25519 的要求
	privateKey[0] &= 248
	privateKey[31] &= 127
	privateKey[31] |= 64

	return base64.StdEncoding.EncodeToString(privateKey[:]), nil
}

// generatePublicKey 从私钥生成公钥
func generatePublicKey(privateKeyStr string) (string, error) {
	privateKey, err := base64.StdEncoding.DecodeString(privateKeyStr)
	if err != nil {
		return "", fmt.Errorf("failed to decode private key: %w", err)
	}

	if len(privateKey) != 32 {
		return "", fmt.Errorf("invalid private key length: expected 32 bytes, got %d", len(privateKey))
	}

	var privateKeyArray [32]byte
	copy(privateKeyArray[:], privateKey)

	// 使用 Curve25519 生成公钥
	publicKey, err := curve25519.X25519(privateKeyArray[:], curve25519.Basepoint)
	if err != nil {
		return "", fmt.Errorf("failed to generate public key: %w", err)
	}

	return base64.StdEncoding.EncodeToString(publicKey), nil
}

// GeneratePublicKeyFromPrivate 从私钥生成公钥（公开函数）
func GeneratePublicKeyFromPrivate(privateKeyStr string) (string, error) {
	return generatePublicKey(privateKeyStr)
}

// SaveClientConfig 保存客户端配置到文件
func SaveClientConfig(configData []byte) error {
	if err := os.MkdirAll(singboxDir, 0755); err != nil {
		return fmt.Errorf("failed to create wireguard directory: %w", err)
	}

	configPath := filepath.Join(singboxDir, "client-config.json")
	if err := os.WriteFile(configPath, configData, 0644); err != nil {
		return fmt.Errorf("failed to save client config: %w", err)
	}

	return nil
}

// GetClientConfig 从文件读取客户端配置
func GetClientConfig() ([]byte, error) {
	configPath := filepath.Join(singboxDir, "client-config.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("client config file not found")
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read client config: %w", err)
	}

	return data, nil
}

// SaveClientConfigFile 保存客户端配置文件（支持多客户端）
func SaveClientConfigFile(clientIndex int, configContent string) error {
	if err := os.MkdirAll(singboxDir, 0755); err != nil {
		return fmt.Errorf("failed to create wireguard directory: %w", err)
	}

	// 保存 .conf 文件
	confPath := filepath.Join(singboxDir, fmt.Sprintf("client%d.conf", clientIndex))
	if err := os.WriteFile(confPath, []byte(configContent), 0644); err != nil {
		return fmt.Errorf("failed to save client config file: %w", err)
	}

	return nil
}

// ClientConfigFile 客户端配置文件信息
type ClientConfigFile struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

// ListClientConfigFiles 列出所有客户端配置文件
func ListClientConfigFiles() ([]ClientConfigFile, error) {
	// 检查目录是否存在
	if _, err := os.Stat(singboxDir); os.IsNotExist(err) {
		return []ClientConfigFile{}, nil
	}

	// 读取目录中的所有文件
	files, err := os.ReadDir(singboxDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read wireguard directory: %w", err)
	}

	configs := []ClientConfigFile{}
	for _, file := range files {
		// 只处理 .conf 文件
		if !file.IsDir() && filepath.Ext(file.Name()) == ".conf" {
			confPath := filepath.Join(singboxDir, file.Name())
			content, err := os.ReadFile(confPath)
			if err != nil {
				continue // 跳过无法读取的文件
			}

			configs = append(configs, ClientConfigFile{
				Name:    file.Name(),
				Content: string(content),
			})
		}
	}

	return configs, nil
}

// isValidIP 验证 IP 地址格式（支持 IPv4 和 IPv6）
func isValidIP(ip string) bool {
	parsedIP := net.ParseIP(ip)
	return parsedIP != nil
}

// fetchIPFromSource 从指定源获取公网 IP
func fetchIPFromSource(url string, timeout time.Duration) (string, error) {
	client := &http.Client{
		Timeout: timeout,
	}

	resp, err := client.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("status code %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	ip := strings.TrimSpace(string(body))

	// 验证 IP 格式
	if !isValidIP(ip) {
		return "", fmt.Errorf("invalid IP format: %s", ip)
	}

	return ip, nil
}

// GetPublicIP 获取服务器公网 IP 地址（支持多源和故障转移）
func GetPublicIP() (string, error) {
	// 多个 IP 获取源（按优先级排序）
	sources := []string{
		"https://api.ipify.org",
		"https://ifconfig.me",
		"https://icanhazip.com",
		"https://checkip.amazonaws.com",
	}

	timeout := 5 * time.Second
	var lastErr error

	// 尝试从每个源获取 IP，直到成功
	for _, source := range sources {
		ip, err := fetchIPFromSource(source, timeout)
		if err != nil {
			lastErr = fmt.Errorf("source %s failed: %w", source, err)
			continue
		}

		// 成功获取并验证 IP
		return ip, nil
	}

	// 所有源都失败
	if lastErr != nil {
		return "", fmt.Errorf("failed to get public IP from all sources: %w", lastErr)
	}
	return "", fmt.Errorf("failed to get public IP: no sources available")
}
