package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"singbox-config-service/handlers"

	"github.com/gin-gonic/gin"
)

//go:embed dist/*
var distFS embed.FS

func main() {
	// 初始化 sing-box 环境
	if err := Initialize(); err != nil {
		log.Printf("Warning: Failed to initialize sing-box environment: %v", err)
		log.Println("Some features may not work properly")
	}

	// 设置 Gin 模式
	gin.SetMode(gin.ReleaseMode)

	// 创建 Gin 路由
	r := gin.Default()

	// 添加 CORS 中间件
	r.Use(corsMiddleware())

	// API 路由组 - 仅提供工具类API
	api := r.Group("/api")
	{
		// WireGuard 密钥生成工具和多客户端管理
		wg := api.Group("/wireguard")
		{
			// 密钥生成
			wg.POST("/keygen", handlers.GenerateWireGuardKeys)
			wg.POST("/pubkey", handlers.GetPublicKeyFromPrivate)
			wg.GET("/keys-cache", handlers.GetKeysCache)
			wg.GET("/public-ip", handlers.GetPublicIP)

			// 客户端配置
			wg.GET("/client-config", handlers.GetClientConfig)
			wg.POST("/client-config", handlers.SaveClientConfig)
			wg.POST("/save-client-file", handlers.SaveClientConfigFile)
			wg.GET("/client-files", handlers.ListClientConfigFiles)
		}

		// sing-box 管理工具 (Docker 容器模式)
		singbox := api.Group("/singbox")
		{
			singbox.GET("/version", handlers.GetSingboxVersion)
			singbox.GET("/config", handlers.GetConfig)
			singbox.POST("/config", handlers.SaveConfig)
			singbox.POST("/run", handlers.RunSingbox)
			singbox.POST("/stop", handlers.StopSingbox)
			singbox.GET("/logs", handlers.GetSingboxLogs)
			singbox.GET("/status", handlers.CheckSingboxStatus)
			singbox.POST("/ensure-image", handlers.EnsureImage)

			// 证书管理
			singbox.POST("/certificate", handlers.GenerateSelfSignedCert)
			singbox.GET("/certificate", handlers.GetCertificateInfo)
			singbox.POST("/certificate/upload", handlers.UploadCertificate)
			singbox.POST("/reality/keypair", handlers.GenerateRealityKeypair)
			singbox.POST("/reality/public-key", handlers.DeriveRealityPublicKey)
			singbox.POST("/reality/check-tls", handlers.CheckTLS13Support)

			// 多配置多容器管理
			singbox.GET("/instances", handlers.ListNamedConfigs)
			singbox.POST("/instances/:name/config", handlers.SaveNamedConfigWithContainer)
			singbox.GET("/instances/:name/config", handlers.LoadNamedConfigFromContainer)
			singbox.POST("/instances/:name/check", handlers.CheckNamedConfig)
			singbox.DELETE("/instances/:name", handlers.DeleteNamedConfigWithContainer)
			singbox.POST("/instances/:name/run", handlers.RunNamedContainer)
			singbox.POST("/instances/:name/stop", handlers.StopNamedContainer)
			singbox.GET("/instances/:name/status", handlers.GetNamedContainerStatus)
			singbox.GET("/instances/:name/logs", handlers.GetNamedContainerLogs)
			singbox.GET("/containers", handlers.ListAllContainers)
		}

		// 订阅管理
		sub := api.Group("/subscription")
		{
			sub.GET("", handlers.GetSubscriptions)          // 获取所有订阅
			sub.POST("", handlers.AddSubscription)          // 添加订阅
			sub.POST("/:id/refresh", handlers.RefreshSubscription)         // 刷新单个订阅
			sub.PATCH("/:id/settings", handlers.UpdateSubscriptionSettings) // 更新自动更新设置
			sub.DELETE("/:id", handlers.DeleteSubscription)                 // 删除订阅
			sub.POST("/refresh-all", handlers.RefreshAllSubscriptions) // 刷新所有订阅
			sub.GET("/nodes", handlers.GetAllNodes)         // 获取所有节点
			sub.GET("/user-agents", handlers.GetUserAgents) // 获取预定义 UA 列表
		}

		// 节点探测器
		prober := api.Group("/prober")
		{
			prober.GET("/status", handlers.GetProberStatus)
			prober.GET("/results", handlers.GetProbeResults)
			prober.GET("/results/:tag", handlers.GetProbeResult)
			prober.GET("/best", handlers.GetBestNode)
			prober.GET("/online", handlers.GetOnlineNodes)
			prober.POST("/nodes", handlers.AddProberNode)
			prober.PUT("/nodes", handlers.UpdateProberNodes)
			prober.DELETE("/nodes/:tag", handlers.RemoveProberNode)
			prober.DELETE("/nodes", handlers.ClearProberNodes)
			prober.POST("/start", handlers.StartProber)
			prober.POST("/stop", handlers.StopProber)
			prober.POST("/sync", handlers.SyncNodesFromSubscription)
			prober.POST("/save", handlers.SaveProbeResultsToSubscription)
		}

		// 代理测速：启动临时 sing-box 实例通过 SOCKS/HTTP 代理测试节点
		speedtest := api.Group("/speedtest")
		{
			speedtest.POST("/start", handlers.StartSpeedTest)
			speedtest.GET("/status", handlers.GetSpeedTestStatus)
			speedtest.POST("/stop", handlers.StopSpeedTest)
		}

	}

	// 健康检查
	r.GET("/health", handlers.HealthCheck)

	// 静态文件服务 - 提供前端页面
	setupStaticFiles(r)

	// 启动服务器（支持通过 LISTEN_ADDR 环境变量配置）
	listenAddr := os.Getenv("LISTEN_ADDR")
	if listenAddr == "" {
		listenAddr = "127.0.0.1:7000"
	}
	log.Printf("Sing-box Config Service is starting on %s", listenAddr)
	if err := r.Run(listenAddr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// setupStaticFiles 配置静态文件服务
func setupStaticFiles(r *gin.Engine) {
	// 获取嵌入的文件系统
	staticFS, err := fs.Sub(distFS, "dist")
	if err != nil {
		log.Printf("Warning: Failed to load embedded frontend files: %v", err)
		return
	}

	// 创建 HTTP 文件服务器
	fileServer := http.FileServer(http.FS(staticFS))

	// 服务静态文件
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path

		// 如果路径以 /api 开头,说明是 API 请求但路由不存在
		if len(path) >= 4 && path[:4] == "/api" {
			c.JSON(404, gin.H{"error": "API endpoint not found"})
			return
		}

		// 尝试服务静态文件
		fileServer.ServeHTTP(c.Writer, c.Request)
	})

	log.Println("Static frontend files loaded from embedded dist directory")
}

// corsMiddleware CORS 中间件
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
