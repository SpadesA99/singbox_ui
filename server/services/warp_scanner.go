package services

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/rand"
	"net"
	"sort"
	"strconv"
	"sync"
	"time"
)

// WarpEndpointResult 扫描到的 WARP 端点结果
type WarpEndpointResult struct {
	Host      string `json:"host"`
	Port      int    `json:"port"`
	LatencyMs int    `json:"latency_ms"`
	LossPct   int    `json:"loss_pct"`
	Reachable bool   `json:"reachable"`
}

// WarpScanConfig 扫描配置
type WarpScanConfig struct {
	SamplePerRange int           // 每个 /24 采样的主机数
	PingTimes      int           // 每个端点握手次数
	Timeout        time.Duration // 单次握手超时
	Concurrency    int           // 并发探测数
	MaxCandidates  int           // 打乱后的候选上限
	TopN           int           // 返回最快的 N 个
}

// DefaultWarpScanConfig 默认扫描配置
//
// 设计依据:
// 8 个 CIDR × 4 采样 = 32 IP, × 54 端口 = 1728 组合
// 打乱后截断到 600, 并发 128, 每探测最多 3×1000ms → 约 14s 内完成.
func DefaultWarpScanConfig() WarpScanConfig {
	return WarpScanConfig{
		SamplePerRange: 4,
		PingTimes:      3,
		Timeout:        1000 * time.Millisecond,
		Concurrency:    128,
		MaxCandidates:  600,
		TopN:           8,
	}
}

// WARP 握手响应的固定长度 (WG MessageResponse)
const warpHandshakeResponseSize = 92

// warpHandshakePacketHex 预构造的 WireGuard 握手 init 包.
//
// 来自 CloudflareWarpSpeedTest, 合法性依赖于以下事实:
//   - 所有 CF WARP 边缘节点共享同一 peer public key
//     "bmXOC+F1FxEMF9dyiK2H5/1SUtzH0JuVo51h2wPfgyo="
//   - 包中 MAC1 只需对该 public key 有效即可被对端接受
//   - 任意有效的 init 包都会引发 92 字节的 MessageResponse
//
// 这样无需在扫描时引入 wireguard-go 依赖,
// 也不必用我们自己的设备私钥 (扫描目的只是探测连通性和延迟).
const warpHandshakePacketHex = "013cbdafb4135cac96a29484d7a0175ab152dd3e59be35049beadf758b8d48af14ca65f25a168934746fe8bc8867b1c17113d71c0fac5c141ef9f35783ffa5357c9871f4a006662b83ad71245a862495376a5fe3b4f2e1f06974d748416670e5f9b086297f652e6dfbf742fbfc63c3d8aeb175a3e9b7582fbc67c77577e4c0b32b05f92900000000000000000000000000000000"

var warpHandshakePacket []byte

func init() {
	p, err := hex.DecodeString(warpHandshakePacketHex)
	if err != nil {
		// 编译期常量, 若出错就是包损坏
		panic("invalid warp handshake hex: " + err.Error())
	}
	warpHandshakePacket = p
}

// warpIPRanges 公开的 WARP IPv4 /24 段前缀
var warpIPRanges = []string{
	"162.159.192",
	"162.159.193",
	"162.159.195",
	"162.159.204",
	"188.114.96",
	"188.114.97",
	"188.114.98",
	"188.114.99",
}

// warpEndpointPorts CF WARP 已知的可用 UDP 端口 (来自 CloudflareWarpSpeedTest)
var warpEndpointPorts = []int{
	500, 854, 859, 864, 878, 880, 890, 891, 894, 903,
	908, 928, 934, 939, 942, 943, 945, 946, 955, 968,
	987, 988, 1002, 1010, 1014, 1018, 1070, 1074, 1180, 1387,
	1701, 1843, 2371, 2408, 2506, 3138, 3476, 3581, 3854, 4177,
	4198, 4233, 4500, 5279, 5956, 7103, 7152, 7156, 7281, 7559,
	8319, 8742, 8854, 8886,
}

// ScanWarpEndpoints 扫描 WARP 可用端点并按丢包率和延迟排序
//
// 实现方式:
// 向候选 (IP, Port) 组合发送真正的 WireGuard 握手包, 检查是否能收到
// 92 字节的 MessageResponse (CF WARP 握手响应的固定长度).
// 这比用 TCP/443 连通性作代理更准确, 能直接反映 UDP 路径的 RTT 和丢包.
func ScanWarpEndpoints(ctx context.Context, cfg WarpScanConfig) ([]WarpEndpointResult, error) {
	if cfg.SamplePerRange <= 0 {
		cfg.SamplePerRange = 4
	}
	if cfg.PingTimes <= 0 {
		cfg.PingTimes = 3
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 1000 * time.Millisecond
	}
	if cfg.Concurrency <= 0 {
		cfg.Concurrency = 128
	}
	if cfg.MaxCandidates <= 0 {
		cfg.MaxCandidates = 600
	}
	if cfg.TopN <= 0 {
		cfg.TopN = 8
	}

	r := rand.New(rand.NewSource(time.Now().UnixNano()))

	// 每个 /24 采样若干主机号, 得到 IP 列表
	ips := make([]string, 0, len(warpIPRanges)*cfg.SamplePerRange)
	for _, prefix := range warpIPRanges {
		sample := cfg.SamplePerRange
		if sample > 254 {
			sample = 254
		}
		used := make(map[int]bool, sample)
		for len(used) < sample {
			host := r.Intn(254) + 1
			if used[host] {
				continue
			}
			used[host] = true
			ips = append(ips, fmt.Sprintf("%s.%d", prefix, host))
		}
	}

	// IP × Port 笛卡尔积
	type candidate struct {
		host string
		port int
	}
	cands := make([]candidate, 0, len(ips)*len(warpEndpointPorts))
	for _, ip := range ips {
		for _, p := range warpEndpointPorts {
			cands = append(cands, candidate{ip, p})
		}
	}
	// 打乱 + 截断, 避免一次扫描耗时过长
	r.Shuffle(len(cands), func(i, j int) { cands[i], cands[j] = cands[j], cands[i] })
	if len(cands) > cfg.MaxCandidates {
		cands = cands[:cfg.MaxCandidates]
	}

	type probe struct {
		host     string
		port     int
		received int
		totalRtt time.Duration
	}
	results := make([]probe, 0, len(cands))
	var mu sync.Mutex

	sem := make(chan struct{}, cfg.Concurrency)
	var wg sync.WaitGroup

	// 使用 labeled break 正确跳出外层 for;
	// sem 获取放进 select 以便 ctx 取消时能打断阻塞
dispatch:
	for _, cand := range cands {
		select {
		case <-ctx.Done():
			break dispatch
		case sem <- struct{}{}:
		}
		wg.Add(1)
		go func(host string, port int) {
			defer wg.Done()
			defer func() { <-sem }()

			recv, rtt := warpHandshakeProbe(ctx, host, port, cfg.PingTimes, cfg.Timeout)
			if recv == 0 {
				return
			}
			mu.Lock()
			results = append(results, probe{
				host:     host,
				port:     port,
				received: recv,
				totalRtt: rtt,
			})
			mu.Unlock()
		}(cand.host, cand.port)
	}
	wg.Wait()

	// 排序: 先按丢包率升序, 再按平均 RTT 升序
	sort.Slice(results, func(i, j int) bool {
		li := cfg.PingTimes - results[i].received
		lj := cfg.PingTimes - results[j].received
		if li != lj {
			return li < lj
		}
		ai := results[i].totalRtt / time.Duration(results[i].received)
		aj := results[j].totalRtt / time.Duration(results[j].received)
		return ai < aj
	})

	topN := cfg.TopN
	if topN > len(results) {
		topN = len(results)
	}
	out := make([]WarpEndpointResult, 0, topN)
	for i := 0; i < topN; i++ {
		p := results[i]
		avg := p.totalRtt / time.Duration(p.received)
		loss := (cfg.PingTimes - p.received) * 100 / cfg.PingTimes
		out = append(out, WarpEndpointResult{
			Host:      p.host,
			Port:      p.port,
			LatencyMs: int(avg / time.Millisecond),
			LossPct:   loss,
			Reachable: true,
		})
	}

	if len(out) == 0 {
		return nil, fmt.Errorf("未扫描到可用的 WARP 端点")
	}
	return out, nil
}

// warpHandshakeProbe 向单个 UDP 端点发送 PingTimes 次 WG 握手包,
// 返回收到的有效响应数和累计 RTT.
//
// 有效响应 = 长度恰好 92 字节的 MessageResponse;
// 其它任何回包 (ICMP unreachable 触发的 Read 错误、或长度不对) 都视为丢失.
func warpHandshakeProbe(ctx context.Context, host string, port int, times int, timeout time.Duration) (received int, totalRtt time.Duration) {
	addr := net.JoinHostPort(host, strconv.Itoa(port))
	d := net.Dialer{Timeout: timeout}
	conn, err := d.DialContext(ctx, "udp", addr)
	if err != nil {
		return 0, 0
	}
	defer conn.Close()

	buf := make([]byte, 1024)
	for i := 0; i < times; i++ {
		select {
		case <-ctx.Done():
			return
		default:
		}

		start := time.Now()
		if _, err := conn.Write(warpHandshakePacket); err != nil {
			// 瞬时写失败(如 ENETUNREACH): 与上游 handshake() 一致,
			// 只将本次 ping 记为丢失, 下一次 ping 仍然尝试
			continue
		}
		if err := conn.SetReadDeadline(time.Now().Add(timeout)); err != nil {
			continue
		}
		n, err := conn.Read(buf)
		if err != nil {
			// 超时或 ICMP unreachable: 记为丢失, 继续下一次
			continue
		}
		if n != warpHandshakeResponseSize {
			continue
		}
		received++
		totalRtt += time.Since(start)
	}
	return
}

// WarpEndpointPorts 返回 WARP 可用端口列表(供前端展示使用)
func WarpEndpointPorts() []int {
	ports := make([]int, len(warpEndpointPorts))
	copy(ports, warpEndpointPorts)
	return ports
}
