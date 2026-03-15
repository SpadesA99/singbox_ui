package handlers

import (
	"net/http"
	"singbox-config-service/services"

	"github.com/gin-gonic/gin"
)

// GetSubscriptions 获取所有订阅
func GetSubscriptions(c *gin.Context) {
	subData, err := services.LoadSubscriptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to load subscriptions",
			Message: err.Error(),
		})
		return
	}

	// 计算总节点数
	totalNodes := 0
	for _, sub := range subData.Subscriptions {
		totalNodes += len(sub.Nodes)
	}

	c.JSON(http.StatusOK, gin.H{
		"subscriptions": subData.Subscriptions,
		"count":         len(subData.Subscriptions),
		"totalNodes":    totalNodes,
	})
}

// AddSubscription 添加订阅
func AddSubscription(c *gin.Context) {
	var request struct {
		Name      string `json:"name" binding:"required"`
		URL       string `json:"url" binding:"required"`
		UserAgent string `json:"user_agent"`
	}

	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: err.Error(),
		})
		return
	}

	entry, err := services.AddSubscription(request.Name, request.URL, request.UserAgent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to add subscription",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Subscription added successfully",
		"subscription": entry,
		"nodeCount":    len(entry.Nodes),
	})
}

// RefreshSubscription 刷新单个订阅
func RefreshSubscription(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "subscription id is required",
		})
		return
	}

	entry, err := services.UpdateSubscription(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to refresh subscription",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Subscription refreshed successfully",
		"subscription": entry,
		"nodeCount":    len(entry.Nodes),
	})
}

// DeleteSubscription 删除订阅
func DeleteSubscription(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "subscription id is required",
		})
		return
	}

	if err := services.DeleteSubscription(id); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to delete subscription",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Subscription deleted successfully",
	})
}

// RefreshAllSubscriptions 刷新所有订阅
func RefreshAllSubscriptions(c *gin.Context) {
	data, err := services.RefreshAllSubscriptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to refresh subscriptions",
			Message: err.Error(),
		})
		return
	}

	totalNodes := 0
	for _, sub := range data.Subscriptions {
		totalNodes += len(sub.Nodes)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "All subscriptions refreshed",
		"subscriptions": data.Subscriptions,
		"count":         len(data.Subscriptions),
		"totalNodes":    totalNodes,
	})
}

// GetUserAgents 获取预定义 User-Agent 列表
func GetUserAgents(c *gin.Context) {
	type UAOption struct {
		Key   string `json:"key"`
		Label string `json:"label"`
		Value string `json:"value"`
	}

	options := []UAOption{
		{Key: "default", Label: "默认浏览器", Value: services.PredefinedUserAgents["default"]},
		{Key: "clash-verge", Label: "Clash Verge", Value: services.PredefinedUserAgents["clash-verge"]},
		{Key: "clash-meta", Label: "Clash Meta", Value: services.PredefinedUserAgents["clash-meta"]},
		{Key: "v2rayn", Label: "v2rayN", Value: services.PredefinedUserAgents["v2rayn"]},
		{Key: "v2rayng", Label: "v2rayNG", Value: services.PredefinedUserAgents["v2rayng"]},
	}

	c.JSON(http.StatusOK, gin.H{
		"user_agents": options,
	})
}

// UpdateSubscriptionSettings 更新订阅自动更新设置
func UpdateSubscriptionSettings(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request", Message: "subscription id is required"})
		return
	}

	var request struct {
		AutoUpdate     bool `json:"auto_update"`
		UpdateInterval int  `json:"update_interval"`
	}
	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid request", Message: err.Error()})
		return
	}

	entry, err := services.UpdateSubscriptionSettings(id, request.AutoUpdate, request.UpdateInterval)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: "Failed to update settings", Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Settings updated",
		"subscription": entry,
	})
}

// GetAllNodes 获取所有节点
func GetAllNodes(c *gin.Context) {
	nodes, err := services.GetAllNodes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get nodes",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"nodes": nodes,
		"count": len(nodes),
	})
}
