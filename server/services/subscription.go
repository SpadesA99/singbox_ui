package services

import (
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// ProxyNode 代理节点信息
type ProxyNode struct {
	Name     string                 `json:"name"`
	Protocol string                 `json:"protocol"`
	Address  string                 `json:"address"`
	Port     int                    `json:"port"`
	Settings map[string]interface{} `json:"settings"`
	Outbound map[string]interface{} `json:"outbound"` // sing-box 格式的 outbound 配置
	// 测速相关字段
	Latency     int64  `json:"latency,omitempty"`      // 延迟（毫秒）
	Online      bool   `json:"online,omitempty"`       // 是否在线
	LastProbe   string `json:"last_probe,omitempty"`   // 最后测速时间
	SuccessRate int    `json:"success_rate,omitempty"` // 成功率（0-100）
	SpeedKBps   float64 `json:"speed_kbps,omitempty"`  // 代理下载速度 KB/s
}

// decodeBase64 解码 Base64 字符串，自动处理 padding 和 URL 安全编码
func decodeBase64(s string) ([]byte, error) {
	// 移除可能的空白字符
	s = strings.TrimSpace(s)

	// 补充 padding
	switch len(s) % 4 {
	case 2:
		s += "=="
	case 3:
		s += "="
	}

	// 尝试 URL 安全编码
	decoded, err := base64.URLEncoding.DecodeString(s)
	if err == nil {
		return decoded, nil
	}

	// 尝试标准编码
	decoded, err = base64.StdEncoding.DecodeString(s)
	if err == nil {
		return decoded, nil
	}

	// 尝试 RawURLEncoding（无 padding）
	s = strings.TrimRight(s, "=")
	decoded, err = base64.RawURLEncoding.DecodeString(s)
	if err == nil {
		return decoded, nil
	}

	// 尝试 RawStdEncoding（无 padding）
	return base64.RawStdEncoding.DecodeString(s)
}

// VMess 节点配置
type VMess struct {
	V    string `json:"v"`
	PS   string `json:"ps"`
	Add  string `json:"add"`
	Port string `json:"port"`
	ID   string `json:"id"`
	Aid  string `json:"aid"`
	Net  string `json:"net"`
	Type string `json:"type"`
	Host string `json:"host"`
	Path string `json:"path"`
	TLS  string `json:"tls"`
	SNI  string `json:"sni"`
}

// ResolveUserAgent 解析 User-Agent，支持预定义名称和自定义值
func ResolveUserAgent(ua string) string {
	if ua == "" {
		return PredefinedUserAgents["default"]
	}
	// 先检查是否是预定义名称
	if predefined, ok := PredefinedUserAgents[ua]; ok {
		return predefined
	}
	// 否则当作自定义 UA 直接使用
	return ua
}

// FetchSubscription 获取订阅内容
var blockedSubscriptionPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),
	netip.MustParsePrefix("10.0.0.0/8"),
	netip.MustParsePrefix("100.64.0.0/10"),
	netip.MustParsePrefix("127.0.0.0/8"),
	netip.MustParsePrefix("169.254.0.0/16"),
	netip.MustParsePrefix("172.16.0.0/12"),
	netip.MustParsePrefix("192.0.0.0/24"),
	netip.MustParsePrefix("192.0.2.0/24"),
	netip.MustParsePrefix("192.168.0.0/16"),
	netip.MustParsePrefix("198.18.0.0/15"),
	netip.MustParsePrefix("198.51.100.0/24"),
	netip.MustParsePrefix("203.0.113.0/24"),
	netip.MustParsePrefix("224.0.0.0/4"),
	netip.MustParsePrefix("240.0.0.0/4"),
	netip.MustParsePrefix("::/128"),
	netip.MustParsePrefix("::1/128"),
	netip.MustParsePrefix("fe80::/10"),
	netip.MustParsePrefix("fc00::/7"),
	netip.MustParsePrefix("ff00::/8"),
	netip.MustParsePrefix("2001:db8::/32"),
}

func allowInsecureSubscriptionTLS() bool {
	value := strings.TrimSpace(strings.ToLower(os.Getenv("SUBSCRIPTION_INSECURE_TLS")))
	return value == "1" || value == "true" || value == "yes"
}

func isPublicSubscriptionAddr(ip net.IP) bool {
	addr, ok := netip.AddrFromSlice(ip)
	if !ok {
		return false
	}
	addr = addr.Unmap()
	for _, prefix := range blockedSubscriptionPrefixes {
		if prefix.Contains(addr) {
			return false
		}
	}
	return true
}

func validateSubscriptionHost(host string) error {
	normalizedHost := strings.Trim(strings.TrimSpace(host), "[]")
	if normalizedHost == "" {
		return fmt.Errorf("subscription URL host is empty")
	}
	if strings.EqualFold(normalizedHost, "localhost") {
		return fmt.Errorf("subscription host localhost is not allowed")
	}

	if ip := net.ParseIP(normalizedHost); ip != nil {
		if !isPublicSubscriptionAddr(ip) {
			return fmt.Errorf("subscription host %s is not a public address", normalizedHost)
		}
		return nil
	}

	ips, err := net.LookupIP(normalizedHost)
	if err != nil {
		return fmt.Errorf("failed to resolve subscription host %s: %w", normalizedHost, err)
	}
	if len(ips) == 0 {
		return fmt.Errorf("subscription host %s resolves to no address", normalizedHost)
	}
	for _, ip := range ips {
		if !isPublicSubscriptionAddr(ip) {
			return fmt.Errorf("subscription host %s resolves to non-public address %s", normalizedHost, ip.String())
		}
	}

	return nil
}

func validateSubscriptionURL(parsedURL *url.URL) error {
	if parsedURL == nil {
		return fmt.Errorf("subscription URL is nil")
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("unsupported URL scheme: %s (only http/https allowed)", parsedURL.Scheme)
	}
	return validateSubscriptionHost(parsedURL.Hostname())
}

func FetchSubscription(subURL string, userAgent ...string) ([]ProxyNode, error) {
	// 验证 URL 格式
	parsedURL, err := url.Parse(subURL)
	if err != nil {
		return nil, fmt.Errorf("invalid subscription URL: %w", err)
	}

	// 只允许 http 和 https 协议
	if err := validateSubscriptionURL(parsedURL); err != nil {
		return nil, err
	}

	// 创建 HTTP 客户端，跳过 SSL 验证，设置超时
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: allowInsecureSubscriptionTLS(),
		},
	}
	client := &http.Client{
		Transport: tr,
		Timeout:   30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return errors.New("too many redirects while fetching subscription")
			}
			return validateSubscriptionURL(req.URL)
		},
	}

	// 创建请求并设置 User-Agent
	req, err := http.NewRequest("GET", parsedURL.String(), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	ua := PredefinedUserAgents["default"]
	if len(userAgent) > 0 && userAgent[0] != "" {
		ua = ResolveUserAgent(userAgent[0])
	}
	req.Header.Set("User-Agent", ua)

	// 获取订阅内容
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch subscription: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("subscription returned status: %d", resp.StatusCode)
	}

	// 读取响应内容
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read subscription: %w", err)
	}

	// 检测是否是 Clash YAML 格式
	content := strings.TrimSpace(string(body))
	if isClashYAML(content) {
		return parseClashYAML(body)
	}

	// Base64 解码（自动处理 padding）
	decoded, err := decodeBase64(content)
	if err != nil {
		// 如果 base64 解码失败，可能内容本身就是明文
		decoded = body
	}

	return parseProxyLines(string(decoded))
}

// parseProxyLines 解析代理链接行（vmess://、vless:// 等）
func parseProxyLines(content string) ([]ProxyNode, error) {
	lines := strings.Split(content, "\n")
	var nodes []ProxyNode

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 解析不同协议的节点
		if strings.HasPrefix(line, "vmess://") {
			node, err := parseVMessNode(line)
			if err == nil {
				nodes = append(nodes, node)
			}
		} else if strings.HasPrefix(line, "vless://") {
			node, err := parseVLESSNode(line)
			if err == nil {
				nodes = append(nodes, node)
			}
		} else if strings.HasPrefix(line, "trojan://") {
			node, err := parseTrojanNode(line)
			if err == nil {
				nodes = append(nodes, node)
			}
		} else if strings.HasPrefix(line, "ss://") {
			node, err := parseShadowsocksNode(line)
			if err == nil {
				nodes = append(nodes, node)
			}
		}
	}

	return nodes, nil
}

// isClashYAML 检测内容是否为 Clash YAML 格式
func isClashYAML(content string) bool {
	// Clash 配置通常包含这些关键字段
	return strings.Contains(content, "proxies:") &&
		(strings.Contains(content, "proxy-groups:") || strings.Contains(content, "rules:"))
}

// ClashConfig Clash YAML 配置结构
type ClashConfig struct {
	Proxies []ClashProxy `yaml:"proxies"`
}

// ClashProxy Clash 代理节点
type ClashProxy struct {
	Name           string `yaml:"name"`
	Type           string `yaml:"type"`
	Server         string `yaml:"server"`
	Port           int    `yaml:"port"`
	Password       string `yaml:"password"`
	UUID           string `yaml:"uuid"`
	AlterID        int    `yaml:"alterId"`
	Cipher         string `yaml:"cipher"`
	UDP            bool   `yaml:"udp"`
	SNI            string `yaml:"sni"`
	SkipCertVerify bool   `yaml:"skip-cert-verify"`
	TLS            bool   `yaml:"tls"`
	Network        string `yaml:"network"`
	// WS 配置
	WSOpts *ClashWSOptions `yaml:"ws-opts"`
	// GRPC 配置
	GRPCOpts *ClashGRPCOptions `yaml:"grpc-opts"`
	// Flow (VLESS)
	Flow string `yaml:"flow"`
	// Reality
	RealityOpts *ClashRealityOptions `yaml:"reality-opts"`
	// Servername (Clash Meta 格式，用于 Reality SNI)
	Servername string `yaml:"servername"`
	// Client Fingerprint
	ClientFingerprint string `yaml:"client-fingerprint"`
	// SS plugin
	Plugin     string                 `yaml:"plugin"`
	PluginOpts map[string]interface{} `yaml:"plugin-opts"`
}

// ClashWSOptions WebSocket 选项
type ClashWSOptions struct {
	Path    string            `yaml:"path"`
	Headers map[string]string `yaml:"headers"`
}

// ClashGRPCOptions gRPC 选项
type ClashGRPCOptions struct {
	GRPCServiceName string `yaml:"grpc-service-name"`
}

// ClashRealityOptions Reality 选项
type ClashRealityOptions struct {
	PublicKey string `yaml:"public-key"`
	ShortID   string `yaml:"short-id"`
}

// parseClashYAML 解析 Clash YAML 格式订阅
func parseClashYAML(data []byte) ([]ProxyNode, error) {
	var config ClashConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse Clash YAML: %w", err)
	}

	var nodes []ProxyNode
	for _, proxy := range config.Proxies {
		node, err := convertClashProxy(proxy)
		if err != nil {
			continue // 跳过不支持的节点
		}
		nodes = append(nodes, node)
	}

	return nodes, nil
}

// convertClashProxy 将 Clash 代理节点转换为 sing-box ProxyNode
func convertClashProxy(proxy ClashProxy) (ProxyNode, error) {
	switch proxy.Type {
	case "anytls":
		return convertClashAnyTLS(proxy)
	case "vmess":
		return convertClashVMess(proxy)
	case "vless":
		return convertClashVLESS(proxy)
	case "trojan":
		return convertClashTrojan(proxy)
	case "ss", "shadowsocks":
		return convertClashShadowsocks(proxy)
	default:
		return ProxyNode{}, fmt.Errorf("unsupported Clash proxy type: %s", proxy.Type)
	}
}

// convertClashAnyTLS 转换 AnyTLS 节点
func convertClashAnyTLS(proxy ClashProxy) (ProxyNode, error) {
	node := ProxyNode{
		Name:     proxy.Name,
		Protocol: "anytls",
		Address:  proxy.Server,
		Port:     proxy.Port,
		Settings: map[string]interface{}{
			"password": proxy.Password,
		},
	}

	node.Outbound = map[string]interface{}{
		"type":        "anytls",
		"tag":         SanitizeTag("anytls", proxy.Server, proxy.Port),
		"server":      proxy.Server,
		"server_port": proxy.Port,
		"password":    proxy.Password,
	}

	// AnyTLS 要求 TLS
	tlsConfig := map[string]interface{}{
		"enabled": true,
	}
	if proxy.SNI != "" {
		tlsConfig["server_name"] = proxy.SNI
	} else {
		tlsConfig["server_name"] = proxy.Server
	}
	if proxy.SkipCertVerify {
		tlsConfig["insecure"] = true
	}
	node.Outbound["tls"] = tlsConfig

	return node, nil
}

// convertClashVMess 转换 VMess 节点
func convertClashVMess(proxy ClashProxy) (ProxyNode, error) {
	node := ProxyNode{
		Name:     proxy.Name,
		Protocol: "vmess",
		Address:  proxy.Server,
		Port:     proxy.Port,
		Settings: map[string]interface{}{
			"id":       proxy.UUID,
			"alterId":  proxy.AlterID,
			"security": "auto",
		},
	}

	node.Outbound = map[string]interface{}{
		"type":        "vmess",
		"tag":         SanitizeTag("vmess", proxy.Server, proxy.Port),
		"server":      proxy.Server,
		"server_port": proxy.Port,
		"uuid":        proxy.UUID,
		"security":    "auto",
		"alter_id":    proxy.AlterID,
	}

	// 传输层
	addClashTransport(proxy, node.Outbound)
	// TLS
	addClashTLS(proxy, node.Outbound)

	return node, nil
}

// convertClashVLESS 转换 VLESS 节点
func convertClashVLESS(proxy ClashProxy) (ProxyNode, error) {
	node := ProxyNode{
		Name:     proxy.Name,
		Protocol: "vless",
		Address:  proxy.Server,
		Port:     proxy.Port,
		Settings: map[string]interface{}{
			"id":   proxy.UUID,
			"flow": proxy.Flow,
		},
	}

	node.Outbound = map[string]interface{}{
		"type":        "vless",
		"tag":         SanitizeTag("vless", proxy.Server, proxy.Port),
		"server":      proxy.Server,
		"server_port": proxy.Port,
		"uuid":        proxy.UUID,
	}

	if proxy.Flow != "" {
		node.Outbound["flow"] = proxy.Flow
	}

	// 传输层
	addClashTransport(proxy, node.Outbound)
	// TLS（含 Reality）
	addClashTLS(proxy, node.Outbound)

	return node, nil
}

// convertClashTrojan 转换 Trojan 节点
func convertClashTrojan(proxy ClashProxy) (ProxyNode, error) {
	node := ProxyNode{
		Name:     proxy.Name,
		Protocol: "trojan",
		Address:  proxy.Server,
		Port:     proxy.Port,
		Settings: map[string]interface{}{
			"password": proxy.Password,
		},
	}

	node.Outbound = map[string]interface{}{
		"type":        "trojan",
		"tag":         SanitizeTag("trojan", proxy.Server, proxy.Port),
		"server":      proxy.Server,
		"server_port": proxy.Port,
		"password":    proxy.Password,
	}

	// 传输层
	addClashTransport(proxy, node.Outbound)

	// Trojan 默认启用 TLS
	tlsConfig := map[string]interface{}{
		"enabled": true,
	}
	if proxy.SNI != "" {
		tlsConfig["server_name"] = proxy.SNI
	}
	if proxy.SkipCertVerify {
		tlsConfig["insecure"] = true
	}
	fp := proxy.ClientFingerprint
	if fp == "" {
		fp = "chrome"
	}
	tlsConfig["utls"] = map[string]interface{}{
		"enabled":     true,
		"fingerprint": fp,
	}
	node.Outbound["tls"] = tlsConfig

	return node, nil
}

// convertClashShadowsocks 转换 Shadowsocks 节点
func convertClashShadowsocks(proxy ClashProxy) (ProxyNode, error) {
	node := ProxyNode{
		Name:     proxy.Name,
		Protocol: "shadowsocks",
		Address:  proxy.Server,
		Port:     proxy.Port,
		Settings: map[string]interface{}{
			"method":   proxy.Cipher,
			"password": proxy.Password,
		},
	}

	node.Outbound = map[string]interface{}{
		"type":        "shadowsocks",
		"tag":         SanitizeTag("ss", proxy.Server, proxy.Port),
		"server":      proxy.Server,
		"server_port": proxy.Port,
		"method":      proxy.Cipher,
		"password":    proxy.Password,
	}

	return node, nil
}

// addClashTransport 添加 Clash 节点的传输层配置到 sing-box outbound
func addClashTransport(proxy ClashProxy, outbound map[string]interface{}) {
	if proxy.Network == "" || proxy.Network == "tcp" {
		return
	}

	transport := map[string]interface{}{
		"type": proxy.Network,
	}

	if proxy.Network == "ws" && proxy.WSOpts != nil {
		if proxy.WSOpts.Path != "" {
			transport["path"] = proxy.WSOpts.Path
		}
		if host, ok := proxy.WSOpts.Headers["Host"]; ok && host != "" {
			transport["headers"] = map[string]interface{}{
				"Host": host,
			}
		}
	}

	if proxy.Network == "grpc" && proxy.GRPCOpts != nil {
		if proxy.GRPCOpts.GRPCServiceName != "" {
			transport["service_name"] = proxy.GRPCOpts.GRPCServiceName
		}
	}

	outbound["transport"] = transport
}

// addClashTLS 添加 Clash 节点的 TLS 配置到 sing-box outbound
func addClashTLS(proxy ClashProxy, outbound map[string]interface{}) {
	if !proxy.TLS && proxy.RealityOpts == nil {
		return
	}

	tlsConfig := map[string]interface{}{
		"enabled": true,
	}
	sni := proxy.SNI
	if sni == "" {
		sni = proxy.Servername
	}
	if sni != "" {
		tlsConfig["server_name"] = sni
	}
	if proxy.SkipCertVerify {
		tlsConfig["insecure"] = true
	}

	// Reality
	if proxy.RealityOpts != nil {
		tlsConfig["reality"] = map[string]interface{}{
			"enabled":    true,
			"public_key": proxy.RealityOpts.PublicKey,
			"short_id":   proxy.RealityOpts.ShortID,
		}
	}

	// uTLS
	fp := proxy.ClientFingerprint
	if fp == "" {
		fp = "chrome"
	}
	tlsConfig["utls"] = map[string]interface{}{
		"enabled":     true,
		"fingerprint": fp,
	}

	outbound["tls"] = tlsConfig
}

// parseVMessNode 解析 VMess 节点
func parseVMessNode(link string) (ProxyNode, error) {
	// 移除 vmess:// 前缀
	link = strings.TrimPrefix(link, "vmess://")

	// Base64 解码（自动处理 padding）
	decoded, err := decodeBase64(link)
	if err != nil {
		return ProxyNode{}, err
	}

	// 解析 JSON
	var vmess VMess
	if err := json.Unmarshal(decoded, &vmess); err != nil {
		return ProxyNode{}, err
	}

	// 转换为统一格式
	node := ProxyNode{
		Name:     vmess.PS,
		Protocol: "vmess",
		Address:  vmess.Add,
		Settings: map[string]interface{}{
			"id":       vmess.ID,
			"alterId":  vmess.Aid,
			"security": "auto",
		},
	}

	// 解析端口
	fmt.Sscanf(vmess.Port, "%d", &node.Port)

	// 构建 sing-box outbound 配置
	// 使用唯一 tag 避免负载均衡时的冲突
	node.Outbound = map[string]interface{}{
		"type":        "vmess",
		"tag":         SanitizeTag("vmess", vmess.Add, node.Port),
		"server":      vmess.Add,
		"server_port": node.Port,
		"uuid":        vmess.ID,
		"security":    "auto",
		"alter_id":    parseIntOrZero(vmess.Aid),
	}

	// 添加传输层配置
	if vmess.Net != "" && vmess.Net != "tcp" {
		transport := map[string]interface{}{
			"type": vmess.Net,
		}

		if vmess.Net == "ws" {
			if vmess.Path != "" {
				transport["path"] = vmess.Path
			}
			if vmess.Host != "" {
				transport["headers"] = map[string]interface{}{
					"Host": vmess.Host,
				}
			}
		}

		node.Outbound["transport"] = transport
	}

	// 添加 TLS 配置
	if vmess.TLS == "tls" {
		tlsConfig := map[string]interface{}{
			"enabled": true,
		}
		if vmess.SNI != "" {
			tlsConfig["server_name"] = vmess.SNI
		} else if vmess.Host != "" {
			tlsConfig["server_name"] = vmess.Host
		}
		node.Outbound["tls"] = tlsConfig
	}

	return node, nil
}

// parseVLESSNode 解析 VLESS 节点
func parseVLESSNode(link string) (ProxyNode, error) {
	// 移除 vless:// 前缀
	link = strings.TrimPrefix(link, "vless://")

	// 解析 URL
	parts := strings.SplitN(link, "@", 2)
	if len(parts) != 2 {
		return ProxyNode{}, fmt.Errorf("invalid vless link")
	}

	uuid := parts[0]
	rest := parts[1]

	// 解析地址和端口
	addressParts := strings.SplitN(rest, "?", 2)
	addressPort := addressParts[0]

	addrPort := strings.SplitN(addressPort, ":", 2)
	if len(addrPort) != 2 {
		return ProxyNode{}, fmt.Errorf("invalid address:port")
	}

	address := addrPort[0]
	port := 0
	fmt.Sscanf(addrPort[1], "%d", &port)

	// 解析查询参数
	query := ""
	name := ""
	if len(addressParts) > 1 {
		queryAndName := addressParts[1]
		queryParts := strings.SplitN(queryAndName, "#", 2)
		query = queryParts[0]
		if len(queryParts) > 1 {
			name, _ = url.QueryUnescape(queryParts[1])
		}
	}

	params, _ := url.ParseQuery(query)

	node := ProxyNode{
		Name:     name,
		Protocol: "vless",
		Address:  address,
		Port:     port,
		Settings: map[string]interface{}{
			"id":         uuid,
			"encryption": params.Get("encryption"),
			"flow":       params.Get("flow"),
		},
	}

	// 构建 sing-box outbound 配置
	node.Outbound = map[string]interface{}{
		"type":        "vless",
		"tag":         SanitizeTag("vless", address, port),
		"server":      address,
		"server_port": port,
		"uuid":        uuid,
	}

	if flow := params.Get("flow"); flow != "" {
		node.Outbound["flow"] = flow
	}

	// 添加传输层配置
	network := params.Get("type")
	security := params.Get("security")

	if network != "" && network != "tcp" {
		transport := map[string]interface{}{
			"type": network,
		}

		if network == "ws" {
			if path := params.Get("path"); path != "" {
				transport["path"] = path
			}
			if host := params.Get("host"); host != "" {
				transport["headers"] = map[string]interface{}{
					"Host": host,
				}
			}
		}

		node.Outbound["transport"] = transport
	}

	// 添加 TLS 配置
	if security == "tls" || security == "reality" {
		tlsConfig := map[string]interface{}{
			"enabled": true,
		}
		if sni := params.Get("sni"); sni != "" {
			tlsConfig["server_name"] = sni
		}
		if security == "reality" {
			tlsConfig["reality"] = map[string]interface{}{
				"enabled":    true,
				"public_key": params.Get("pbk"),
				"short_id":   params.Get("sid"),
			}
		}
		// 添加 uTLS 配置 (Vision flow 必需)
		fp := params.Get("fp")
		if fp == "" {
			fp = "chrome" // 默认使用 chrome fingerprint
		}
		tlsConfig["utls"] = map[string]interface{}{
			"enabled":     true,
			"fingerprint": fp,
		}
		node.Outbound["tls"] = tlsConfig
	}

	return node, nil
}

// parseTrojanNode 解析 Trojan 节点
func parseTrojanNode(link string) (ProxyNode, error) {
	// 移除 trojan:// 前缀
	link = strings.TrimPrefix(link, "trojan://")

	// 解析 URL
	parts := strings.SplitN(link, "@", 2)
	if len(parts) != 2 {
		return ProxyNode{}, fmt.Errorf("invalid trojan link")
	}

	password := parts[0]
	rest := parts[1]

	// 解析地址和端口
	addressParts := strings.SplitN(rest, "?", 2)
	addressPort := addressParts[0]

	addrPort := strings.SplitN(addressPort, ":", 2)
	if len(addrPort) != 2 {
		return ProxyNode{}, fmt.Errorf("invalid address:port")
	}

	address := addrPort[0]
	port := 0
	fmt.Sscanf(addrPort[1], "%d", &port)

	// 解析查询参数
	name := ""
	query := ""
	if len(addressParts) > 1 {
		queryAndName := addressParts[1]
		if idx := strings.Index(queryAndName, "#"); idx != -1 {
			query = queryAndName[:idx]
			name, _ = url.QueryUnescape(queryAndName[idx+1:])
		} else {
			query = queryAndName
		}
	}

	params, _ := url.ParseQuery(query)

	node := ProxyNode{
		Name:     name,
		Protocol: "trojan",
		Address:  address,
		Port:     port,
		Settings: map[string]interface{}{
			"password": password,
		},
	}

	// 构建 sing-box outbound 配置
	node.Outbound = map[string]interface{}{
		"type":        "trojan",
		"tag":         SanitizeTag("trojan", address, port),
		"server":      address,
		"server_port": port,
		"password":    password,
	}

	// 添加传输层配置
	network := params.Get("type")
	if network != "" && network != "tcp" {
		transport := map[string]interface{}{
			"type": network,
		}

		if network == "ws" {
			if path := params.Get("path"); path != "" {
				transport["path"] = path
			}
			if host := params.Get("host"); host != "" {
				transport["headers"] = map[string]interface{}{
					"Host": host,
				}
			}
		}

		node.Outbound["transport"] = transport
	}

	// 添加 TLS 配置（Trojan 默认启用 TLS）
	tlsConfig := map[string]interface{}{
		"enabled": true,
	}
	if sni := params.Get("sni"); sni != "" {
		tlsConfig["server_name"] = sni
	}
	// 添加 uTLS 配置
	fp := params.Get("fp")
	if fp == "" {
		fp = "chrome" // 默认使用 chrome fingerprint
	}
	tlsConfig["utls"] = map[string]interface{}{
		"enabled":     true,
		"fingerprint": fp,
	}
	node.Outbound["tls"] = tlsConfig

	return node, nil
}

// parseShadowsocksNode 解析 Shadowsocks 节点
// 支持格式:
// 1. SIP002: ss://BASE64(method:password)@server:port#name
// 2. SS2022 多用户: ss://BASE64(method:serverKey:userKey)@server:port#name
// 3. 旧格式: ss://BASE64(method:password@server:port)#name
func parseShadowsocksNode(link string) (ProxyNode, error) {
	// 移除 ss:// 前缀
	link = strings.TrimPrefix(link, "ss://")

	// 分离链接和备注（如果有 # 符号）
	var name string
	linkParts := strings.SplitN(link, "#", 2)
	if len(linkParts) == 2 {
		link = linkParts[0]
		name, _ = url.QueryUnescape(linkParts[1])
	}

	// 尝试解析 SIP002 格式: method:password@server:port
	// 或 Base64(method:password)@server:port
	// 或 SS2022: Base64(method:serverKey:userKey)@server:port
	var method, password, address string
	var port int

	// 检查是否包含 @
	if strings.Contains(link, "@") {
		// 可能是 SIP002 格式或者 userinfo@host 格式
		parts := strings.SplitN(link, "@", 2)

		// 尝试 base64 解码第一部分（method:password 或 method:serverKey:userKey）
		userInfo, err := decodeBase64(parts[0])
		if err != nil {
			// 不是 base64，直接使用
			userInfo = []byte(parts[0])
		}

		// 解析 method:password 或 method:serverKey:userKey
		// 使用 SplitN(..., 2) 只在第一个冒号处分割
		// 这样对于 SS2022 格式，password 会是 "serverKey:userKey"
		userInfoStr := string(userInfo)
		colonIdx := strings.Index(userInfoStr, ":")
		if colonIdx == -1 {
			return ProxyNode{}, fmt.Errorf("invalid method:password format")
		}
		method = userInfoStr[:colonIdx]
		password = userInfoStr[colonIdx+1:]

		// 解析 server:port
		addressPort := strings.SplitN(parts[1], ":", 2)
		if len(addressPort) != 2 {
			return ProxyNode{}, fmt.Errorf("invalid address:port")
		}
		address = addressPort[0]
		fmt.Sscanf(addressPort[1], "%d", &port)
	} else {
		// 旧格式: 整个链接是 Base64 编码的 method:password@server:port
		decoded, err := decodeBase64(link)
		if err != nil {
			return ProxyNode{}, fmt.Errorf("failed to decode ss link: %w", err)
		}

		// 解析格式: method:password@server:port
		decodedStr := string(decoded)
		parts := strings.SplitN(decodedStr, "@", 2)
		if len(parts) != 2 {
			return ProxyNode{}, fmt.Errorf("invalid ss link format")
		}

		// 解析 method:password（支持 SS2022 多用户格式）
		colonIdx := strings.Index(parts[0], ":")
		if colonIdx == -1 {
			return ProxyNode{}, fmt.Errorf("invalid method:password")
		}
		method = parts[0][:colonIdx]
		password = parts[0][colonIdx+1:]

		addressPort := strings.SplitN(parts[1], ":", 2)
		if len(addressPort) != 2 {
			return ProxyNode{}, fmt.Errorf("invalid address:port")
		}

		address = addressPort[0]
		fmt.Sscanf(addressPort[1], "%d", &port)
	}

	if name == "" {
		name = fmt.Sprintf("SS-%s:%d", address, port)
	}

	node := ProxyNode{
		Name:     name,
		Protocol: "shadowsocks",
		Address:  address,
		Port:     port,
		Settings: map[string]interface{}{
			"method":   method,
			"password": password,
		},
	}

	// 构建 sing-box outbound 配置
	node.Outbound = map[string]interface{}{
		"type":        "shadowsocks",
		"tag":         SanitizeTag("ss", address, port),
		"server":      address,
		"server_port": port,
		"method":      method,
		"password":    password,
	}

	return node, nil
}

// parseIntOrZero 将字符串转换为整数，失败返回0
func parseIntOrZero(s string) int {
	var result int
	fmt.Sscanf(s, "%d", &result)
	return result
}

// SanitizeTag 生成规范的唯一节点 tag
// 格式: {protocol}-{address}-{port}
// 移除特殊字符，确保 tag 在 sing-box 配置中有效
func SanitizeTag(protocol, address string, port int) string {
	// 替换不安全的字符
	safeAddress := strings.ReplaceAll(address, ".", "_")
	safeAddress = strings.ReplaceAll(safeAddress, ":", "_")
	safeAddress = strings.ReplaceAll(safeAddress, "-", "_")
	return fmt.Sprintf("%s-%s-%d", protocol, safeAddress, port)
}

// 预定义 User-Agent 列表
var PredefinedUserAgents = map[string]string{
	"clash-verge": "clash-verge/v2.4.0",
	"clash-meta":  "ClashMeta/v1.18.0",
	"v2rayn":      "v2rayN/6.0",
	"v2rayng":     "v2rayNG/1.8.0",
	"default":     "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

// SubscriptionEntry 单个订阅条目
type SubscriptionEntry struct {
	ID             string      `json:"id"`
	Name           string      `json:"name"`
	URL            string      `json:"url"`
	UserAgent      string      `json:"user_agent,omitempty"`      // 请求时使用的 User-Agent
	AutoUpdate     bool        `json:"auto_update,omitempty"`     // 是否自动更新
	UpdateInterval int         `json:"update_interval,omitempty"` // 自动更新间隔（小时），0 表示禁用
	LastUpdated    string      `json:"last_updated,omitempty"`    // 最后更新时间 (RFC3339)
	Nodes          []ProxyNode `json:"nodes"`
}

// SubscriptionData 多订阅数据（兼容旧格式）
type SubscriptionData struct {
	// 旧格式字段（用于兼容）
	URL   string      `json:"url,omitempty"`
	Nodes []ProxyNode `json:"nodes,omitempty"`
	// 新格式字段
	Subscriptions []SubscriptionEntry `json:"subscriptions,omitempty"`
}

// getSubscriptionFilePath 获取订阅文件路径
// 注意：存放在 data 目录而非 singbox 目录，避免被 sing-box -C 加载
func getSubscriptionFilePath() string {
	baseDir := os.Getenv("DATA_DIR")
	if baseDir == "" {
		// 默认使用当前工作目录
		baseDir, _ = os.Getwd()
	}
	return filepath.Join(baseDir, "subscription.json")
}

// SaveSubscriptions 保存多订阅数据到文件
func SaveSubscriptions(data SubscriptionData) error {
	subscriptionFile := getSubscriptionFilePath()

	// 确保目录存在
	dir := filepath.Dir(subscriptionFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory: %w", err)
	}

	// 序列化为 JSON
	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal subscription data: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(subscriptionFile, jsonData, 0644); err != nil {
		return fmt.Errorf("failed to write subscription file: %w", err)
	}

	return nil
}

// LoadSubscriptions 从文件加载多订阅数据
func LoadSubscriptions() (*SubscriptionData, error) {
	subscriptionFile := getSubscriptionFilePath()

	// 检查文件是否存在
	if _, err := os.Stat(subscriptionFile); os.IsNotExist(err) {
		return &SubscriptionData{Subscriptions: []SubscriptionEntry{}}, nil
	}

	// 读取文件
	data, err := os.ReadFile(subscriptionFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read subscription file: %w", err)
	}

	// 反序列化
	var subData SubscriptionData
	if err := json.Unmarshal(data, &subData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal subscription data: %w", err)
	}

	// 兼容旧格式：如果有旧的 URL 字段但没有 subscriptions，迁移数据
	if subData.URL != "" && len(subData.Subscriptions) == 0 {
		subData.Subscriptions = []SubscriptionEntry{
			{
				ID:    generateSubscriptionID(),
				Name:  "默认订阅",
				URL:   subData.URL,
				Nodes: subData.Nodes,
			},
		}
		// 清空旧字段
		subData.URL = ""
		subData.Nodes = nil
		// 保存迁移后的数据
		SaveSubscriptions(subData)
	}

	if subData.Subscriptions == nil {
		subData.Subscriptions = []SubscriptionEntry{}
	}

	return &subData, nil
}

// generateSubscriptionID 生成订阅ID
func generateSubscriptionID() string {
	return fmt.Sprintf("sub_%d", time.Now().UnixNano())
}

// AddSubscription 添加订阅
func AddSubscription(name, subURL, userAgent string) (*SubscriptionEntry, error) {
	data, err := LoadSubscriptions()
	if err != nil {
		return nil, err
	}

	// 获取并解析订阅节点
	nodes, err := FetchSubscription(subURL, userAgent)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch subscription: %w", err)
	}

	entry := SubscriptionEntry{
		ID:          generateSubscriptionID(),
		Name:        name,
		URL:         subURL,
		UserAgent:   userAgent,
		LastUpdated: time.Now().Format(time.RFC3339),
		Nodes:       nodes,
	}

	data.Subscriptions = append(data.Subscriptions, entry)

	if err := SaveSubscriptions(*data); err != nil {
		return nil, err
	}

	return &entry, nil
}

// UpdateSubscription 更新订阅（刷新节点）
func UpdateSubscription(id string) (*SubscriptionEntry, error) {
	data, err := LoadSubscriptions()
	if err != nil {
		return nil, err
	}

	for i, sub := range data.Subscriptions {
		if sub.ID == id {
			// 重新获取节点（使用存储的 User-Agent）
			nodes, err := FetchSubscription(sub.URL, sub.UserAgent)
			if err != nil {
				return nil, fmt.Errorf("failed to fetch subscription: %w", err)
			}
			data.Subscriptions[i].Nodes = nodes
			data.Subscriptions[i].LastUpdated = time.Now().Format(time.RFC3339)

			if err := SaveSubscriptions(*data); err != nil {
				return nil, err
			}

			return &data.Subscriptions[i], nil
		}
	}

	return nil, fmt.Errorf("subscription not found: %s", id)
}

// UpdateSubscriptionSettings 更新订阅的自动更新设置
func UpdateSubscriptionSettings(id string, autoUpdate bool, updateInterval int) (*SubscriptionEntry, error) {
	data, err := LoadSubscriptions()
	if err != nil {
		return nil, err
	}

	for i, sub := range data.Subscriptions {
		if sub.ID == id {
			data.Subscriptions[i].AutoUpdate = autoUpdate
			data.Subscriptions[i].UpdateInterval = updateInterval
			if err := SaveSubscriptions(*data); err != nil {
				return nil, err
			}
			return &data.Subscriptions[i], nil
		}
	}

	return nil, fmt.Errorf("subscription not found: %s", id)
}

// DeleteSubscription 删除订阅
func DeleteSubscription(id string) error {
	data, err := LoadSubscriptions()
	if err != nil {
		return err
	}

	for i, sub := range data.Subscriptions {
		if sub.ID == id {
			data.Subscriptions = append(data.Subscriptions[:i], data.Subscriptions[i+1:]...)
			return SaveSubscriptions(*data)
		}
	}

	return fmt.Errorf("subscription not found: %s", id)
}

// GetAllNodes 获取所有订阅的所有节点
func GetAllNodes() ([]ProxyNode, error) {
	data, err := LoadSubscriptions()
	if err != nil {
		return nil, err
	}

	var allNodes []ProxyNode
	for _, sub := range data.Subscriptions {
		allNodes = append(allNodes, sub.Nodes...)
	}

	return allNodes, nil
}

// RefreshAllSubscriptions 刷新所有订阅
func RefreshAllSubscriptions() (*SubscriptionData, error) {
	data, err := LoadSubscriptions()
	if err != nil {
		return nil, err
	}

	for i, sub := range data.Subscriptions {
		nodes, err := FetchSubscription(sub.URL, sub.UserAgent)
		if err != nil {
			// 记录错误但继续处理其他订阅
			continue
		}
		data.Subscriptions[i].Nodes = nodes
	}

	if err := SaveSubscriptions(*data); err != nil {
		return nil, err
	}

	return data, nil
}

// ProbeResultUpdate 测速结果更新
type ProbeResultUpdate struct {
	Tag         string `json:"tag"`
	Latency     int64  `json:"latency"`
	Online      bool   `json:"online"`
	LastProbe   string `json:"last_probe"`
	SuccessRate int    `json:"success_rate"`
}

// UpdateProbeResults 更新节点测速结果到订阅文件
func UpdateProbeResults(results []ProbeResultUpdate) error {
	data, err := LoadSubscriptions()
	if err != nil {
		return err
	}

	// 构建 tag -> result 映射
	resultMap := make(map[string]ProbeResultUpdate)
	for _, r := range results {
		resultMap[r.Tag] = r
	}

	// 更新每个订阅中的节点测速结果
	for i := range data.Subscriptions {
		for j := range data.Subscriptions[i].Nodes {
			node := &data.Subscriptions[i].Nodes[j]
			// 获取节点的 tag
			tag := ""
			if node.Outbound != nil {
				if t, ok := node.Outbound["tag"].(string); ok {
					tag = t
				}
			}
			if tag == "" {
				tag = SanitizeTag(node.Protocol, node.Address, node.Port)
			}

			// 更新测速结果
			if result, exists := resultMap[tag]; exists {
				node.Latency = result.Latency
				node.Online = result.Online
				node.LastProbe = result.LastProbe
				node.SuccessRate = result.SuccessRate
			}
		}
	}

	return SaveSubscriptions(*data)
}

// SpeedTestUpdate 代理测速结果更新
type SpeedTestUpdate struct {
	Tag       string  `json:"tag"`
	Latency   int64   `json:"latency"`
	SpeedKBps float64 `json:"speed_kbps"`
	Online    bool    `json:"online"`
	LastProbe string  `json:"last_probe"`
}

// UpdateSpeedTestResults 写入代理测速结果到订阅文件（含速度）
func UpdateSpeedTestResults(results []SpeedTestUpdate) error {
	data, err := LoadSubscriptions()
	if err != nil {
		return err
	}
	m := make(map[string]SpeedTestUpdate, len(results))
	for _, r := range results {
		m[r.Tag] = r
	}
	for i := range data.Subscriptions {
		for j := range data.Subscriptions[i].Nodes {
			node := &data.Subscriptions[i].Nodes[j]
			tag := ""
			if node.Outbound != nil {
				if t, ok := node.Outbound["tag"].(string); ok {
					tag = t
				}
			}
			if tag == "" {
				tag = SanitizeTag(node.Protocol, node.Address, node.Port)
			}
			if r, ok := m[tag]; ok {
				node.Latency = r.Latency
				node.SpeedKBps = r.SpeedKBps
				node.Online = r.Online
				node.LastProbe = r.LastProbe
			}
		}
	}
	return SaveSubscriptions(*data)
}
