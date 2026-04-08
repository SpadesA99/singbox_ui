package services

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
)

var (
	baseDir    string
	singboxDir string
)

// DockerService 实例
var (
	dockerService *DockerService
	dockerMutex   sync.RWMutex
)

// init 初始化路径变量
func init() {
	// 优先使用环境变量指定的数据目录
	dataDir := os.Getenv("DATA_DIR")
	if dataDir != "" {
		baseDir = dataDir
		singboxDir = filepath.Join(baseDir, "singbox")
		log.Printf("Using DATA_DIR: %s", baseDir)
		return
	}

	// 获取工作目录
	workDir, err := os.Getwd()
	if err != nil {
		log.Printf("Warning: Failed to get working directory: %v", err)
		baseDir = "."
	} else {
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
	}

	singboxDir = filepath.Join(baseDir, "singbox")
}

// GetSingboxDir 获取 sing-box 配置目录
func GetSingboxDir() string {
	return singboxDir
}

// InitDockerService 初始化 Docker 服务
func InitDockerService() error {
	dockerMutex.Lock()
	defer dockerMutex.Unlock()

	if dockerService != nil {
		return nil
	}

	var err error
	dockerService, err = NewDockerService()
	if err != nil {
		return fmt.Errorf("failed to initialize docker service: %v", err)
	}

	log.Println("Docker service initialized successfully")
	return nil
}

// GetDockerService 获取 Docker 服务实例
func GetDockerService() *DockerService {
	dockerMutex.RLock()
	defer dockerMutex.RUnlock()
	return dockerService
}

// EnsureSingboxImage 确保 sing-box 镜像存在
func EnsureSingboxImage() error {
	ds := GetDockerService()
	if ds == nil {
		return fmt.Errorf("docker service not initialized")
	}
	return ds.EnsureImage()
}

// RunSingboxContainer 启动 sing-box 容器
func RunSingboxContainer() (string, error) {
	ds := GetDockerService()
	if ds == nil {
		return "", fmt.Errorf("docker service not initialized")
	}

	// 确保配置文件存在
	configPath := filepath.Join(singboxDir, "config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return "", fmt.Errorf("config file not found: %s", configPath)
	}

	// 创建并启动容器
	containerID, err := ds.CreateAndStartContainer(singboxDir)
	if err != nil {
		return "", err
	}

	log.Printf("sing-box container started: %s", containerID[:12])
	return containerID, nil
}

// StopSingboxContainer 停止 sing-box 容器
func StopSingboxContainer() error {
	ds := GetDockerService()
	if ds == nil {
		return fmt.Errorf("docker service not initialized")
	}

	if err := ds.StopContainer(); err != nil {
		return err
	}

	if err := ds.RemoveContainer(); err != nil {
		return err
	}

	log.Println("sing-box container stopped and removed")
	return nil
}

// CheckContainerRunning 检查容器是否在运行
func CheckContainerRunning() (bool, string) {
	ds := GetDockerService()
	if ds == nil {
		return false, ""
	}

	running, containerID, err := ds.GetContainerStatus()
	if err != nil {
		log.Printf("Failed to check container status: %v", err)
		return false, ""
	}

	return running, containerID
}

// GetContainerLogs 获取容器日志
func GetContainerLogs() string {
	ds := GetDockerService()
	if ds == nil {
		return "Docker service not initialized"
	}

	logs, err := ds.GetContainerLogs("200")
	if err != nil {
		log.Printf("Failed to get container logs: %v", err)
		return fmt.Sprintf("Failed to get logs: %v", err)
	}

	return logs
}

// GetSingBoxVersion 获取 sing-box 版本（从容器）
func GetSingBoxVersion() (string, error) {
	ds := GetDockerService()
	if ds == nil {
		return "", fmt.Errorf("docker service not initialized")
	}

	return ds.GetSingBoxVersion()
}

// SaveConfig 保存配置文件，并自动更新 tag->nodeName 旁路映射
func SaveConfig(configData []byte) (string, error) {
	// 确保 singbox 目录存在
	if err := os.MkdirAll(singboxDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create singbox directory: %w", err)
	}

	configPath := filepath.Join(singboxDir, "config.json")

	if err := os.WriteFile(configPath, configData, 0644); err != nil {
		return "", fmt.Errorf("failed to save config: %w", err)
	}

	// 异步更新 tag->nodeName 映射（不阻塞保存流程）
	go rebuildNodeMapping(configData)

	return configPath, nil
}

// rebuildNodeMapping 从 config 的 outbounds 中提取 tag，与订阅节点匹配后更新映射文件
func rebuildNodeMapping(configData []byte) {
	var cfg struct {
		Outbounds []map[string]interface{} `json:"outbounds"`
	}
	if err := json.Unmarshal(configData, &cfg); err != nil {
		return
	}

	// 加载订阅节点，构建 server:port:type -> name 索引
	subData, err := LoadSubscriptions()
	if err != nil {
		return
	}
	type key struct{ server string; port int; proto string }
	nodeNameByKey := make(map[key]string)
	for _, sub := range subData.Subscriptions {
		for _, n := range sub.Nodes {
			nodeNameByKey[key{n.Address, n.Port, n.Protocol}] = n.Name
		}
	}

	mapping := LoadNodeMapping()
	for _, ob := range cfg.Outbounds {
		obType, _ := ob["type"].(string)
		if obType == "direct" || obType == "block" || obType == "dns" || obType == "urltest" || obType == "selector" {
			continue
		}
		tag, _ := ob["tag"].(string)
		if tag == "" {
			continue
		}
		server, _ := ob["server"].(string)
		portFloat, _ := ob["server_port"].(float64)
		port := int(portFloat)
		if name, ok := nodeNameByKey[key{server, port, obType}]; ok {
			mapping[tag] = name
		}
	}
	_ = SaveNodeMapping(mapping)
}

// GetConfig 获取配置文件
func GetConfig() ([]byte, error) {
	configPath := filepath.Join(singboxDir, "config.json")

	// 检查文件是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config file not found")
	}

	// 读取配置文件
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	return data, nil
}

// CloseDockerService 关闭 Docker 服务
func CloseDockerService() error {
	dockerMutex.Lock()
	defer dockerMutex.Unlock()

	if dockerService != nil {
		err := dockerService.Close()
		dockerService = nil
		return err
	}
	return nil
}

// ========== 多配置多容器管理 ==========

// getNamedConfigDir 获取命名配置的目录
func getNamedConfigDir(name string) string {
	return filepath.Join(singboxDir, "configs", name)
}

// RunNamedContainer 启动命名配置的容器
func RunNamedContainer(name string) (string, error) {
	ds := GetDockerService()
	if ds == nil {
		return "", fmt.Errorf("docker service not initialized")
	}

	// 确保配置目录存在
	configDir := getNamedConfigDir(name)
	configPath := filepath.Join(configDir, "config.json")
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return "", fmt.Errorf("config file not found: %s", configPath)
	}

	// 创建并启动容器
	containerID, err := ds.CreateAndStartNamedContainer(name, configDir)
	if err != nil {
		return "", err
	}

	log.Printf("Named sing-box container started for config %s: %s", name, containerID[:12])
	return containerID, nil
}

// StopNamedContainer 停止命名配置的容器
func StopNamedContainer(name string) error {
	ds := GetDockerService()
	if ds == nil {
		return fmt.Errorf("docker service not initialized")
	}

	if err := ds.StopNamedContainer(name); err != nil {
		return err
	}

	if err := ds.RemoveNamedContainer(name); err != nil {
		return err
	}

	log.Printf("Named sing-box container stopped for config: %s", name)
	return nil
}

// GetNamedContainerStatus 获取命名容器状态
func GetNamedContainerStatus(name string) (bool, string) {
	ds := GetDockerService()
	if ds == nil {
		return false, ""
	}

	running, containerID, err := ds.GetNamedContainerStatus(name)
	if err != nil {
		log.Printf("Failed to check named container status: %v", err)
		return false, ""
	}

	return running, containerID
}

// GetNamedContainerLogs 获取命名容器日志
func GetNamedContainerLogs(name string) string {
	ds := GetDockerService()
	if ds == nil {
		return "Docker service not initialized"
	}

	logs, err := ds.GetNamedContainerLogs(name, "200")
	if err != nil {
		log.Printf("Failed to get named container logs: %v", err)
		return fmt.Sprintf("Failed to get logs: %v", err)
	}

	return logs
}

// ListAllContainers 列出所有 sing-box 容器
func ListAllContainers() ([]ContainerInfo, error) {
	ds := GetDockerService()
	if ds == nil {
		return nil, fmt.Errorf("docker service not initialized")
	}

	return ds.ListAllSingboxContainers()
}

// CheckNamedConfig 验证命名配置是否正确
func CheckNamedConfig(name string) (bool, string, error) {
	ds := GetDockerService()
	if ds == nil {
		return false, "", fmt.Errorf("docker service not initialized")
	}

	configDir := getNamedConfigDir(name)
	configPath := filepath.Join(configDir, "config.json")

	// 检查配置文件是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return false, "", fmt.Errorf("config file not found for instance: %s", name)
	}

	return ds.CheckNamedConfig(name, configDir)
}

// SaveNamedConfigWithDir 保存配置到命名目录（用于多容器场景）
func SaveNamedConfigWithDir(name string, configData []byte) error {
	configDir := getNamedConfigDir(name)

	// 确保目录存在
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	configPath := filepath.Join(configDir, "config.json")
	if err := os.WriteFile(configPath, configData, 0644); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	log.Printf("Named config saved: %s", configPath)
	return nil
}

// LoadNamedConfigFromDir 从命名目录加载配置
func LoadNamedConfigFromDir(name string) ([]byte, error) {
	configPath := filepath.Join(getNamedConfigDir(name), "config.json")

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("config not found: %s", name)
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	return data, nil
}

// DeleteNamedConfigWithDir 删除命名配置目录
func DeleteNamedConfigWithDir(name string) error {
	// 先停止容器（如果正在运行）
	running, _ := GetNamedContainerStatus(name)
	if running {
		if err := StopNamedContainer(name); err != nil {
			log.Printf("Warning: failed to stop container before delete: %v", err)
		}
	}

	configDir := getNamedConfigDir(name)
	if err := os.RemoveAll(configDir); err != nil {
		return fmt.Errorf("failed to delete config directory: %w", err)
	}

	log.Printf("Named config deleted: %s", name)
	return nil
}

// ListNamedConfigs 列出所有命名配置及其容器状态
func ListNamedConfigs() ([]NamedConfigInfo, error) {
	configsDir := filepath.Join(singboxDir, "configs")

	// 确保目录存在
	if err := os.MkdirAll(configsDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create configs directory: %w", err)
	}

	entries, err := os.ReadDir(configsDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read configs directory: %w", err)
	}

	var configs []NamedConfigInfo
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}

		name := entry.Name()
		configPath := filepath.Join(configsDir, name, "config.json")

		// 检查配置文件是否存在
		info, err := os.Stat(configPath)
		if os.IsNotExist(err) {
			continue
		}

		// 获取容器状态
		running, containerID := GetNamedContainerStatus(name)

		configs = append(configs, NamedConfigInfo{
			Name:        name,
			CreatedAt:   info.ModTime().Unix(),
			Size:        info.Size(),
			Running:     running,
			ContainerID: containerID,
		})
	}

	return configs, nil
}

// NamedConfigInfo 命名配置信息（包含容器状态）
type NamedConfigInfo struct {
	Name        string `json:"name"`
	CreatedAt   int64  `json:"created_at"`
	Size        int64  `json:"size"`
	Running     bool   `json:"running"`
	ContainerID string `json:"container_id,omitempty"`
}
