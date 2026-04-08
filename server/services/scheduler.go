package services

import (
	"encoding/json"
	"log"
	"sync"
	"time"
)

// schedulerMu 防止调度器自身重入，以及与 HTTP handler 的并发冲突
var schedulerMu sync.Mutex

// proxyOutboundTypes 已知代理出站类型白名单（排除系统类型）
var proxyOutboundTypes = map[string]bool{
	"vless":        true,
	"vmess":        true,
	"trojan":       true,
	"shadowsocks":  true,
	"hysteria2":    true,
	"tuic":         true,
	"wireguard":    true,
	"socks":        true,
	"http":         true,
	"ssh":          true,
	"anytls":       true,
	"shadowtls":    true,
	"naive":        true,
}

// StartAutoUpdateScheduler 启动订阅自动更新调度器（后台 goroutine，每分钟检查一次）
func StartAutoUpdateScheduler() {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("[scheduler] PANIC recovered: %v — scheduler stopped", r)
			}
		}()
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			safeCheckAndAutoUpdate()
		}
	}()
	log.Println("Auto-update scheduler started")
}

// safeCheckAndAutoUpdate 带 recover 的单次检查，防止单次 panic 杀死 goroutine
func safeCheckAndAutoUpdate() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[scheduler] PANIC in check cycle: %v", r)
		}
	}()
	checkAndAutoUpdateSubscriptions()
}

// checkAndAutoUpdateSubscriptions 检查并自动更新到期的订阅
func checkAndAutoUpdateSubscriptions() {
	data, err := LoadSubscriptions()
	if err != nil {
		return
	}

	now := time.Now()
	for _, sub := range data.Subscriptions {
		if !sub.AutoUpdate || sub.UpdateInterval <= 0 {
			continue
		}

		needUpdate := true
		if sub.LastUpdated != "" {
			lastUpdated, err := time.Parse(time.RFC3339, sub.LastUpdated)
			if err != nil {
				// 格式损坏，记录错误并跳过本次更新，避免无限重试
				log.Printf("[scheduler] Failed to parse LastUpdated for %s (%q): %v — skipping", sub.Name, sub.LastUpdated, err)
				needUpdate = false
			} else {
				elapsed := now.Sub(lastUpdated)
				if elapsed < time.Duration(sub.UpdateInterval)*time.Hour {
					needUpdate = false
				}
			}
		}

		if needUpdate {
			log.Printf("[scheduler] Auto-updating subscription: %s", sub.Name)
			updated, err := UpdateSubscription(sub.ID)
			if err != nil {
				log.Printf("[scheduler] Failed to auto-update subscription %s: %v", sub.Name, err)
				continue
			}
			log.Printf("[scheduler] Auto-update success: %s (%d nodes)", sub.Name, len(updated.Nodes))

			if len(updated.Nodes) == 0 {
				log.Printf("[scheduler] Empty node list for %s, skipping container sync", sub.Name)
				continue
			}

			applySubscriptionToRunningContainers(updated.Nodes)
		}
	}
}

// applySubscriptionToRunningContainers 将订阅节点更新应用到正在运行的容器
func applySubscriptionToRunningContainers(nodes []ProxyNode) {
	// 构建 name -> node 映射（备用匹配）
	nodeByName := make(map[string]ProxyNode, len(nodes))
	for _, n := range nodes {
		if n.Name != "" {
			nodeByName[n.Name] = n
		}
	}

	// 加载 tag -> nodeName 旁路映射
	tagToName := LoadNodeMapping()

	// 1. 默认容器 (singboxDir/config.json)
	applyToDefaultContainer(tagToName, nodeByName)

	// 2. 所有命名实例 (singboxDir/configs/*/config.json)
	applyToNamedContainers(tagToName, nodeByName)
}

// applyToDefaultContainer 更新默认容器配置
func applyToDefaultContainer(tagToName map[string]string, nodeByName map[string]ProxyNode) {
	configData, err := GetConfig()
	if err != nil {
		return
	}

	updated, changed := injectNodeIntoConfig(configData, tagToName, nodeByName)
	if !changed {
		return
	}

	restartWithNewConfig(
		updated, configData,
		func(data []byte) error { _, err := SaveConfig(data); return err },
		func() (bool, string) { return CheckContainerRunning() },
		func() error { return StopSingboxContainer() },
		func() error { _, err := RunSingboxContainer(); return err },
		"default",
	)
}

// applyToNamedContainers 更新所有命名实例配置
func applyToNamedContainers(tagToName map[string]string, nodeByName map[string]ProxyNode) {
	configs, err := ListNamedConfigs()
	if err != nil {
		return
	}

	for _, cfg := range configs {
		name := cfg.Name
		configData, err := LoadNamedConfigFromDir(name)
		if err != nil {
			continue
		}

		updated, changed := injectNodeIntoConfig(configData, tagToName, nodeByName)
		if !changed {
			continue
		}

		running := cfg.Running
		restartWithNewConfig(
			updated, configData,
			func(data []byte) error { return SaveNamedConfigWithDir(name, data) },
			func() (bool, string) {
				if !running {
					return false, ""
				}
				return GetNamedContainerStatus(name)
			},
			func() error { return StopNamedContainer(name) },
			func() error { _, err := RunNamedContainer(name); return err },
			"instance:"+name,
		)
	}
}

// restartWithNewConfig 保存新配置并重启容器，失败时回滚旧配置
func restartWithNewConfig(
	newConfig, oldConfig []byte,
	saveFn func([]byte) error,
	isRunningFn func() (bool, string),
	stopFn func() error,
	runFn func() error,
	label string,
) {
	schedulerMu.Lock()
	defer schedulerMu.Unlock()

	if err := saveFn(newConfig); err != nil {
		log.Printf("[scheduler] Failed to save config for %s: %v", label, err)
		return
	}

	running, _ := isRunningFn()
	if !running {
		log.Printf("[scheduler] Config updated for %s (container not running)", label)
		return
	}

	log.Printf("[scheduler] Restarting %s after subscription update", label)

	if err := stopFn(); err != nil {
		log.Printf("[scheduler] Failed to stop %s: %v", label, err)
		return
	}

	if err := runFn(); err != nil {
		log.Printf("[scheduler] CRITICAL: Failed to restart %s: %v — rolling back config", label, err)
		// 回滚旧配置
		if rbErr := saveFn(oldConfig); rbErr != nil {
			log.Printf("[scheduler] CRITICAL: Rollback also failed for %s: %v", label, rbErr)
			return
		}
		// 尝试用旧配置重启
		if err2 := runFn(); err2 != nil {
			log.Printf("[scheduler] CRITICAL: Rollback restart also failed for %s: %v — service is down", label, err2)
		} else {
			log.Printf("[scheduler] Rolled back and restarted %s with old config", label)
		}
		return
	}

	log.Printf("[scheduler] %s restarted with updated node config", label)
}

// injectNodeIntoConfig 在 config JSON 中找到匹配的 outbound 并增量更新节点数据
// 匹配优先级：1) tag->name 映射 + nodeByName  2) 无法匹配则跳过
func injectNodeIntoConfig(configData []byte, tagToName map[string]string, nodeByName map[string]ProxyNode) ([]byte, bool) {
	var cfg map[string]interface{}
	if err := json.Unmarshal(configData, &cfg); err != nil {
		return configData, false
	}

	outboundsRaw, ok := cfg["outbounds"]
	if !ok {
		return configData, false
	}
	outbounds, ok := outboundsRaw.([]interface{})
	if !ok || len(outbounds) == 0 {
		return configData, false
	}

	changed := false
	for i, ob := range outbounds {
		obMap, ok := ob.(map[string]interface{})
		if !ok {
			continue
		}
		obType, _ := obMap["type"].(string)
		// 白名单：只处理已知代理类型
		if !proxyOutboundTypes[obType] {
			continue
		}
		tag, _ := obMap["tag"].(string)
		if tag == "" {
			continue
		}

		// 通过 tag->name 映射找到节点名，再从 nodeByName 找到新节点
		nodeName, hasMapped := tagToName[tag]
		if !hasMapped {
			continue
		}
		node, found := nodeByName[nodeName]
		if !found || node.Outbound == nil {
			continue
		}

		// 增量覆盖：在原 outbound 基础上覆盖连接相关字段，保留用户自定义字段
		newOb := make(map[string]interface{})
		for k, v := range obMap {
			newOb[k] = v
		}
		// 覆盖节点核心连接字段
		for k, v := range node.Outbound {
			newOb[k] = v
		}
		// 强制保留原 tag（路由规则引用的是原 tag）
		newOb["tag"] = tag

		outbounds[i] = newOb
		changed = true
		log.Printf("[scheduler] Updated outbound tag=%s type=%s node=%s", tag, obType, nodeName)
	}

	if !changed {
		return configData, false
	}

	cfg["outbounds"] = outbounds
	result, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return configData, false
	}
	return result, true
}
