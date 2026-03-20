package handlers

import (
	"log"
	"net/http"
	"regexp"
	"singbox-config-service/services"

	"github.com/gin-gonic/gin"
)

// validNamePattern 合法的实例名称：字母、数字、下划线、连字符
var validNamePattern = regexp.MustCompile(`^[a-zA-Z]{2,10}$`)

// validateName 校验实例名称：2-10位英文字母
func validateName(c *gin.Context) (string, bool) {
	name := c.Param("name")
	if name == "" || !validNamePattern.MatchString(name) {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid config name",
			Message: "Name must be 2-10 letters only",
		})
		return "", false
	}
	return name, true
}

// GetSingboxVersion 获取 sing-box 版本
func GetSingboxVersion(c *gin.Context) {
	version, err := services.GetSingBoxVersion()
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "sing-box not found",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"version": version,
	})
}

// RunSingbox 运行 sing-box 容器
func RunSingbox(c *gin.Context) {
	// 不再需要请求参数，配置文件使用默认路径

	containerID, err := services.RunSingboxContainer()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to start sing-box container",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "sing-box container started successfully",
		"containerId": containerID,
	})
}

// SaveConfig 保存配置文件
func SaveConfig(c *gin.Context) {
	configData, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Failed to read config data",
			Message: err.Error(),
		})
		return
	}

	configPath, err := services.SaveConfig(configData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to save config",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Config saved successfully",
		"path":    configPath,
	})
}

// GetConfig 获取配置文件
func GetConfig(c *gin.Context) {
	data, err := services.GetConfig()
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Config not found",
			Message: err.Error(),
		})
		return
	}

	c.Data(http.StatusOK, "application/json", data)
}

// StopSingbox 停止 sing-box 容器
func StopSingbox(c *gin.Context) {
	// 不再需要 PID 参数

	if err := services.StopSingboxContainer(); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to stop sing-box container",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "sing-box container stopped successfully",
	})
}

// GetSingboxLogs 获取 sing-box 日志
func GetSingboxLogs(c *gin.Context) {
	logs := services.GetContainerLogs()
	c.JSON(http.StatusOK, gin.H{
		"logs": logs,
	})
}

// CheckSingboxStatus 检查 sing-box 容器是否正在运行
func CheckSingboxStatus(c *gin.Context) {
	// 不再需要 PID 参数

	running, containerID := services.CheckContainerRunning()

	c.JSON(http.StatusOK, gin.H{
		"running":     running,
		"containerId": containerID,
	})
}

// EnsureImage 确保 sing-box 镜像存在
func EnsureImage(c *gin.Context) {
	if err := services.EnsureSingboxImage(); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to ensure sing-box image",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "sing-box image is ready",
	})
}

// ========== 多配置多容器 API ==========

// ListNamedConfigs 列出所有命名配置及其容器状态
func ListNamedConfigs(c *gin.Context) {
	configs, err := services.ListNamedConfigs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to list configs",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"configs": configs,
	})
}

// CheckNamedConfig 验证命名配置是否正确
func CheckNamedConfig(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	valid, output, err := services.CheckNamedConfig(name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to check config",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":   valid,
		"message": output,
	})
}

// SaveNamedConfigWithContainer 保存配置到命名目录并验证（用于多容器场景）
func SaveNamedConfigWithContainer(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	configData, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Failed to read config data",
			Message: err.Error(),
		})
		return
	}

	// 先保存配置文件
	if err := services.SaveNamedConfigWithDir(name, configData); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to save config",
			Message: err.Error(),
		})
		return
	}

	// 保存后验证配置
	valid, output, err := services.CheckNamedConfig(name)
	if err != nil {
		// 验证失败不影响保存，但返回警告
		c.JSON(http.StatusOK, gin.H{
			"message": "Config saved but validation unavailable",
			"name":    name,
			"valid":   nil,
			"warning": err.Error(),
		})
		return
	}

	if !valid {
		c.JSON(http.StatusOK, gin.H{
			"message": output,
			"name":    name,
			"valid":   false,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Config saved and validated successfully",
		"name":    name,
		"valid":   true,
	})
}

// LoadNamedConfigFromContainer 从命名目录加载配置
func LoadNamedConfigFromContainer(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	data, err := services.LoadNamedConfigFromDir(name)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Config not found",
			Message: err.Error(),
		})
		return
	}

	c.Data(http.StatusOK, "application/json", data)
}

// DeleteNamedConfigWithContainer 删除命名配置及其容器
func DeleteNamedConfigWithContainer(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	if err := services.DeleteNamedConfigWithDir(name); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to delete config",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Config deleted successfully",
		"name":    name,
	})
}

// RunNamedContainer 启动命名配置的容器
func RunNamedContainer(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	containerID, err := services.RunNamedContainer(name)
	if err != nil {
		log.Printf("Failed to start container for %s: %v", name, err)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to start container",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":     "Container started successfully",
		"name":        name,
		"containerId": containerID,
	})
}

// StopNamedContainer 停止命名配置的容器
func StopNamedContainer(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	if err := services.StopNamedContainer(name); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to stop container",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Container stopped successfully",
		"name":    name,
	})
}

// GetNamedContainerStatus 获取命名容器状态
func GetNamedContainerStatus(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	running, containerID := services.GetNamedContainerStatus(name)

	c.JSON(http.StatusOK, gin.H{
		"name":        name,
		"running":     running,
		"containerId": containerID,
	})
}

// GetNamedContainerLogs 获取命名容器日志
func GetNamedContainerLogs(c *gin.Context) {
	name, ok := validateName(c)
	if !ok {
		return
	}

	logs := services.GetNamedContainerLogs(name)
	c.JSON(http.StatusOK, gin.H{
		"name": name,
		"logs": logs,
	})
}

// ListAllContainers 列出所有 sing-box 容器
func ListAllContainers(c *gin.Context) {
	containers, err := services.ListAllContainers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to list containers",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"containers": containers,
	})
}
