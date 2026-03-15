package services

import (
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
			if _, err := UpdateSubscription(sub.ID); err != nil {
				log.Printf("Failed to auto-update subscription %s: %v", sub.Name, err)
			} else {
				log.Printf("Auto-update success: %s", sub.Name)
			}
		}
	}
}
