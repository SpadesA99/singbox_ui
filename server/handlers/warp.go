package handlers

import (
	"context"
	"io"
	"net/http"
	"singbox-config-service/services"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
)

// warpScanInFlight 全局扫描互斥标记: 防止并发扫描产生指数级 TCP dial
var warpScanInFlight atomic.Bool

// warpRegisterInFlight 全局注册互斥标记: 防止双击/并发导致孤儿账户,
// 因 CF /reg 每次调用都会创建新设备, 重复注册会浪费配额并使先前的
// bearer token 失效(先前的 warp-account.json 被后写入的记录覆盖).
var warpRegisterInFlight atomic.Bool

// warpRegisterMaxBody 注册请求体上限: 防止恶意大体消耗内存
const warpRegisterMaxBody = 8 * 1024

// warpAccountView 对前端暴露的账户信息(不含 token)
type warpAccountView struct {
	Exists    bool   `json:"exists"`
	ID        string `json:"id,omitempty"`
	License   string `json:"license,omitempty"`
	Type      string `json:"type,omitempty"`
	WarpPlus  bool   `json:"warp_plus,omitempty"`
	V4        string `json:"v4,omitempty"`
	V6        string `json:"v6,omitempty"`
	CreatedAt string `json:"created_at,omitempty"`
	UpdatedAt string `json:"updated_at,omitempty"`
}

func recordToView(rec *services.WarpRecord) warpAccountView {
	if rec == nil {
		return warpAccountView{Exists: false}
	}
	return warpAccountView{
		Exists:    true,
		ID:        rec.Device.ID,
		License:   rec.Device.Account.License,
		Type:      rec.Device.Account.AccountType,
		WarpPlus:  rec.Device.Account.WarpPlus,
		V4:        rec.Device.Config.Interface.Addresses.V4,
		V6:        rec.Device.Config.Interface.Addresses.V6,
		CreatedAt: rec.CreatedAt,
		UpdatedAt: rec.UpdatedAt,
	}
}

// GetWarpAccount GET /api/warp/account — 查询本地已缓存的 WARP 账户
func GetWarpAccount(c *gin.Context) {
	rec, err := services.LoadWarpRecord()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recordToView(rec))
}

// DeleteWarpAccount DELETE /api/warp/account — 删除本地 WARP 账户缓存
func DeleteWarpAccount(c *gin.Context) {
	if err := services.DeleteWarpRecord(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}

// WarpRegisterRequest POST /api/warp/register 请求体
type WarpRegisterRequest struct {
	Force        bool   `json:"force"`         // true: 忽略缓存,强制重新注册
	License      string `json:"license"`       // 可选:若提供则同时绑定 WARP+ 许可证
	EndpointHost string `json:"endpoint_host"` // 可选:自定义对端 Host(默认 engage.cloudflareclient.com)
	EndpointPort int    `json:"endpoint_port"` // 可选:自定义对端端口(默认 2408)
	MTU          int    `json:"mtu"`           // 可选:MTU(默认 1280)
}

// WarpRegisterResponse POST /api/warp/register 响应体
type WarpRegisterResponse struct {
	Account  warpAccountView        `json:"account"`
	Outbound map[string]interface{} `json:"outbound"`
}

// RegisterWarp POST /api/warp/register — 注册 WARP 并生成出站配置
func RegisterWarp(c *gin.Context) {
	// 并发互斥: 避免前端双击或多标签并发调用导致 CF 侧产生多个孤儿设备,
	// 后写入的 warp-account.json 会覆盖先前的 bearer token 使之失效.
	if !warpRegisterInFlight.CompareAndSwap(false, true) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "register already running"})
		return
	}
	defer warpRegisterInFlight.Store(false)

	// Body 大小限制: WarpRegisterRequest 只含少量字段, 8KB 远超合理上限
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, warpRegisterMaxBody)

	var req WarpRegisterRequest
	// 接受空请求体(io.EOF),但拒绝格式错误的 JSON —— 否则字段会被静默置零
	if err := c.ShouldBindJSON(&req); err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body: " + err.Error()})
		return
	}

	// 先读缓存; 同时校验缓存的完整性,损坏的缓存视为未注册
	var rec *services.WarpRecord
	if !req.Force {
		r, err := services.LoadWarpRecord()
		if err == nil && r != nil && r.Device.ID != "" && len(r.Device.Config.Peers) > 0 {
			rec = r
		}
	}

	// 缓存缺失或强制,则注册新设备
	if rec == nil {
		r, err := services.RegisterWarpDevice()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		rec = r
	}

	// 若提供 license 则绑定 WARP+
	if req.License != "" && rec.Device.Account.License != req.License {
		r, err := services.BindWarpLicense(rec, req.License)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		rec = r
	}

	outbound, err := services.BuildWarpOutbound(rec, req.EndpointHost, req.EndpointPort, req.MTU)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, WarpRegisterResponse{
		Account:  recordToView(rec),
		Outbound: outbound,
	})
}

// WarpBindLicenseRequest POST /api/warp/license 请求体
type WarpBindLicenseRequest struct {
	License string `json:"license"`
}

// BindWarpLicense POST /api/warp/license — 为已注册设备绑定 WARP+ 许可证
func BindWarpLicense(c *gin.Context) {
	// Body 大小限制: license 字符串很短, 8KB 足以防御恶意大包
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, warpRegisterMaxBody)

	var req WarpBindLicenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.License == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "license 不能为空"})
		return
	}
	rec, err := services.LoadWarpRecord()
	if err != nil || rec == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请先注册 WARP 设备"})
		return
	}
	rec, err = services.BindWarpLicense(rec, req.License)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recordToView(rec))
}

// ScanWarpEndpoints POST /api/warp/scan — 扫描可用的 Cloudflare 边缘端点
func ScanWarpEndpoints(c *gin.Context) {
	// 扫描互斥: 避免并发请求放大 TCP dial 数量
	if !warpScanInFlight.CompareAndSwap(false, true) {
		c.JSON(http.StatusTooManyRequests, gin.H{"error": "scan already running"})
		return
	}
	defer warpScanInFlight.Store(false)

	// Body 大小限制: 扫描请求只含少量整数, 8KB 足够
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, warpRegisterMaxBody)

	cfg := services.DefaultWarpScanConfig()

	var body struct {
		SamplePerRange int `json:"sample_per_range"`
		TimeoutMs      int `json:"timeout_ms"`
		TopN           int `json:"top_n"`
	}
	if err := c.ShouldBindJSON(&body); err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body: " + err.Error()})
		return
	}
	// 参数越界时显式 400, 而不是静默降级到默认值 —— 否则用户调大参数不会察觉无效
	if body.SamplePerRange != 0 {
		if body.SamplePerRange < 1 || body.SamplePerRange > 32 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "sample_per_range must be in [1, 32]"})
			return
		}
		cfg.SamplePerRange = body.SamplePerRange
	}
	if body.TimeoutMs != 0 {
		if body.TimeoutMs < 100 || body.TimeoutMs > 5000 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "timeout_ms must be in [100, 5000]"})
			return
		}
		cfg.Timeout = time.Duration(body.TimeoutMs) * time.Millisecond
	}
	if body.TopN != 0 {
		if body.TopN < 1 || body.TopN > 32 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "top_n must be in [1, 32]"})
			return
		}
		cfg.TopN = body.TopN
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	results, err := services.ScanWarpEndpoints(ctx, cfg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"endpoints": results,
		"ports":     services.WarpEndpointPorts(),
	})
}
