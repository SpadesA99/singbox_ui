package services

import (
	"context"
	"net"
	"testing"
	"time"
)

// 启动一个本地 UDP 监听, 按指定策略回复握手包.
// replySize > 0: 回一个 replySize 字节的响应 (用于模拟 92 字节合法响应或错误尺寸)
// replySize == 0: 不回复 (模拟超时)
// replySize < 0: 只在部分 ping 上回复, |replySize| 为回复的那一次序号 (1-based)
//
// 返回监听地址和关闭函数.
func startFakeWarpUDP(t *testing.T, replySize int) (string, func()) {
	t.Helper()
	addr, err := net.ResolveUDPAddr("udp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	done := make(chan struct{})

	go func() {
		defer close(done)
		buf := make([]byte, 2048)
		count := 0
		for {
			_ = conn.SetReadDeadline(time.Now().Add(3 * time.Second))
			n, src, err := conn.ReadFromUDP(buf)
			if err != nil {
				return
			}
			count++
			// 确认收到的是合法的 WARP 握手包 (148 字节)
			if n != len(warpHandshakePacket) {
				continue
			}

			switch {
			case replySize > 0:
				_, _ = conn.WriteToUDP(make([]byte, replySize), src)
			case replySize == 0:
				// 不回复
			case replySize < 0:
				// 只在第 |replySize| 次 ping 上回复 92 字节
				if count == -replySize {
					_, _ = conn.WriteToUDP(make([]byte, warpHandshakeResponseSize), src)
				}
			}
		}
	}()

	return conn.LocalAddr().String(), func() {
		_ = conn.Close()
		<-done
	}
}

// 验证: 当对端始终回复 92 字节时, probe 应该全部成功
func TestWarpHandshakeProbe_AllSuccess(t *testing.T) {
	addr, stop := startFakeWarpUDP(t, warpHandshakeResponseSize)
	defer stop()

	host, portStr, _ := net.SplitHostPort(addr)
	var port int
	if _, err := net.ResolveUDPAddr("udp", addr); err != nil {
		t.Fatal(err)
	}
	// 简单手写端口解析
	for _, c := range portStr {
		port = port*10 + int(c-'0')
	}

	ctx := context.Background()
	recv, totalRtt := warpHandshakeProbe(ctx, host, port, 3, 500*time.Millisecond)
	if recv != 3 {
		t.Errorf("expected 3 received, got %d", recv)
	}
	// 本地回环下 RTT 可能为纳秒级, 甚至低于时钟分辨率而得到 0, 只断言非负
	if totalRtt < 0 {
		t.Errorf("expected totalRtt >= 0, got %v", totalRtt)
	}
}

// 验证: 当对端不回复时, probe 应该全部失败, 但不 panic
func TestWarpHandshakeProbe_Timeout(t *testing.T) {
	addr, stop := startFakeWarpUDP(t, 0)
	defer stop()

	host, portStr, _ := net.SplitHostPort(addr)
	var port int
	for _, c := range portStr {
		port = port*10 + int(c-'0')
	}

	ctx := context.Background()
	start := time.Now()
	recv, _ := warpHandshakeProbe(ctx, host, port, 2, 200*time.Millisecond)
	elapsed := time.Since(start)

	if recv != 0 {
		t.Errorf("expected 0 received on timeout, got %d", recv)
	}
	// 2 次 ping × 200ms ≈ 400ms (加一点调度余量)
	if elapsed > 1500*time.Millisecond {
		t.Errorf("probe took too long: %v", elapsed)
	}
}

// 验证: 当对端回复长度错误时, 不计为成功
func TestWarpHandshakeProbe_WrongSize(t *testing.T) {
	addr, stop := startFakeWarpUDP(t, 50) // 错误大小
	defer stop()

	host, portStr, _ := net.SplitHostPort(addr)
	var port int
	for _, c := range portStr {
		port = port*10 + int(c-'0')
	}

	ctx := context.Background()
	recv, _ := warpHandshakeProbe(ctx, host, port, 3, 300*time.Millisecond)
	if recv != 0 {
		t.Errorf("expected 0 received on wrong size, got %d", recv)
	}
}

// 验证: 混合情况 - 只在第 2 次 ping 回复时, 应收到 1 个响应
func TestWarpHandshakeProbe_PartialSuccess(t *testing.T) {
	addr, stop := startFakeWarpUDP(t, -2) // 仅第 2 次回复
	defer stop()

	host, portStr, _ := net.SplitHostPort(addr)
	var port int
	for _, c := range portStr {
		port = port*10 + int(c-'0')
	}

	ctx := context.Background()
	recv, totalRtt := warpHandshakeProbe(ctx, host, port, 3, 300*time.Millisecond)
	if recv != 1 {
		t.Errorf("expected 1 received, got %d", recv)
	}
	if totalRtt < 0 {
		t.Errorf("expected totalRtt >= 0, got %v", totalRtt)
	}
}

// 验证: ctx 取消时 probe 提前退出
func TestWarpHandshakeProbe_ContextCancel(t *testing.T) {
	addr, stop := startFakeWarpUDP(t, 0)
	defer stop()

	host, portStr, _ := net.SplitHostPort(addr)
	var port int
	for _, c := range portStr {
		port = port*10 + int(c-'0')
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()

	start := time.Now()
	warpHandshakeProbe(ctx, host, port, 10, 500*time.Millisecond)
	elapsed := time.Since(start)

	// ctx 50ms 取消, 单次 Read deadline 500ms. 即使当前 Read 已阻塞,
	// 最长也就 500ms + 少量调度. 不应该跑满 10 × 500 = 5000ms.
	if elapsed > 1500*time.Millisecond {
		t.Errorf("probe did not honor ctx cancel: %v", elapsed)
	}
}
