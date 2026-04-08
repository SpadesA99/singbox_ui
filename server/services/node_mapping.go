package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

// NodeMapping 存储 outbound tag -> 节点名称的映射，用于订阅自动更新时的备用匹配
// 文件存放在 data 目录，不与 sing-box config 混用

var nodeMappingMu sync.RWMutex

func getNodeMappingFilePath() string {
	baseDir := os.Getenv("DATA_DIR")
	if baseDir == "" {
		baseDir, _ = os.Getwd()
	}
	return filepath.Join(baseDir, "node-mapping.json")
}

// LoadNodeMapping 加载 tag -> nodeName 映射
func LoadNodeMapping() map[string]string {
	nodeMappingMu.RLock()
	defer nodeMappingMu.RUnlock()

	data, err := os.ReadFile(getNodeMappingFilePath())
	if err != nil {
		return map[string]string{}
	}
	var m map[string]string
	if err := json.Unmarshal(data, &m); err != nil {
		return map[string]string{}
	}
	return m
}

// SaveNodeMapping 保存 tag -> nodeName 映射
func SaveNodeMapping(m map[string]string) error {
	nodeMappingMu.Lock()
	defer nodeMappingMu.Unlock()

	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(getNodeMappingFilePath(), data, 0644)
}

// UpsertNodeMapping 更新或新增单个 tag -> nodeName 记录
func UpsertNodeMapping(tag, nodeName string) {
	m := LoadNodeMapping()
	m[tag] = nodeName
	_ = SaveNodeMapping(m)
}
