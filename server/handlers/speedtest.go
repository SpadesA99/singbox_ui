package handlers

import (
	"net/http"
	"singbox-config-service/services"

	"github.com/gin-gonic/gin"
)

// StartSpeedTest 启动代理测速（串行测试所有订阅节点）
func StartSpeedTest(c *gin.Context) {
	if err := services.StartSpeedTest(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "speed test started"})
}

// GetSpeedTestStatus 获取当前测速状态与结果
func GetSpeedTestStatus(c *gin.Context) {
	c.JSON(http.StatusOK, services.GetSpeedTestState())
}

// StopSpeedTest 取消正在运行的测速
func StopSpeedTest(c *gin.Context) {
	services.StopSpeedTest()
	c.JSON(http.StatusOK, gin.H{"message": "stop requested"})
}
