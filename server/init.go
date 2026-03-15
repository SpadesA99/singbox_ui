package main

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"

	"singbox-config-service/services"
)

var (
	baseDir          string
	singboxDir       string
	singboxConfigFile string
)

// init 初始化路径变量
func init() {
	// 优先使用环境变量指定的数据目录
	dataDir := os.Getenv("DATA_DIR")
	if dataDir != "" {
		baseDir = dataDir
		singboxDir = filepath.Join(baseDir, "singbox")
		singboxConfigFile = filepath.Join(singboxDir, "config.json")
		log.Printf("Using DATA_DIR: %s", baseDir)
		log.Printf("sing-box directory: %s", singboxDir)
		return
	}

	// 获取工作目录
	workDir, err := os.Getwd()
	if err != nil {
		log.Fatalf("Failed to get working directory: %v", err)
	}

	// 如果工作目录包含 go.mod，说明是 server 目录
	if _, err := os.Stat(filepath.Join(workDir, "go.mod")); err == nil {
		baseDir = workDir
	} else if _, err := os.Stat(filepath.Join(workDir, "server", "go.mod")); err == nil {
		// 如果是项目根目录，使用 server 子目录
		baseDir = filepath.Join(workDir, "server")
	} else {
		// 默认使用当前工作目录
		baseDir = workDir
	}

	singboxDir = filepath.Join(baseDir, "singbox")
	singboxConfigFile = filepath.Join(singboxDir, "config.json")

	log.Printf("Base directory: %s", baseDir)
	log.Printf("sing-box directory: %s", singboxDir)
}

// Initialize 初始化 sing-box Docker 环境
func Initialize() error {
	log.Println("Initializing sing-box Docker environment...")

	// 创建 singbox 目录
	if err := os.MkdirAll(singboxDir, 0755); err != nil {
		return fmt.Errorf("failed to create singbox directory: %v", err)
	}

	// 初始化 Docker 服务
	if err := services.InitDockerService(); err != nil {
		return fmt.Errorf("failed to initialize docker service: %v", err)
	}

	// 后台拉取 sing-box 镜像
	go func() {
		log.Println("Pulling sing-box image in background...")
		if err := services.EnsureSingboxImage(); err != nil {
			log.Printf("Warning: Failed to pull sing-box image: %v", err)
		} else {
			log.Println("sing-box image is ready")
		}
	}()

	// 检查配置文件
	if _, err := os.Stat(singboxConfigFile); os.IsNotExist(err) {
		log.Println("Creating default sing-box config...")
		if err := createDefaultConfig(); err != nil {
			return fmt.Errorf("failed to create default config: %v", err)
		}
	}

	// 初始化探测器
	if err := services.InitProber(); err != nil {
		log.Printf("Warning: Failed to initialize prober: %v", err)
	} else {
		// 加载已保存的节点并启动探测器
		prober := services.GetProber()
		if prober != nil {
			if err := prober.LoadNodesFromFile(); err != nil {
				log.Printf("Warning: Failed to load prober nodes: %v", err)
			}
			// 如果有节点，自动启动探测器
			if len(prober.GetAllResults()) > 0 {
				prober.Start()
				log.Println("Prober started with saved nodes")
			}
		}
	}

	// 启动订阅自动更新调度器
	services.StartAutoUpdateScheduler()

	log.Println("sing-box Docker environment initialized successfully")
	return nil
}

// createDefaultConfig 创建默认配置文件 (sing-box format)
func createDefaultConfig() error {
	defaultConfig := map[string]interface{}{
		"log": map[string]interface{}{
			"level":     "warn",
			"timestamp": true,
		},
		"dns": map[string]interface{}{
			"servers": []interface{}{
				map[string]interface{}{
					"tag":    "local_dns",
					"type":   "udp",
					"server": "223.5.5.5",
				},
				map[string]interface{}{
					"tag":    "remote_dns",
					"type":   "udp",
					"server": "8.8.8.8",
				},
			},
			"final":             "remote_dns",
			"independent_cache": true,
		},
		"inbounds":  []interface{}{},
		"outbounds": []interface{}{
			map[string]interface{}{
				"type": "direct",
				"tag":  "direct",
			},
			map[string]interface{}{
				"type": "block",
				"tag":  "block",
			},
		},
		"route": map[string]interface{}{
			"rules": []interface{}{},
			"final": "direct",
		},
	}

	data, err := json.MarshalIndent(defaultConfig, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(singboxConfigFile, data, 0644)
}
