package services

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Cloudflare WARP API 常量
const (
	warpAPIBase     = "https://api.cloudflareclient.com"
	warpAPIVersion  = "v0a2158"
	warpClientUA    = "okhttp/3.12.1"
	warpClientVer   = "a-6.11-2158"
	warpDefaultHost = "engage.cloudflareclient.com"
	warpDefaultPort = 2408
)

// WarpInterfaceAddr WARP 下发的客户端地址
type WarpInterfaceAddr struct {
	V4 string `json:"v4"`
	V6 string `json:"v6"`
}

// WarpPeerEndpoint WARP 对端地址信息
type WarpPeerEndpoint struct {
	Host string `json:"host"`
	V4   string `json:"v4"`
	V6   string `json:"v6"`
}

// WarpPeer WARP 对端配置
type WarpPeer struct {
	PublicKey string           `json:"public_key"`
	Endpoint  WarpPeerEndpoint `json:"endpoint"`
}

// WarpInterface 本地接口配置
type WarpInterface struct {
	Addresses WarpInterfaceAddr `json:"addresses"`
}

// WarpConfig 设备下发的 WG 配置
type WarpConfig struct {
	ClientID  string        `json:"client_id"`
	Interface WarpInterface `json:"interface"`
	Peers     []WarpPeer    `json:"peers"`
}

// WarpAccount 账户信息
type WarpAccount struct {
	ID                string `json:"id"`
	License           string `json:"license"`
	AccountType       string `json:"account_type"`
	PremiumData       int64  `json:"premium_data"`
	WarpPlus          bool   `json:"warp_plus"`
	ReferralCount     int    `json:"referral_count"`
	ReferralRenewalEn int64  `json:"referral_renewal_countdown"`
}

// WarpRegisterResponse /reg 返回体
type WarpRegisterResponse struct {
	ID      string      `json:"id"`
	Token   string      `json:"token"`
	Account WarpAccount `json:"account"`
	Config  WarpConfig  `json:"config"`
}

// WarpRecord 本地持久化的 WARP 设备记录
type WarpRecord struct {
	PrivateKey string               `json:"private_key"`
	PublicKey  string               `json:"public_key"`
	Device     WarpRegisterResponse `json:"device"`
	CreatedAt  string               `json:"created_at"`
	UpdatedAt  string               `json:"updated_at,omitempty"`
}

func warpRecordPath() string {
	return filepath.Join(singboxDir, "warp-account.json")
}

// LoadWarpRecord 读取已缓存的 WARP 记录（不存在则返回 nil, nil）
func LoadWarpRecord() (*WarpRecord, error) {
	path := warpRecordPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil, nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var rec WarpRecord
	if err := json.Unmarshal(data, &rec); err != nil {
		return nil, err
	}
	return &rec, nil
}

// SaveWarpRecord 保存 WARP 记录
// 文件权限 0600: 内含 WireGuard 私钥与 Cloudflare Bearer Token, 必须只读于进程所有者
func SaveWarpRecord(rec *WarpRecord) error {
	if err := os.MkdirAll(singboxDir, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return err
	}
	path := warpRecordPath()
	if err := os.WriteFile(path, data, 0600); err != nil {
		return err
	}
	// 兜底: 若文件已存在且权限宽松, 显式 chmod
	_ = os.Chmod(path, 0600)
	return nil
}

// DeleteWarpRecord 删除本地 WARP 记录
func DeleteWarpRecord() error {
	path := warpRecordPath()
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return nil
	}
	return os.Remove(path)
}

// warpHTTPClient 统一的 HTTP 客户端
func warpHTTPClient() *http.Client {
	return &http.Client{Timeout: 30 * time.Second}
}

// randomHexStr 返回 n 字节随机十六进制串（去除 secret 用途）
func randomHexStr(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// RegisterWarpDevice 通过 Cloudflare API 注册新的 WARP 设备
func RegisterWarpDevice() (*WarpRecord, error) {
	privKey, err := generatePrivateKey()
	if err != nil {
		return nil, fmt.Errorf("生成私钥失败: %w", err)
	}
	pubKey, err := generatePublicKey(privKey)
	if err != nil {
		return nil, fmt.Errorf("生成公钥失败: %w", err)
	}

	serial, err := randomHexStr(8)
	if err != nil {
		return nil, err
	}

	body := map[string]interface{}{
		"key":           pubKey,
		"install_id":    "",
		"fcm_token":     "",
		"tos":           time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		"model":         "PC",
		"serial_number": serial,
		"locale":        "en_US",
	}
	payload, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s/reg", warpAPIBase, warpAPIVersion)
	req, err := http.NewRequest("POST", url, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("User-Agent", warpClientUA)
	req.Header.Set("CF-Client-Version", warpClientVer)

	resp, err := warpHTTPClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("WARP 注册请求失败: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("WARP 注册失败 HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var regResp WarpRegisterResponse
	if err := json.Unmarshal(respBody, &regResp); err != nil {
		return nil, fmt.Errorf("解析 WARP 响应失败: %w", err)
	}
	if len(regResp.Config.Peers) == 0 {
		return nil, fmt.Errorf("WARP 响应缺少 peer 配置")
	}

	now := time.Now().Format(time.RFC3339)
	rec := &WarpRecord{
		PrivateKey: privKey,
		PublicKey:  pubKey,
		Device:     regResp,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	if err := SaveWarpRecord(rec); err != nil {
		return nil, fmt.Errorf("保存 WARP 记录失败: %w", err)
	}
	return rec, nil
}

// BindWarpLicense 为已注册的 WARP 设备绑定 WARP+ 许可证
func BindWarpLicense(rec *WarpRecord, license string) (*WarpRecord, error) {
	if rec == nil {
		return nil, fmt.Errorf("请先注册 WARP 设备")
	}
	if license == "" {
		return nil, fmt.Errorf("license 不能为空")
	}
	if rec.Device.Token == "" || rec.Device.ID == "" {
		return nil, fmt.Errorf("当前 WARP 记录缺少 token 或设备 ID")
	}

	// Step 1: PUT /reg/{id}/account — 更新 license
	body, err := json.Marshal(map[string]string{"license": license})
	if err != nil {
		return nil, err
	}
	url := fmt.Sprintf("%s/%s/reg/%s/account", warpAPIBase, warpAPIVersion, rec.Device.ID)
	req, err := http.NewRequest("PUT", url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=UTF-8")
	req.Header.Set("User-Agent", warpClientUA)
	req.Header.Set("CF-Client-Version", warpClientVer)
	req.Header.Set("Authorization", "Bearer "+rec.Device.Token)

	resp, err := warpHTTPClient().Do(req)
	if err != nil {
		return nil, fmt.Errorf("绑定 license 请求失败: %w", err)
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("绑定 license 失败 HTTP %d: %s", resp.StatusCode, string(respBody))
	}
	var acct WarpAccount
	if err := json.Unmarshal(respBody, &acct); err != nil {
		return nil, fmt.Errorf("解析 license 响应失败: %w", err)
	}

	rec.Device.Account = acct

	// Step 2: PATCH /reg/{id} — 某些 license 绑定后需要刷新设备信息（可选，忽略错误）
	_ = refreshWarpDevice(rec)

	rec.UpdatedAt = time.Now().Format(time.RFC3339)
	if err := SaveWarpRecord(rec); err != nil {
		return nil, fmt.Errorf("保存 WARP 记录失败: %w", err)
	}
	return rec, nil
}

// refreshWarpDevice 拉取最新的设备信息并更新 config/account
func refreshWarpDevice(rec *WarpRecord) error {
	url := fmt.Sprintf("%s/%s/reg/%s", warpAPIBase, warpAPIVersion, rec.Device.ID)
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", warpClientUA)
	req.Header.Set("CF-Client-Version", warpClientVer)
	req.Header.Set("Authorization", "Bearer "+rec.Device.Token)
	resp, err := warpHTTPClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	var latest WarpRegisterResponse
	if err := json.Unmarshal(data, &latest); err != nil {
		return err
	}
	// 防御: 只在 latest 拿到完整设备信息时才覆盖旧记录,
	// 否则保留旧数据避免部分响应破坏已持久化的配置
	if latest.ID == "" || len(latest.Config.Peers) == 0 {
		return fmt.Errorf("refresh returned incomplete record")
	}
	// token 不在 GET /reg 的返回中,需要保留
	token := rec.Device.Token
	rec.Device = latest
	rec.Device.Token = token
	return nil
}

// decodeWarpClientID 尝试多种 base64 编码解析 client_id
// CF API 可能返回不带 padding 的 base64,也可能是 URL-safe 变体
func decodeWarpClientID(cid string) ([]byte, error) {
	if cid == "" {
		return nil, fmt.Errorf("empty client_id")
	}
	encs := []*base64.Encoding{
		base64.StdEncoding,
		base64.RawStdEncoding,
		base64.URLEncoding,
		base64.RawURLEncoding,
	}
	for _, enc := range encs {
		if b, err := enc.DecodeString(cid); err == nil && len(b) >= 3 {
			return b, nil
		}
	}
	return nil, fmt.Errorf("client_id is not valid base64")
}

// BuildWarpOutbound 将 WARP 记录转换为 sing-box wireguard 出站配置
func BuildWarpOutbound(rec *WarpRecord, endpointHost string, endpointPort int, mtu int) (map[string]interface{}, error) {
	if rec == nil {
		return nil, fmt.Errorf("WARP 记录为空")
	}
	if len(rec.Device.Config.Peers) == 0 {
		return nil, fmt.Errorf("WARP 记录缺少 peer 配置")
	}

	// 解析 client_id → reserved 三字节
	// client_id 非空但解码失败时,返回错误而非静默构造不完整出站
	var reserved []int
	if rec.Device.Config.ClientID != "" {
		raw, err := decodeWarpClientID(rec.Device.Config.ClientID)
		if err != nil {
			return nil, fmt.Errorf("解析 WARP client_id 失败: %w", err)
		}
		reserved = []int{int(raw[0]), int(raw[1]), int(raw[2])}
	}

	host := endpointHost
	if host == "" {
		host = warpDefaultHost
	}
	port := endpointPort
	if port == 0 {
		port = warpDefaultPort
	}
	if mtu <= 0 || mtu > 1500 {
		mtu = 1280
	}

	v4 := rec.Device.Config.Interface.Addresses.V4
	v6 := rec.Device.Config.Interface.Addresses.V6
	addresses := []string{}
	if v4 != "" {
		if !strings.Contains(v4, "/") {
			v4 += "/32"
		}
		addresses = append(addresses, v4)
	}
	if v6 != "" {
		if !strings.Contains(v6, "/") {
			v6 += "/128"
		}
		addresses = append(addresses, v6)
	}
	if len(addresses) == 0 {
		return nil, fmt.Errorf("WARP 记录缺少客户端地址")
	}

	peer := rec.Device.Config.Peers[0]
	peerMap := map[string]interface{}{
		"address":     host,
		"port":        port,
		"public_key":  peer.PublicKey,
		"allowed_ips": []string{"0.0.0.0/0", "::/0"},
	}
	if len(reserved) == 3 {
		peerMap["reserved"] = reserved
	}

	return map[string]interface{}{
		"type":        "wireguard",
		"tag":         "proxy_out",
		"address":     addresses,
		"private_key": rec.PrivateKey,
		"mtu":         mtu,
		"peers":       []interface{}{peerMap},
	}, nil
}
