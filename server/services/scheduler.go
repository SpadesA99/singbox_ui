package services

import (
	"encoding/json"
	"log"
	"time"
)

// StartAutoUpdateScheduler 启动订阅自动更新调度器（后台 goroutine，每分钟检查一次）
func StartAutoUpdateScheduler() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			checkAndAutoUpdateSubscriptions()
		}
	}()
	log.Println("Auto-update scheduler started")
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
			if err == nil {
				elapsed := now.Sub(lastUpdated)
				if elapsed < time.Duration(sub.UpdateInterval)*time.Hour {
					needUpdate = false
				}
			}
		}

		if needUpdate {
			log.Printf("Auto-updating subscription: %s", sub.Name)
			updated, err := UpdateSubscription(sub.ID)
			if err != nil {
				log.Printf("Failed to auto-update subscription %s: %v", sub.Name, err)
				continue
			}
			log.Printf("Auto-update success: %s (%d nodes)", sub.Name, len(updated.Nodes))

			// 将更新后的节点同步到正在运行的容器配置
			applySubscriptionToRunningContainers(updated.Nodes)
		}
	}
}

// applySubscriptionToRunningContainers 将订阅节点更新应用到正在运行的容器
// 匹配优先级：1) outbound tag 精确匹配  2) _node_name 备用匹配（服务器地址变更时）
func applySubscriptionToRunningContainers(nodes []ProxyNode) {
	nodeByTag := make(map[string]ProxyNode, len(nodes))
	nodeByName := make(map[string]ProxyNode, len(nodes))
	for _, n := range nodes {
		tag := ""
		if n.Outbound != nil {
			if t, ok := n.Outbound["tag"].(string); ok {
				tag = t
			}
		}
		if tag == "" {
			tag = SanitizeTag(n.Protocol, n.Address, n.Port)
		}
		nodeByTag[tag] = n
		if n.Name != "" {
			nodeByName[n.Name] = n
		}
	}

	// 1. 默认容器 (singboxDir/config.json)
	applyToDefaultContainer(nodeByTag, nodeByName)

	// 2. 所有命名实例 (singboxDir/configs/*/config.json)
	applyToNamedContainers(nodeByTag, nodeByName)
}

// applyToDefaultContainer 更新默认容器配置
func applyToDefaultContainer(nodeByTag, nodeByName map[string]ProxyNode) {
	configData, err := GetConfig()
	if err != nil {
		return // 配置文件不存在，跳过
	}

	updated, changed := injectNodeIntoConfig(configData, nodeByTag, nodeByName)
	if !changed {
		return
	}

	if _, err := SaveConfig(updated); err != nil {
		log.Printf("[scheduler] Failed to save default config: %v", err)
		return
	}

	// 如果容器正在运行则重启
	running, _ := CheckContainerRunning()
	if !running {
		return
	}

	log.Printf("[scheduler] Restarting default container after subscription update")
	if err := StopSingboxContainer(); err != nil {
		log.Printf("[scheduler] Failed to stop default container: %v", err)
		return
	}
	if _, err := RunSingboxContainer(); err != nil {
		log.Printf("[scheduler] Failed to restart default container: %v", err)
	} else {
		log.Printf("[scheduler] Default container restarted with updated node")
	}
}

// applyToNamedContainers 更新所有命名实例配置
func applyToNamedContainers(nodeByTag, nodeByName map[string]ProxyNode) {
	configs, err := ListNamedConfigs()
	if err != nil {
		return
	}

	for _, cfg := range configs {
		configData, err := LoadNamedConfigFromDir(cfg.Name)
		if err != nil {
			continue
		}

		updated, changed := injectNodeIntoConfig(configData, nodeByTag, nodeByName)
		if !changed {
			continue
		}

		if err := SaveNamedConfigWithDir(cfg.Name, updated); err != nil {
			log.Printf("[scheduler] Failed to save config for instance %s: %v", cfg.Name, err)
			continue
		}

		if !cfg.Running {
			continue
		}

		log.Printf("[scheduler] Restarting instance %s after subscription update", cfg.Name)
		if err := StopNamedContainer(cfg.Name); err != nil {
			log.Printf("[scheduler] Failed to stop instance %s: %v", cfg.Name, err)
			continue
		}
		if _, err := RunNamedContainer(cfg.Name); err != nil {
			log.Printf("[scheduler] Failed to restart instance %s: %v", cfg.Name, err)
		} else {
			log.Printf("[scheduler] Instance %s restarted with updated node", cfg.Name)
		}
	}
}

// injectNodeIntoConfig 在 config JSON 中找到匹配的 outbound 并替换节点数据
// 匹配优先级：1) tag 精确匹配  2) _node_name 备用匹配（服务器地址变更时）
// 返回更新后的 JSON 和是否发生变化
func injectNodeIntoConfig(configData []byte, nodeByTag, nodeByName map[string]ProxyNode) ([]byte, bool) {
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

	// 遍历所有 outbound，找到 tag 在订阅节点里的（跳过 direct/block/dns/urltest）
	changed := false
	for i, ob := range outbounds {
		obMap, ok := ob.(map[string]interface{})
		if !ok {
			continue
		}
		obType, _ := obMap["type"].(string)
		if obType == "direct" || obType == "block" || obType == "dns" || obType == "urltest" {
			continue
		}
		tag, _ := obMap["tag"].(string)
		if tag == "" {
			continue
		}

		// 优先 tag 匹配，备用 _node_name 匹配
		node, found := nodeByTag[tag]
		if !found {
			nodeName, _ := obMap["_node_name"].(string)
			if nodeName != "" {
				node, found = nodeByName[nodeName]
			}
		}
		if !found || node.Outbound == nil {
			continue
		}

		// 替换整个 outbound，保留原 tag 和 _node_name
		newOb := make(map[string]interface{})
		for k, v := range node.Outbound {
			newOb[k] = v
		}
		newOb["tag"] = tag
		if nodeName, _ := obMap["_node_name"].(string); nodeName != "" {
			newOb["_node_name"] = nodeName
		}
		outbounds[i] = newOb
		changed = true
		log.Printf("[scheduler] Updated outbound tag=%s type=%s", tag, obType)
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
