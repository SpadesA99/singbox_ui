package services

import (
	"context"
	"fmt"
	"math/rand"
	"net"
	"sort"
	"sync"
	"time"
)

// WarpEndpointResult 扫描到的 WARP 端点结果
type WarpEndpointResult struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	LatencyMs int    `json:"latency_ms"`
	Reachable bool   `json:"reachable"`
}

// WarpScanConfig 扫描配置
type WarpScanConfig struct {
	SamplePerRange int           // 每个 /24 采样数
	Timeout        time.Duration // 单次 TCP 连接超时
	Concurrency    int           // 并发数
	TopN           int           // 返回最快的 N 个
}

// DefaultWarpScanConfig 默认扫描配置
func DefaultWarpScanConfig() WarpScanConfig {
	return WarpScanConfig{
		SamplePerRange: 4,
		Timeout:        1500 * time.Millisecond,
		Concurrency:    32,
		TopN:           8,
	}
}

// warpIPRanges 公开的 WARP IPv4 段（取每个 /24 的若干随机主机号）
var warpIPRanges = []string{
	"162.159.192",
	"162.159.193",
	"162.159.195",
	"188.114.96",
	"188.114.97",
	"188.114.98",
	"188.114.99",
}

// warpEndpointPorts Cloudflare 提供的几个可用端口
var warpEndpointPorts = []int{2408, 500, 1701, 4500}

// ScanWarpEndpoints 扫描 WARP 可用端点并按延迟排序
//
// 说明:
// Cloudflare WARP 使用 UDP 协议, 无法用简单的 TCP Connect 测试 UDP 服务。
// 本实现采用 TCP/443 连通性作为"与该数据中心的地理 RTT"代理：同一 IP 段
// 下的 TCP 443 与 UDP 2408 由同一边缘 POP 提供, 延迟高度相关, 可用于挑选
// 距离最近的 Cloudflare 边缘节点。
func ScanWarpEndpoints(ctx context.Context, cfg WarpScanConfig) ([]WarpEndpointResult, error) {
	if cfg.SamplePerRange <= 0 {
		cfg.SamplePerRange = 4
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 1500 * time.Millisecond
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 32
	}
	if cfg.TopN <= 0 {
		cfg.TopN = 8
	}

	// 构造候选 IP 列表
	r := rand.New(rand.NewSource(time.Now().UnixNano()))
	candidates := make([]string, 0, len(warpIPRanges)*cfg.SamplePerRange)
	for _, prefix := range warpIPRanges {
		used := map[int]bool{}
		for len(used) < cfg.SamplePerRange {
			// 1..254 随机主机号
			host := r.Intn(254) + 1
			if used[host] {
				continue
			}
			used[host] = true
			candidates = append(candidates, fmt.Sprintf("%s.%d", prefix, host))
		}
	}

	type probe struct {
		ip      string
		latency int
		ok      bool
	}

	results := make([]probe, 0, len(candidates))
	var mu sync.Mutex

	sem := make(chan struct{}, cfg.Concurrency)
	var wg sync.WaitGroup

	// 使用 labeled break 正确跳出外层 for 循环;
	// 同时把 sem 获取放进 select, 这样 ctx 取消也能打断阻塞在"等空位"的调度
dispatch:
	for _, ip := range candidates {
		select {
		case <-ctx.Done():
			break dispatch
		case sem <- struct{}{}:
		}
		wg.Add(1)
		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()

			start := time.Now()
			d := net.Dialer{Timeout: cfg.Timeout}
			conn, err := d.DialContext(ctx, "tcp", net.JoinHostPort(ip, "443"))
			latency := int(time.Since(start) / time.Millisecond)
			if err != nil {
				mu.Lock()
				results = append(results, probe{ip: ip, latency: latency, ok: false})
				mu.Unlock()
				return
			}
			_ = conn.Close()
			mu.Lock()
			results = append(results, probe{ip: ip, latency: latency, ok: true})
			mu.Unlock()
		}(ip)
	}
	wg.Wait()

	// 过滤可达的, 按延迟升序
	reachable := make([]probe, 0, len(results))
	for _, r := range results {
		if r.ok {
			reachable = append(reachable, r)
		}
	}
	sort.Slice(reachable, func(i, j int) bool {
		return reachable[i].latency < reachable[j].latency
	})

	// 取 topN, 每个 IP 组合默认端口 2408
	topN := cfg.TopN
	if topN > len(reachable) {
		topN = len(reachable)
	}
	out := make([]WarpEndpointResult, 0, topN)
	for i := 0; i < topN; i++ {
		out = append(out, WarpEndpointResult{
			Host:      reachable[i].ip,
			Port:      warpDefaultPort,
			LatencyMs: reachable[i].latency,
			Reachable: true,
		})
	}

	if len(out) == 0 {
		return nil, fmt.Errorf("未扫描到可用的 WARP 端点")
	}
	return out, nil
}

// WarpEndpointPorts 返回 WARP 可用端口列表(供前端展示使用)
func WarpEndpointPorts() []int {
	ports := make([]int, len(warpEndpointPorts))
	copy(ports, warpEndpointPorts)
	return ports
}
